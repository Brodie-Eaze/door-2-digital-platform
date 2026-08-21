/**
 * GET /api/regions/[code]/territory-intel — region-scoped Territory +
 * PropensityScore rollup for the regions/[code]/territory-intel screen.
 *
 * Mirrors the query shape of /api/territories (read that file for the
 * per-org propensity derivation) but scoped by `regionCode` across every
 * org in the region instead of a single tenant — a region view spans
 * orgs, so it can't pin to one `orgId`.
 *
 * Returns:
 *   - territories: real Territory rows for the region (id, name, org,
 *     vertical, status) — no fabricated SEIFA/income decile, no fabricated
 *     "knockable doors" count
 *   - scores: PropensityScore rows for the region (band + score), which
 *     the page buckets into a high/medium/low distribution
 *
 * Empty-table contract: an empty result is honest — no Territory/
 * PropensityScore rows have been scored for this region yet.
 *
 * Authorization: cross-tenant sees the whole region; org-scoped sees only
 * their own org's territories within it.
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
const MAX_SCORES = 2000;

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

  try {
    const [territories, scores] = await Promise.all([
      db.territory.findMany({
        where: {
          regionCode: regionCode as 'US' | 'AU' | 'SG',
          ...(orgScope ? { orgId: orgScope } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          vertical: true,
          status: true,
          createdAt: true,
          org: { select: { tradingName: true } },
        },
      }),

      db.propensityScore.findMany({
        where: {
          regionCode: regionCode as 'US' | 'AU' | 'SG',
          ...(orgScope ? { orgId: orgScope } : {}),
        },
        orderBy: { computedAt: 'desc' },
        take: MAX_SCORES,
        select: { geoKey: true, score: true, band: true, modelName: true, computedAt: true },
      }),
    ]);

    return ok({
      regionCode,
      territories: territories.map((t) => ({
        id: t.id,
        name: t.name,
        orgTradingName: t.org.tradingName,
        vertical: t.vertical,
        status: t.status,
        createdAt: t.createdAt,
      })),
      scores,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[api/regions/${regionCode}/territory-intel GET] failed:`, err);
    return internal('Failed to load region territory intelligence');
  }
}
