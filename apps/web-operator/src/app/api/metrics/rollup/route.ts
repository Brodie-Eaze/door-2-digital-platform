/**
 * /api/metrics/rollup — live headline rollup for the Command Centre KPIs that
 * are NOT today-scoped (week / MTD conversions, MTD revenue, roster size,
 * territory count, active-account count). Companion to /api/metrics/realtime
 * (which owns the today counters). Together they let the Command Centre run
 * entirely on live Prisma with zero seed/fixture numbers.
 *
 * Tenant scoping mirrors /api/metrics/realtime: cross-tenant operators
 * (super_admin) get the all-org rollup and may narrow with ?orgId=; everyone
 * else is pinned to their own org.
 *
 * Graceful by design — empty tables return honest zeros, not an error.
 * `totalRevenueCentsMTD` is serialized as a decimal STRING (money is BigInt
 * cents on the wire; JSON has no bigint).
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface RollupMetrics {
  totalReps: number;
  activeAccounts: number;
  totalConvWeek: number;
  totalConvMTD: number;
  totalRevenueCentsMTD: string; // BigInt cents as a decimal string
  totalTerritories: number;
  updatedAt: string;
}

/** Local-clock start of the current ISO week (Monday 00:00:00.000). */
function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

/** Local-clock start of the current month. */
function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const requestedOrgId = req.nextUrl.searchParams.get('orgId');
  const crossTenant = isCrossTenantOperator(session);
  const orgFilter: { orgId: string } | Record<string, never> | null = crossTenant
    ? requestedOrgId
      ? { orgId: requestedOrgId }
      : {}
    : session.orgId
      ? { orgId: session.orgId }
      : null;

  if (orgFilter === null) {
    return forbidden('No org context');
  }

  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  try {
    const [totalReps, activeAccounts, totalConvWeek, totalConvMTD, revenueAgg, totalTerritories] =
      await Promise.all([
        db.user.count({ where: { ...orgFilter, role: 'knocker', status: 'active' } }),
        // Active-account count: all non-archived orgs for a cross-tenant operator;
        // exactly the caller's own org (1) otherwise.
        crossTenant && !requestedOrgId
          ? db.org.count({ where: { status: { not: 'archived' } } })
          : Promise.resolve(1),
        db.conversion.count({ where: { ...orgFilter, signedAt: { gte: weekStart } } }),
        db.conversion.count({ where: { ...orgFilter, signedAt: { gte: monthStart } } }),
        db.conversion.aggregate({
          _sum: { d2dRakeCents: true, processorResidualCents: true },
          where: { ...orgFilter, signedAt: { gte: monthStart } },
        }),
        db.territory.count({ where: { ...orgFilter } }),
      ]);

    const revenue =
      (revenueAgg._sum.d2dRakeCents ?? 0n) + (revenueAgg._sum.processorResidualCents ?? 0n);

    const body: RollupMetrics = {
      totalReps,
      activeAccounts,
      totalConvWeek,
      totalConvMTD,
      totalRevenueCentsMTD: revenue.toString(),
      totalTerritories,
      updatedAt: new Date().toISOString(),
    };
    return ok(body);
  } catch (err) {
    console.error('[api/metrics/rollup GET] failed:', err);
    return internal('Failed to load rollup metrics');
  }
}
