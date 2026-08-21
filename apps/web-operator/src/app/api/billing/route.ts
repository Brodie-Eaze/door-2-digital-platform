/**
 * GET /api/billing — billing summary for the operator's Billing screen.
 *
 * Returns:
 *   - orgs: each org's OrgBilling config + tradingName + slug
 *   - conversionsByOrg: MTD conversion count + rake totals per org
 *   - mtdTotals: platform-wide aggregates for the KPI rail
 *
 * There is no dedicated Invoice model in the current schema — platform
 * invoices are computed on-the-fly from OrgBilling + Conversion aggregates.
 * A future schema migration will add a BillingInvoice model; at that point
 * this route can query it directly.
 *
 * Authorization: only super_admin (cross-tenant) sees all orgs' billing.
 * Org-scoped sessions see only their own org's billing row.
 *
 * Cached 0 s — billing figures must be current.
 */
import { db } from '@d2d/database';
import { internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgWhere = isCrossTenantOperator(session)
    ? { status: { not: 'archived' as const } }
    : { id: session.orgId ?? '__none__', status: { not: 'archived' as const } };

  try {
    const orgs = await db.org.findMany({
      where: orgWhere,
      select: {
        id: true,
        slug: true,
        tradingName: true,
        regionCode: true,
        billing: {
          select: {
            platformFeeMonthlyCents: true,
            doorRakePercent: true,
            insideSalesRakePercent: true,
            retargetingRakePercent: true,
            billingDay: true,
            currency: true,
          },
        },
      },
    });

    const orgIds = orgs.map((o) => o.id);
    const mtdStart = startOfMonth();

    // MTD conversion aggregates per org — keyed by orgId.
    // d2dRakeCents already incorporates the per-attribution-bucket rake; we
    // also surface processorResidualCents separately for the MiCamp row.
    const convAgg = await db.conversion.groupBy({
      by: ['orgId', 'attributionSource'],
      where: { orgId: { in: orgIds }, signedAt: { gte: mtdStart } },
      _sum: { d2dRakeCents: true, processorResidualCents: true, amountCents: true },
      _count: { _all: true },
    });

    // Structure: orgId → { door, insideSales, retargeting, residual, volume, count }
    type OrgAgg = {
      doorRakeCents: bigint;
      insideSalesRakeCents: bigint;
      retargetingRakeCents: bigint;
      processorResidualCents: bigint;
      volumeCents: bigint;
      count: number;
    };
    const aggByOrg = new Map<string, OrgAgg>();

    for (const row of convAgg) {
      const existing = aggByOrg.get(row.orgId) ?? {
        doorRakeCents: 0n,
        insideSalesRakeCents: 0n,
        retargetingRakeCents: 0n,
        processorResidualCents: 0n,
        volumeCents: 0n,
        count: 0,
      };
      const rake = row._sum.d2dRakeCents ?? 0n;
      const residual = row._sum.processorResidualCents ?? 0n;
      const volume = row._sum.amountCents ?? 0n;
      const count = row._count._all;

      // Attribution source drives the billing bucket.
      if (row.attributionSource === 'door') {
        existing.doorRakeCents += rake;
      } else if (row.attributionSource === 'inside_sales') {
        existing.insideSalesRakeCents += rake;
      } else if (row.attributionSource === 'retargeting') {
        existing.retargetingRakeCents += rake;
      } else {
        // organic / unknown — fold into door bucket
        existing.doorRakeCents += rake;
      }
      existing.processorResidualCents += residual;
      existing.volumeCents += volume;
      existing.count += count;
      aggByOrg.set(row.orgId, existing);
    }

    // Platform-wide MTD totals
    let totalPlatformFeeCents = 0n;
    let totalDoorRakeCents = 0n;
    let totalInsideSalesRakeCents = 0n;
    let totalRetargetingRakeCents = 0n;
    let totalResidualCents = 0n;

    const orgSummaries = orgs.map((o) => {
      const agg = aggByOrg.get(o.id) ?? {
        doorRakeCents: 0n,
        insideSalesRakeCents: 0n,
        retargetingRakeCents: 0n,
        processorResidualCents: 0n,
        volumeCents: 0n,
        count: 0,
      };
      const platformFee = o.billing?.platformFeeMonthlyCents ?? 0n;
      totalPlatformFeeCents += platformFee;
      totalDoorRakeCents += agg.doorRakeCents;
      totalInsideSalesRakeCents += agg.insideSalesRakeCents;
      totalRetargetingRakeCents += agg.retargetingRakeCents;
      totalResidualCents += agg.processorResidualCents;

      return {
        orgId: o.id,
        slug: o.slug ?? o.id,
        tradingName: o.tradingName,
        regionCode: o.regionCode,
        billing: o.billing
          ? {
              platformFeeMonthlyCents: o.billing.platformFeeMonthlyCents,
              doorRakePercent: o.billing.doorRakePercent.toString(),
              insideSalesRakePercent: o.billing.insideSalesRakePercent.toString(),
              retargetingRakePercent: o.billing.retargetingRakePercent.toString(),
              billingDay: o.billing.billingDay,
              currency: o.billing.currency,
            }
          : null,
        mtd: {
          conversionCount: agg.count,
          doorRakeCents: agg.doorRakeCents,
          insideSalesRakeCents: agg.insideSalesRakeCents,
          retargetingRakeCents: agg.retargetingRakeCents,
          processorResidualCents: agg.processorResidualCents,
          volumeCents: agg.volumeCents,
          totalBilledCents:
            platformFee + agg.doorRakeCents + agg.insideSalesRakeCents + agg.retargetingRakeCents,
        },
      };
    });

    return ok({
      orgs: orgSummaries,
      mtdTotals: {
        platformFeeCents: totalPlatformFeeCents,
        doorRakeCents: totalDoorRakeCents,
        insideSalesRakeCents: totalInsideSalesRakeCents,
        retargetingRakeCents: totalRetargetingRakeCents,
        processorResidualCents: totalResidualCents,
        totalBilledCents:
          totalPlatformFeeCents +
          totalDoorRakeCents +
          totalInsideSalesRakeCents +
          totalRetargetingRakeCents,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/billing GET] failed:', err);
    return internal('Failed to load billing summary');
  }
}
