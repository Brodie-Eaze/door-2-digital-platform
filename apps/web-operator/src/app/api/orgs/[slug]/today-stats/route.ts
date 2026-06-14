/**
 * GET /api/orgs/[slug]/today-stats
 *
 * Real-time command-centre KPIs sourced from the AnalyticsEvent outbox.
 * All numbers are scoped to today UTC (midnight → now) for the requesting
 * tenant; cross-tenant access → 403.
 *
 * Returns JSON — no cache so the Today page always reflects the latest
 * field activity.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, notFound, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const org = await resolveAccountOrg(params.slug, session);
  if (!org) return notFound('Org', params.slug);

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // ── Counts from AnalyticsEvent ──────────────────────────────────────
    const [knockCount, saleCount, saleAgg, sessionStartCount, sessionEndCount] = await Promise.all([
      db.analyticsEvent.count({
        where: { orgId: org.id, eventType: 'knock', occurredAt: { gte: todayStart } },
      }),
      db.analyticsEvent.count({
        where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: todayStart } },
      }),
      db.analyticsEvent.findMany({
        where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: todayStart } },
        select: { payload: true },
      }),
      db.analyticsEvent.count({
        where: { orgId: org.id, eventType: 'session_start', occurredAt: { gte: todayStart } },
      }),
      db.analyticsEvent.count({
        where: { orgId: org.id, eventType: 'session_end', occurredAt: { gte: todayStart } },
      }),
    ]);

    // Revenue: sum amountCents from sale payloads
    const revenueCentsToday = saleAgg.reduce((sum, ev) => {
      const p = ev.payload as Record<string, unknown>;
      const cents = typeof p.amountCents === 'number' ? p.amountCents : 0;
      return sum + cents;
    }, 0);

    // Active reps — session_start without a matching session_end
    const activeSessions = Math.max(0, sessionStartCount - sessionEndCount);

    // ── Per-rep knock leaderboard ────────────────────────────────────────
    const knocksByRep = await db.analyticsEvent.groupBy({
      by: ['userId'],
      where: { orgId: org.id, eventType: 'knock', occurredAt: { gte: todayStart } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 6,
    });

    const salesByRep = await db.analyticsEvent.groupBy({
      by: ['userId'],
      where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: todayStart } },
      _count: { id: true },
    });
    const salesMap = new Map(salesByRep.map((r) => [r.userId, r._count.id]));

    // Fetch display names for the top reps
    const repIds = knocksByRep.map((r) => r.userId).filter((id): id is string => !!id);
    const users = await db.user.findMany({
      where: { id: { in: repIds }, orgId: org.id },
      select: { id: true, givenName: true, familyName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const topReps = knocksByRep.map((r) => {
      const u = r.userId ? userMap.get(r.userId) : null;
      return {
        userId: r.userId,
        name: u ? `${u.givenName} ${u.familyName}`.trim() : 'Unknown',
        knocksToday: r._count.id,
        salesToday: r.userId ? (salesMap.get(r.userId) ?? 0) : 0,
      };
    });

    // ── Recent activity feed (last 12 field events) ──────────────────────
    const recentEvents = await db.analyticsEvent.findMany({
      where: {
        orgId: org.id,
        eventType: { in: ['knock', 'sale', 'session_start', 'session_end', 'photo'] },
        occurredAt: { gte: todayStart },
      },
      orderBy: { occurredAt: 'desc' },
      take: 12,
      select: {
        id: true,
        eventType: true,
        entityType: true,
        entityId: true,
        occurredAt: true,
        userId: true,
        payload: true,
      },
    });

    // Attach display names to activity feed
    const feedUserIds = [...new Set(recentEvents.map((e) => e.userId).filter(Boolean))] as string[];
    const feedUsers =
      feedUserIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: feedUserIds }, orgId: org.id },
            select: { id: true, givenName: true, familyName: true },
          })
        : [];
    const feedUserMap = new Map(feedUsers.map((u) => [u.id, u]));

    const activity = recentEvents.map((ev) => {
      const u = ev.userId ? feedUserMap.get(ev.userId) : null;
      const repName = u ? `${u.givenName} ${u.familyName}`.trim() : 'Rep';
      const p = ev.payload as Record<string, unknown>;
      let label = ev.eventType;
      if (ev.eventType === 'knock') label = `${repName} knocked`;
      else if (ev.eventType === 'sale') {
        const cents = typeof p.amountCents === 'number' ? p.amountCents : 0;
        const dollars = (cents / 100).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        });
        label = `${repName} closed ${dollars}`;
      } else if (ev.eventType === 'session_start') label = `${repName} clocked in`;
      else if (ev.eventType === 'session_end') label = `${repName} clocked out`;
      else if (ev.eventType === 'photo') label = `${repName} uploaded a photo`;
      return {
        id: ev.id,
        eventType: ev.eventType,
        label,
        occurredAt: ev.occurredAt,
        userId: ev.userId,
        repName,
      };
    });

    return ok({
      asOf: new Date().toISOString(),
      todayStart: todayStart.toISOString(),
      knocksToday: knockCount,
      salesToday: saleCount,
      revenueCentsToday,
      activeSessions,
      sessionStartsToday: sessionStartCount,
      topReps,
      activity,
    });
  } catch (err) {
    console.error('[today-stats]', err);
    return internal();
  }
}
