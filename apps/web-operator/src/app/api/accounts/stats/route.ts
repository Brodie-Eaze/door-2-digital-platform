/**
 * /api/accounts/stats — live per-account rollup (roster, MTD conversions, MTD
 * revenue, active territories), keyed by slug. Lets the portfolio tables
 * (regions/*, invoices, compliance, the switcher) show real per-org numbers
 * instead of the seed fleet. Tenant-scoped: cross-tenant operators see every
 * org; an org-scoped caller sees only their own.
 *
 * A few groupBy aggregates, not N per-account queries. Money is BigInt cents
 * serialized as a decimal string.
 */
import { db } from '@d2d/database';
import { internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface AccountStat {
  slug: string;
  knockers: number;
  conversionsMTD: number;
  revenueCentsMTD: string; // BigInt cents as decimal string
  territoriesActive: number;
}

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
    ? { status: { not: 'archived' as const }, slug: { not: null } }
    : session.orgId
      ? { id: session.orgId, slug: { not: null } }
      : { id: '__no_org__' };

  const monthStart = startOfMonth();

  try {
    const orgs = await db.org.findMany({ where: orgWhere, select: { id: true, slug: true } });
    const idToSlug = new Map<string, string>();
    for (const o of orgs) if (o.slug) idToSlug.set(o.id, o.slug);
    const orgIds = [...idToSlug.keys()];

    if (orgIds.length === 0) return ok({ stats: [] as AccountStat[] });

    const [knockerRows, convRows, territoryRows] = await Promise.all([
      db.user.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds }, role: 'knocker', status: 'active' },
        _count: { _all: true },
      }),
      db.conversion.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds }, signedAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { d2dRakeCents: true, processorResidualCents: true },
      }),
      db.territory.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds } },
        _count: { _all: true },
      }),
    ]);

    const knockerBy = new Map(knockerRows.map((r) => [r.orgId, r._count._all]));
    const convBy = new Map(
      convRows.map((r) => [
        r.orgId,
        {
          count: r._count._all,
          revenue: (r._sum.d2dRakeCents ?? 0n) + (r._sum.processorResidualCents ?? 0n),
        },
      ]),
    );
    const terrBy = new Map(territoryRows.map((r) => [r.orgId, r._count._all]));

    const stats: AccountStat[] = orgs
      .filter((o): o is typeof o & { slug: string } => Boolean(o.slug))
      .map((o) => {
        const conv = convBy.get(o.id);
        return {
          slug: o.slug,
          knockers: knockerBy.get(o.id) ?? 0,
          conversionsMTD: conv?.count ?? 0,
          revenueCentsMTD: (conv?.revenue ?? 0n).toString(),
          territoriesActive: terrBy.get(o.id) ?? 0,
        };
      });

    return ok({ stats });
  } catch (err) {
    console.error('[api/accounts/stats GET] failed:', err);
    return internal('Failed to load account stats');
  }
}
