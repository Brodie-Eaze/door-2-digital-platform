/**
 * GET /api/regions/[code]/compliance — paid-solicitor/collector registration
 * matrix + open cooling-off windows for a region's compliance screen.
 *
 * Returns:
 *   - registrations: PaidSolicitorRegistration rows for this regionCode
 *     (mirrors /api/compliance's shape, region-scoped instead of US-only)
 *   - openCoolingOff: real Conversion rows within the region's statutory
 *     cooling-off window (10 business days AU / 5 business days SG),
 *     computed live from `signedAt` — there is no separate "cooling off"
 *     table, the window is a pure function of the conversion timestamp.
 *     Donor identity is reduced to initials (PII-first — this is a
 *     cross-tenant compliance surface, never a full name).
 *
 * Authorization: cross-tenant (super_admin) sees the whole region; an
 * org-scoped caller sees only their own org's rows within the region.
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

/** Statutory cooling-off window, in business days, per region. */
const COOLING_OFF_BUSINESS_DAYS: Record<string, number> = {
  AU: 10, // Australian Consumer Law
  SG: 5, // Consumer Protection (Fair Trading) Act
  US: 3, // FTC cooling-off rule (door-to-door sales)
};

/** Advance `from` by `days` business days (Mon-Fri, no holiday calendar). */
function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return d;
}

/** Count business days between `from` and `to` (both future, from < to). */
function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

/** "A. M****l" — initial + masked family name. Never render a full donor name
 *  on a cross-tenant compliance surface. */
function maskDonorName(givenName: string, familyName: string): string {
  const giveInitial = givenName.trim().charAt(0).toUpperCase() || '?';
  const fam = familyName.trim();
  if (fam.length <= 1) return `${giveInitial}. ${fam}`;
  return `${giveInitial}. ${fam.charAt(0).toUpperCase()}${'*'.repeat(fam.length - 1)}`;
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

  const windowDays = COOLING_OFF_BUSINESS_DAYS[regionCode] ?? 5;
  const orgScope = isCrossTenantOperator(session) ? undefined : (session.orgId as string);

  try {
    const [registrations, conversions, dnkCount, dncCount, dnkLast, activeConsentCount] =
      await Promise.all([
        db.paidSolicitorRegistration.findMany({
          where: { regionCode: regionCode as 'US' | 'AU' | 'SG' },
          orderBy: [{ state: 'asc' }],
          select: {
            id: true,
            state: true,
            status: true,
            filedAt: true,
            approvedAt: true,
            expiresAt: true,
            bondAmountCents: true,
            registrationNumber: true,
            notes: true,
          },
        }),

        // Cooling-off can only still be open within `windowDays` business days
        // (~ windowDays*2 calendar days is a safe upper bound), so we only need
        // to scan recent conversions — never the whole region's history.
        db.conversion.findMany({
          where: {
            regionCode: regionCode as 'US' | 'AU' | 'SG',
            ...(orgScope ? { orgId: orgScope } : {}),
            signedAt: { gte: new Date(Date.now() - windowDays * 2 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { signedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            signedAt: true,
            org: { select: { tradingName: true } },
            lead: {
              select: {
                givenName: true,
                familyName: true,
                address: { select: { region: true, locality: true } },
              },
            },
          },
        }),

        db.doNotKnock.count({ where: { regionCode: regionCode as 'US' | 'AU' | 'SG' } }),
        db.doNotCall.count({ where: { regionCode: regionCode as 'US' | 'AU' | 'SG' } }),
        db.doNotKnock.findFirst({
          where: { regionCode: regionCode as 'US' | 'AU' | 'SG' },
          orderBy: { loadedAt: 'desc' },
          select: { loadedAt: true },
        }),

        db.consentRecord.count({
          where: {
            granted: true,
            revokedAt: null,
            lead: {
              regionCode: regionCode as 'US' | 'AU' | 'SG',
              ...(orgScope ? { orgId: orgScope } : {}),
            },
          },
        }),
      ]);

    const approvedCount = registrations.filter((r) => r.status === 'approved').length;
    const pendingCount = registrations.filter((r) => r.status !== 'approved').length;

    const now = new Date();
    const withRelease = conversions.map((c) => {
      const releaseAt = addBusinessDays(c.signedAt, windowDays);
      const daysRemaining = businessDaysBetween(now, releaseAt);
      return {
        id: c.id,
        donor: maskDonorName(c.lead.givenName, c.lead.familyName),
        area: c.lead.address?.region || c.lead.address?.locality || '—',
        account: c.org.tradingName,
        conversionDate: c.signedAt.toISOString().slice(0, 10),
        daysRemaining,
        releaseAt,
      };
    });

    const openCoolingOff = withRelease
      .filter((w) => w.daysRemaining > 0)
      .map(({ releaseAt: _releaseAt, ...w }) => w);

    // "Released today" — window closed today, computed from the same
    // signedAt + windowDays business-day math, not a separate log.
    const releasedToday = withRelease.filter(
      (w) => w.releaseAt.toDateString() === now.toDateString(),
    ).length;

    return ok({
      regionCode,
      windowDays,
      releasedToday,
      dnkCount,
      dncCount,
      dnkLastLoadedAt: dnkLast?.loadedAt ?? null,
      activeConsentCount,
      registrations: registrations.map((r) => ({
        id: r.id,
        state: r.state,
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
      openCoolingOff,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[api/regions/${regionCode}/compliance GET] failed:`, err);
    return internal('Failed to load region compliance data');
  }
}
