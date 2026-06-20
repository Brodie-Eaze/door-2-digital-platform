/**
 * GET /api/orgs/[slug]/propensity — the NEIGHBOURHOOD PROPENSITY HEATMAP feed
 * for the per-account canvass-area tool.
 *
 * Returns this tenant's PropensityScore rows (orgId = org.id) UNION the global
 * baseline (orgId IS NULL) for the same region, so a brand-new account still
 * sees the platform-wide propensity surface that informs WHERE to set a canvass
 * area. Tenant rows win on the wire (they're appended last + carry the org's
 * own model output); the client de-dupes by geoKey, preferring org-scoped.
 *
 * This is READ-ONLY intel — it never targets individual houses, only colours
 * neighbourhoods so the manager can draw the AREA reps will canvass. Mirrors
 * the BFF pattern of the sibling territories routes: requireSession →
 * resolveAccountOrg → Prisma, scoped, RFC 7807 errors.
 *
 * Optional bbox filter: ?bbox=minLng,minLat,maxLng,maxLat clips to the current
 * viewport so we never ship the whole country to the browser.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg, validation } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Hard cap so a misconfigured model run can never flood the client.
const MAX_POINTS = 2000;

interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Parse `?bbox=minLng,minLat,maxLng,maxLat` → Bbox, or null when absent. */
function parseBbox(raw: string | null): Bbox | null | 'invalid' {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return 'invalid';
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLng > maxLng || minLat > maxLat) return 'invalid';
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return 'invalid';
  return { minLng, minLat, maxLng, maxLat };
}

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  const bbox = parseBbox(new URL(req.url).searchParams.get('bbox'));
  if (bbox === 'invalid') {
    return validation('bbox must be "minLng,minLat,maxLng,maxLat" in WGS84 order');
  }

  try {
    const rows = await db.propensityScore.findMany({
      where: {
        // Tenant's own scores OR the global baseline; never another org's.
        OR: [{ orgId: org.id }, { orgId: null }],
        regionCode: org.regionCode,
        centroidLat: { not: null, ...(bbox ? { gte: bbox.minLat, lte: bbox.maxLat } : {}) },
        centroidLng: { not: null, ...(bbox ? { gte: bbox.minLng, lte: bbox.maxLng } : {}) },
      },
      // Org-scoped rows last so the client's de-dupe keeps the tenant's own.
      orderBy: [{ orgId: 'asc' }, { score: 'desc' }],
      take: MAX_POINTS,
      select: {
        geoKey: true,
        geoType: true,
        orgId: true,
        centroidLat: true,
        centroidLng: true,
        score: true,
        band: true,
        modelName: true,
        modelVersion: true,
      },
    });

    // Prefer the org-scoped row for any geoKey present in both sets.
    const byKey = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const existing = byKey.get(r.geoKey);
      if (!existing || (r.orgId !== null && existing.orgId === null)) {
        byKey.set(r.geoKey, r);
      }
    }
    const deduped = [...byKey.values()];

    const points = deduped.map((r) => ({
      geoKey: r.geoKey,
      geoType: r.geoType,
      centroidLat: r.centroidLat,
      centroidLng: r.centroidLng,
      score: r.score,
      band: r.band ?? bandFor(r.score),
      scoped: r.orgId !== null,
    }));

    const modelName =
      deduped.find((r) => r.orgId === org.id)?.modelName ?? deduped[0]?.modelName ?? null;
    const modelVersion =
      deduped.find((r) => r.orgId === org.id)?.modelVersion ?? deduped[0]?.modelVersion ?? null;

    return ok({
      orgId: org.id,
      regionCode: org.regionCode,
      modelName,
      modelVersion,
      count: points.length,
      points,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/propensity GET] failed:', err);
    return internal('Failed to load propensity scores');
  }
}

/** Fallback banding when a row was stored without an explicit band. */
function bandFor(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'medium';
  return 'low';
}
