/**
 * GET /api/propensity — the platform-wide PROPENSITY HEATMAP feed for
 * Territory Intel. Same signal as the per-account route
 * (/api/orgs/[slug]/propensity) but scoped like /api/territories: pinned to
 * `session.orgId`, with cross-tenant operators (super_admin) able to target
 * any org via `?orgId=`.
 *
 * Returns the target org's own PropensityScore rows UNION the global
 * baseline (orgId IS NULL) for that org's region — a brand-new org still
 * sees the platform-wide propensity surface. Tenant rows win on the wire;
 * the client de-dupes by geoKey, preferring org-scoped.
 *
 * Optional bbox filter: ?bbox=minLng,minLat,maxLng,maxLat clips to the
 * current map viewport so we never ship the whole country to the browser.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  isCrossTenantOperator,
  notFound,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';

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

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context — cannot load propensity scores');
  }

  const bbox = parseBbox(req.nextUrl.searchParams.get('bbox'));
  if (bbox === 'invalid') {
    return validation('bbox must be "minLng,minLat,maxLng,maxLat" in WGS84 order');
  }

  try {
    const org = await db.org.findUnique({
      where: { id: targetOrgId },
      select: { id: true, regionCode: true },
    });
    if (!org) return notFound('Org', targetOrgId);

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
    console.error('[api/propensity GET] failed:', err);
    return internal('Failed to load propensity scores');
  }
}

/** Fallback banding when a row was stored without an explicit band. */
function bandFor(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'medium';
  return 'low';
}
