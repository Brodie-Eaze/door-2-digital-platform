/**
 * GET /api/compliance — paid-solicitor registration state matrix +
 * active-regulation metadata for the Compliance screen.
 *
 * Returns:
 *   - registrations: all PaidSolicitorRegistration rows (for the
 *     matrix); status = approved | submitted | pending | expired | rejected
 *   - approvedCount / pendingCount: derived totals used by the KPI rail
 *
 * Authorization: only super_admin (cross-tenant) has the full compliance
 * picture (registrations belong to the operator's platform org, not to
 * sub-accounts). An org-scoped session returns an empty set — they should
 * be using the per-account /accounts/[slug]/compliance screen instead.
 *
 * Cached 60 s — clearance statuses change rarely (filed + approved events
 * are operator-driven).
 */
import { db } from '@d2d/database';
import { internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  try {
    if (!isCrossTenantOperator(session)) {
      // Org-scoped callers should not see platform-level registrations;
      // return an authoritative empty payload rather than 403 so the UI
      // can render its graceful empty state without an error boundary.
      return ok({ registrations: [], approvedCount: 0, pendingCount: 0 });
    }

    const registrations = await db.paidSolicitorRegistration.findMany({
      orderBy: [{ state: 'asc' }],
      select: {
        id: true,
        state: true,
        regionCode: true,
        status: true,
        filedAt: true,
        approvedAt: true,
        expiresAt: true,
        bondAmountCents: true,
        registrationNumber: true,
        notes: true,
      },
    });

    const approvedCount = registrations.filter((r) => r.status === 'approved').length;
    const pendingCount = registrations.filter((r) => r.status !== 'approved').length;

    return ok({
      registrations: registrations.map((r) => ({
        id: r.id,
        state: r.state,
        regionCode: r.regionCode,
        status: r.status,
        filedAt: r.filedAt,
        approvedAt: r.approvedAt,
        expiresAt: r.expiresAt,
        bondAmountCents: r.bondAmountCents,
        registrationNumber: r.registrationNumber ?? null,
        notes: r.notes ?? null,
      })),
      approvedCount,
      pendingCount,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/compliance GET] failed:', err);
    return internal('Failed to load compliance data');
  }
}
