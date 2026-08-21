/**
 * GET /api/overview — cross-tenant KPI summary for the operator's home screen.
 *
 * Aggregates:
 *   - activeOrgs: non-archived org count (super_admin sees all; org-scoped sees 1)
 *   - activeKnockers: User rows with role=knocker + status=active
 *   - conversionsMTD: Conversion rows signed this calendar month
 *   - revenueCentsMTD: sum(d2dRakeCents + processorResidualCents) MTD
 *   - anomalies: PaidSolicitorRegistration rows with status NOT approved,
 *     capped at 10 (the UI renders them as AnomalyCard entries)
 *
 * Authorization: mirrors /api/orgs — super_admin sees every org;
 * everyone else is pinned to their own orgId.
 *
 * Cached 30 s (same as health-summary) — suitable for a mission-control
 * view that auto-refreshes on mount.
 */
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Only super_admin (cross-tenant) has a meaningful cross-org overview.
  // An org-scoped user landing here still gets their own org's data.
  if (!isCrossTenantOperator(session) && !session.orgId) {
    return forbidden('No org scope');
  }

  const orgWhere = isCrossTenantOperator(session)
    ? { status: { not: 'archived' as const }, slug: { not: null } }
    : { id: session.orgId!, status: { not: 'archived' as const } };

  try {
    const [orgs, activeKnockers, conversionsMTD, revenueAgg, pendingRegistrations] =
      await Promise.all([
        db.org.findMany({ where: orgWhere, select: { id: true } }),

        db.user.count({
          where: {
            role: 'knocker',
            status: 'active',
            ...(isCrossTenantOperator(session) ? {} : { orgId: session.orgId! }),
          },
        }),

        db.conversion.count({
          where: {
            ...(isCrossTenantOperator(session) ? {} : { orgId: session.orgId! }),
            signedAt: { gte: startOfMonth() },
          },
        }),

        db.conversion.aggregate({
          _sum: { d2dRakeCents: true, processorResidualCents: true },
          where: {
            ...(isCrossTenantOperator(session) ? {} : { orgId: session.orgId! }),
            signedAt: { gte: startOfMonth() },
          },
        }),

        // Pending paid-solicitor registrations → surface as anomalies.
        // Scoped to registrations where the entityOrgId belongs to orgs
        // visible to this session (or all orgs for super_admin).
        db.paidSolicitorRegistration.findMany({
          where: {
            status: { not: 'approved' },
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
          select: {
            id: true,
            state: true,
            status: true,
            filedAt: true,
            createdAt: true,
            notes: true,
          },
        }),
      ]);

    const rakeMTD =
      (revenueAgg._sum.d2dRakeCents ?? 0n) + (revenueAgg._sum.processorResidualCents ?? 0n);

    return ok({
      activeOrgs: orgs.length,
      activeKnockers,
      conversionsMTD,
      revenueCentsMTD: rakeMTD,
      // Anomaly shaping for the UI — map status → severity
      anomalies: pendingRegistrations.map((r) => ({
        id: r.id,
        state: r.state,
        status: r.status,
        filedAt: r.filedAt,
        createdAt: r.createdAt,
        notes: r.notes ?? null,
        severity:
          r.status === 'rejected'
            ? ('critical' as const)
            : r.status === 'pending'
              ? ('warning' as const)
              : ('info' as const),
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/overview GET] failed:', err);
    return internal('Failed to load overview summary');
  }
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
