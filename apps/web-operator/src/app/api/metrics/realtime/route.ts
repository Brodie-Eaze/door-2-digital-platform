/**
 * /api/metrics/realtime — live headline counters for the Command Centre KPIs.
 *
 * GET  Returns today's real-time fleet counters straight off the Knock /
 *      KnockSession tables:
 *        - knocksToday  : Knock rows captured since local-midnight today
 *        - convToday    : of those, the converted_* dispositions
 *        - activeReps   : KnockSession rows still open (endedAt = null)
 *      Plus updatedAt so the badge can show "LIVE · Xs ago".
 *
 * Tenant scoping mirrors /api/activity: pinned to session.orgId, except
 * cross-tenant operators (super_admin) who get the all-org rollup and may
 * narrow to a single sub-account with ?orgId=.
 *
 * Graceful by design — if the tables are empty the counts come back as
 * honest zeros (not an error). The page keeps its seeded hqRollup numbers
 * as the demo fallback and flips the DataSourceBadge to LIVE only when this
 * endpoint answers.
 *
 * Polling cadence: the command-centre page polls every 30 seconds.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** The two dispositions that count as a conversion for the headline metric. */
const CONVERTED_DISPOSITIONS = ['converted_donation', 'converted_sale'] as const;

export interface RealtimeMetrics {
  knocksToday: number;
  convToday: number;
  activeReps: number;
  updatedAt: string;
}

/** Local-clock start of today (00:00:00.000). */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Org scope: cross-tenant ops see all orgs (optionally narrowed by ?orgId=),
  // everyone else is pinned to their own org. `null` means "no org context".
  const requestedOrgId = req.nextUrl.searchParams.get('orgId');
  const orgFilter: { orgId: string } | Record<string, never> | null = isCrossTenantOperator(session)
    ? requestedOrgId
      ? { orgId: requestedOrgId }
      : {}
    : session.orgId
      ? { orgId: session.orgId }
      : null;

  if (orgFilter === null) {
    return forbidden('No org context');
  }

  const since = startOfToday();

  try {
    const [knocksToday, convToday, activeSessionUsers] = await Promise.all([
      db.knock.count({
        where: { ...orgFilter, capturedAt: { gte: since } },
      }),
      db.knock.count({
        where: {
          ...orgFilter,
          capturedAt: { gte: since },
          disposition: { in: [...CONVERTED_DISPOSITIONS] },
        },
      }),
      // Count DISTINCT knockers with an open session, not sessions — a rep can
      // leave several sessions open (app restart / re-login without clock-out),
      // which would otherwise inflate "active iPads".
      db.knockSession.groupBy({
        by: ['userId'],
        where: { ...orgFilter, endedAt: null },
      }),
    ]);

    const body: RealtimeMetrics = {
      knocksToday,
      convToday,
      activeReps: activeSessionUsers.length,
      updatedAt: new Date().toISOString(),
    };
    return ok(body);
  } catch (err) {
    console.error('[api/metrics/realtime GET] failed:', err);
    return internal('Failed to load realtime metrics');
  }
}
