/**
 * GET /api/regions/[code]/billing — region-scoped payment-volume rollup for
 * the regions/[code]/payments screen.
 *
 * There is no Stripe webhook-event log or payment-mandate table in the
 * schema (confirmed against schema.prisma) — those fixtures were pure
 * fabrication. What IS real: `Conversion` carries `paymentProvider` +
 * `amountCents` + rake/residual per region, and `Donation` tracks recurring
 * status. This route aggregates those instead of inventing a feed.
 *
 * Returns:
 *   - mtd: volume/rake/residual + conversion count for the region, MTD
 *   - byProvider: same, grouped by paymentProvider (stripe_au / stripe_sg /
 *     micamp) — replaces the fabricated per-rail "Stripe" vs "GoCardless"
 *     split, which the schema doesn't actually distinguish
 *   - recurringActive: count of Donation rows with an active recurring
 *     subscription in the region
 *   - lastConversion: most recent settled conversion in the region, or null
 *
 * Authorization: cross-tenant sees the region; org-scoped sees only their
 * own org's rows within it.
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

  const orgScope = isCrossTenantOperator(session) ? undefined : (session.orgId as string);
  const mtdStart = startOfMonth();
  const conversionWhere = {
    regionCode: regionCode as 'US' | 'AU' | 'SG',
    ...(orgScope ? { orgId: orgScope } : {}),
  };

  try {
    const [mtdAgg, byProvider, recurringActive, lastConversion] = await Promise.all([
      db.conversion.aggregate({
        where: { ...conversionWhere, signedAt: { gte: mtdStart } },
        _sum: { amountCents: true, d2dRakeCents: true, processorResidualCents: true },
        _count: { _all: true },
      }),

      db.conversion.groupBy({
        by: ['paymentProvider'],
        where: { ...conversionWhere, signedAt: { gte: mtdStart } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),

      db.donation.count({
        where: {
          status: 'active',
          frequency: { not: null },
          conversion: conversionWhere,
        },
      }),

      db.conversion.findFirst({
        where: conversionWhere,
        orderBy: { signedAt: 'desc' },
        select: { signedAt: true, paymentProvider: true, amountCents: true },
      }),
    ]);

    return ok({
      regionCode,
      mtd: {
        volumeCents: mtdAgg._sum.amountCents ?? 0n,
        rakeCents: mtdAgg._sum.d2dRakeCents ?? 0n,
        residualCents: mtdAgg._sum.processorResidualCents ?? 0n,
        conversionCount: mtdAgg._count._all,
      },
      byProvider: byProvider.map((p) => ({
        provider: p.paymentProvider,
        volumeCents: p._sum.amountCents ?? 0n,
        count: p._count._all,
      })),
      recurringActive,
      lastConversion: lastConversion
        ? {
            signedAt: lastConversion.signedAt,
            provider: lastConversion.paymentProvider,
            amountCents: lastConversion.amountCents,
          }
        : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[api/regions/${regionCode}/billing GET] failed:`, err);
    return internal('Failed to load region billing summary');
  }
}
