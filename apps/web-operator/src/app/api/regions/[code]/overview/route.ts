/**
 * GET /api/regions/[code]/overview — region-scoped KPI rollup for the
 * regions/[code] operations screen.
 *
 * Mirrors /api/overview's aggregate shape (activeOrgs, activeKnockers,
 * conversionsMTD, revenueCentsMTD) but scopes every query by `regionCode`
 * instead of `orgId` — a region view spans every org in that region, not
 * one tenant. Also returns a rolling-30d lead/conversion count used to
 * compute an honest conversion rate (replaces the AU/SG page fixtures that
 * derived these numbers from the `ACCOUNTS` fixture).
 *
 * Authorization: cross-tenant (super_admin) sees the whole region. An
 * org-scoped caller only sees this region if their own org is pinned to it
 * — otherwise 403, same shape as resolveAccountOrg's tenant check.
 *
 * Cached 0 s — mission-control KPIs must be current.
 */
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REGION_CODES = new Set(['US', 'AU', 'SG']);

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await paramsPromise;
  const regionCode = code.toUpperCase();
  if (!REGION_CODES.has(regionCode)) {
    return validation(`Unknown region code: ${code}`, { code });
  }

  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  if (!isCrossTenantOperator(session)) {
    if (!session.orgId) return forbidden('No org scope');
    const org = await db.org.findUnique({
      where: { id: session.orgId },
      select: { regionCode: true },
    });
    if (!org || org.regionCode !== regionCode) {
      return forbidden('Your org is not in this region');
    }
  }

  const orgWhere = {
    regionCode: regionCode as 'US' | 'AU' | 'SG',
    status: { not: 'archived' as const },
  };
  const mtdStart = startOfMonth();
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [orgs, activeKnockers, conversionsMTD, revenueAgg, leadsLast30d, conversionsLast30d] =
      await Promise.all([
        db.org.findMany({ where: orgWhere, select: { id: true } }),

        db.user.count({
          where: {
            role: 'knocker',
            status: 'active',
            regionCode: regionCode as 'US' | 'AU' | 'SG',
          },
        }),

        db.conversion.count({
          where: { regionCode: regionCode as 'US' | 'AU' | 'SG', signedAt: { gte: mtdStart } },
        }),

        db.conversion.aggregate({
          _sum: { d2dRakeCents: true, processorResidualCents: true },
          where: { regionCode: regionCode as 'US' | 'AU' | 'SG', signedAt: { gte: mtdStart } },
        }),

        db.lead.count({
          where: { regionCode: regionCode as 'US' | 'AU' | 'SG', createdAt: { gte: last30d } },
        }),

        db.conversion.count({
          where: { regionCode: regionCode as 'US' | 'AU' | 'SG', signedAt: { gte: last30d } },
        }),
      ]);

    const revenueCentsMTD =
      (revenueAgg._sum.d2dRakeCents ?? 0n) + (revenueAgg._sum.processorResidualCents ?? 0n);
    const conversionRatePct =
      leadsLast30d > 0 ? Math.round((conversionsLast30d / leadsLast30d) * 1000) / 10 : 0;

    return ok({
      regionCode,
      activeOrgs: orgs.length,
      activeKnockers,
      conversionsMTD,
      revenueCentsMTD,
      leadsLast30d,
      conversionsLast30d,
      conversionRatePct,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[api/regions/${regionCode}/overview GET] failed:`, err);
    return internal('Failed to load region overview');
  }
}
