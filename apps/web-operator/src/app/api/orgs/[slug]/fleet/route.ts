/**
 * /api/orgs/[slug]/fleet — live rep positions for a single sub-account's
 * satellite map.
 *
 * Same source + PII-coarsening as the platform-wide /api/fleet (read that
 * route's doc comment first) — this is the slug-scoped mirror: every
 * knocker with an active KnockSession (endedAt IS NULL, started within the
 * last 10 hours) for THIS org, together with their most recent Knock.geo,
 * today's knock count, minutes since last knock, and territory name.
 *
 * Tenant scope: resolveAccountOrg pins the read to the slug's Org, same
 * pattern as /api/orgs/[slug]/territories — a cross-tenant operator may
 * target any org, everyone else only their own.
 *
 * Polling cadence: the account live-map component polls every 30 seconds.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

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

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const activeSessions = await db.knockSession.findMany({
      where: {
        orgId: org.id,
        endedAt: null,
        startedAt: { gte: tenHoursAgo },
      },
      include: {
        territory: { select: { name: true } },
        knocks: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { id: true, geo: true, capturedAt: true, disposition: true },
        },
      },
    });

    const userIds = [...new Set(activeSessions.map((s) => s.userId))];

    const todayKnockCounts =
      userIds.length > 0
        ? await db.knock.groupBy({
            by: ['userId'],
            where: {
              orgId: org.id,
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

      const status: 'active' | 'idle' | 'offline' =
        lastKnockMin <= 20 ? 'active' : lastKnockMin <= 60 ? 'idle' : 'offline';

      // PII: coarsen the last-knock geo to a ~100m grid (3dp) — same rule as
      // the platform /api/fleet. Precise geo goes through the JIT unmask path.
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
        account: org.tradingName,
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
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/fleet GET] failed:', err);
    return internal('Failed to load fleet');
  }
}
