/**
 * /api/fleet — live rep positions for the HQ satellite map.
 *
 * GET  Returns every knocker with an active KnockSession (endedAt IS NULL,
 *      started within the last 10 hours) together with:
 *       - Their most recent Knock.geo (parsed to lat/lng)
 *       - Knock count for today
 *       - Minutes since last knock (determines active vs idle status)
 *       - Territory name
 *
 * Names / initials: User.givenName and familyName are PII-vaulted ciphertext
 * in this schema. The BFF returns userId-derived initials (last 4 chars of the
 * ULID suffix) as a placeholder. Full name resolution requires the Fastify PII
 * vault service — integrate when JIT unmask is wired into the operator console.
 *
 * Polling cadence: the map component polls every 30 seconds.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Parse a geo string into {lat, lng}. Handles:
 *  - JSON  {"lat":30.2,"lng":-97.7}
 *  - CSV   "30.2,-97.7"
 *  - WKT   "POINT(-97.7 30.2)"  (lon lat order)
 */
function parseGeo(geo: string | null): { lat: number; lng: number } | null {
  if (!geo) return null;
  try {
    const j = JSON.parse(geo) as {
      lat?: number;
      lng?: number;
      longitude?: number;
      latitude?: number;
    };
    const lat = j.lat ?? j.latitude;
    const lng = j.lng ?? j.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  } catch {
    // not JSON — try other formats
  }
  // "lat,lng"
  const csv = geo.split(',');
  if (csv.length === 2) {
    const lat = parseFloat(csv[0]!);
    const lng = parseFloat(csv[1]!);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  // WKT POINT(lon lat)
  const wkt = geo.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (wkt) {
    const lng = parseFloat(wkt[1]!);
    const lat = parseFloat(wkt[2]!);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

/** Derive placeholder initials from a userId like "usr_01JXXXXXXXX" */
function userIdToInitials(userId: string): string {
  // Take the last 2 alpha chars of the ULID suffix as a stable placeholder.
  const suffix = userId.replace(/^[a-z]+_/, '');
  const alphas = suffix.replace(/[^A-Za-z]/g, '');
  return (alphas.slice(-2) || suffix.slice(-2) || '??').toUpperCase();
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Cross-tenant operators see all orgs; regular users see only their own.
  const orgFilter = isCrossTenantOperator(session)
    ? req.nextUrl.searchParams.get('orgId')
      ? { orgId: req.nextUrl.searchParams.get('orgId')! }
      : {}
    : session.orgId
      ? { orgId: session.orgId }
      : null;

  if (orgFilter === null) {
    return forbidden('No org context');
  }

  const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    // Active sessions: endedAt IS NULL, started within the last 10h.
    const activeSessions = await db.knockSession.findMany({
      where: {
        ...orgFilter,
        endedAt: null,
        startedAt: { gte: tenHoursAgo },
      },
      include: {
        territory: { select: { name: true } },
        org: { select: { tradingName: true, legalName: true } },
        knocks: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { id: true, geo: true, capturedAt: true, disposition: true },
        },
      },
    });

    // Knock counts per user for today (across all sessions, not just active one).
    const userIds = [...new Set(activeSessions.map((s) => s.userId))];

    const todayKnockCounts =
      userIds.length > 0
        ? await db.knock.groupBy({
            by: ['userId'],
            where: {
              ...orgFilter,
              userId: { in: userIds },
              capturedAt: { gte: todayStart },
            },
            _count: { id: true },
          })
        : [];

    const knockCountByUser = Object.fromEntries(
      todayKnockCounts.map((r) => [r.userId, r._count.id]),
    );

    const now = Date.now();

    const fleet = activeSessions.map((session) => {
      const lastKnock = session.knocks[0] ?? null;
      const lastKnockMs = lastKnock ? now - lastKnock.capturedAt.getTime() : Infinity;
      const lastKnockMin = lastKnock ? Math.floor(lastKnockMs / 60_000) : 9999;

      // Status heuristic: active if knocked in the last 20 min, idle otherwise.
      const status: 'active' | 'idle' | 'offline' =
        lastKnockMin <= 20 ? 'active' : lastKnockMin <= 60 ? 'idle' : 'offline';

      // PII: the last-knock geo is a resident's doorstep. Never ship the exact
      // coordinate — coarsen to a ~100m grid (3dp) so the live map still places
      // the rep in the right block without pinpointing a household. Precise geo
      // must go through the JIT unmask + audit path.
      const rawGeo = parseGeo(lastKnock?.geo ?? null);
      const geo = rawGeo
        ? { lat: Math.round(rawGeo.lat * 1000) / 1000, lng: Math.round(rawGeo.lng * 1000) / 1000 }
        : null;

      return {
        id: session.id,
        userId: session.userId,
        initials: userIdToInitials(session.userId),
        name: `Knocker ${session.userId.slice(-4)}`,
        territory: session.territory.name,
        // Human-readable account name, never the internal org_* primary key.
        account: session.org?.tradingName ?? session.org?.legalName ?? '—',
        status,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        knocksToday: knockCountByUser[session.userId] ?? 0,
        lastKnockMin: lastKnockMin === 9999 ? 999 : lastKnockMin,
        shiftStart: session.startedAt.toISOString(),
      };
    });

    return ok({ fleet, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/fleet GET] failed:', err);
    return internal('Failed to load fleet');
  }
}
