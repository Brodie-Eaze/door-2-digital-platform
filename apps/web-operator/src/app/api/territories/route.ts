/**
 * /api/territories — tenant-scoped territory propensity feed for Territory Intel.
 *
 * GET  Returns every Territory for the caller's org together with a real
 *      propensity signal computed from the Knock table:
 *        - knocks        = total knocks ever recorded in the territory
 *        - conversions   = knocks whose disposition is a converted outcome
 *                          (converted_donation | converted_sale) OR an
 *                          appointment (counted at half weight as a soft win)
 *        - propensity    = recency-weighted conversion rate in [0,1]
 *        - saturation    = how worked the territory is, normalised against the
 *                          busiest territory in the org (0–100%)
 *
 * Propensity blends raw historical conversion rate with a recency lift: knocks
 * in the trailing 30 days are weighted 1.5× so a territory that is converting
 * NOW ranks above one that converted last quarter. With zero knocks we fall
 * back to the Territory.metadata.basePropensity (seeded ACS/SEIFA prior) when
 * present, else 0 — the page then keeps the fixture heatmap.
 *
 * Tenant scope: every read is scoped to session.orgId. Cross-tenant operators
 * (super_admin) may pass ?orgId= to target a sub-account.
 *
 * Geo columns (polygon/centroid) are TEXT placeholders in the dev DB (PostGIS
 * not yet enabled — see schema note on model Territory). We parse them
 * defensively and never block on a malformed value.
 *
 * Empty-table contract: if the org has no Territory rows we return
 * { territories: [], updatedAt } so the page falls back to fixture cells.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Dispositions that count as a full conversion for propensity. */
const CONVERTED = new Set<string>(['converted_donation', 'converted_sale']);
/** Soft-win dispositions counted at half weight (intent, not yet closed). */
const SOFT_WIN = new Set<string>(['appointment']);

const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RECENCY_WEIGHT = 1.5;

type Centroid = { lat: number; lng: number } | null;

/**
 * Defensive centroid parser. The dev DB stores centroid as TEXT, so it may be:
 *   - JSON: {"lat":30.2,"lng":-97.7}  (or {lat,lon} / {y,x})
 *   - CSV : "30.2,-97.7"  (lat,lng)
 *   - WKT : "POINT(-97.7 30.2)"  (lng lat, GeoJSON axis order)
 * Anything unparseable yields null — never throws.
 */
function parseCentroid(raw: string | null | undefined): Centroid {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // JSON object
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      const lat = num(o.lat ?? o.latitude ?? o.y);
      const lng = num(o.lng ?? o.lon ?? o.long ?? o.longitude ?? o.x);
      if (lat != null && lng != null) return { lat, lng };
    } catch {
      /* fall through */
    }
    return null;
  }

  // WKT POINT(lng lat)
  const wkt = /^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i.exec(s);
  if (wkt) {
    const lng = Number(wkt[1]);
    const lat = Number(wkt[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }

  // CSV "lat,lng"
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Pull a seeded prior out of Territory.metadata if the model is unscored. */
function basePropensityFromMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const p = num(m.basePropensity ?? m.propensity ?? m.priorPropensity);
  if (p == null) return null;
  // Allow either 0–1 or 0–100 scaled priors.
  if (p > 1) return Math.min(1, p / 100);
  return Math.max(0, Math.min(1, p));
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context — cannot load territories');
  }

  try {
    const territories = await db.territory.findMany({
      where: { orgId: targetOrgId },
      select: {
        id: true,
        name: true,
        regionCode: true,
        vertical: true,
        status: true,
        metadata: true,
        centroid: true,
        polygon: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (territories.length === 0) {
      // Empty table → page keeps the fixture heatmap.
      return ok({ territories: [], updatedAt: new Date().toISOString() });
    }

    // Pull knock rows for the org scoped to these territories. We only need the
    // disposition, territoryId and capturedAt to compute the signal — never any
    // PII (notes/photos stay in the DB). Cap defensively so a huge org can't
    // pull millions of rows into the BFF; the signal converges well before that.
    const territoryIds = territories.map((t) => t.id);
    const knocks = await db.knock.findMany({
      where: { orgId: targetOrgId, territoryId: { in: territoryIds } },
      select: { territoryId: true, disposition: true, capturedAt: true },
      take: 50_000,
      orderBy: { capturedAt: 'desc' },
    });

    const now = Date.now();
    type Acc = { knocks: number; weightedTotal: number; weightedConv: number };
    const byTerritory = new Map<string, Acc>();
    for (const id of territoryIds) {
      byTerritory.set(id, { knocks: 0, weightedTotal: 0, weightedConv: 0 });
    }

    for (const k of knocks) {
      const acc = byTerritory.get(k.territoryId);
      if (!acc) continue;
      const recent = now - new Date(k.capturedAt).getTime() <= RECENCY_WINDOW_MS;
      const w = recent ? RECENCY_WEIGHT : 1;
      acc.knocks += 1;
      acc.weightedTotal += w;
      const d = k.disposition as unknown as string;
      if (CONVERTED.has(d)) acc.weightedConv += w;
      else if (SOFT_WIN.has(d)) acc.weightedConv += w * 0.5;
    }

    const maxKnocks = Math.max(1, ...Array.from(byTerritory.values()).map((a) => a.knocks));

    const rows = territories.map((t) => {
      const acc = byTerritory.get(t.id) ?? { knocks: 0, weightedTotal: 0, weightedConv: 0 };
      // Count raw conversions (unweighted) for the human-readable figure.
      const conversions = knocks.filter(
        (k) => k.territoryId === t.id && CONVERTED.has(k.disposition as unknown as string),
      ).length;

      let propensity: number;
      if (acc.weightedTotal > 0) {
        propensity = Math.max(0, Math.min(1, acc.weightedConv / acc.weightedTotal));
      } else {
        propensity = basePropensityFromMetadata(t.metadata) ?? 0;
      }

      const saturation = Math.round((acc.knocks / maxKnocks) * 100);
      const centroid = parseCentroid(t.centroid);

      return {
        id: t.id,
        name: t.name,
        regionCode: t.regionCode,
        vertical: t.vertical,
        status: t.status,
        propensity: Math.round(propensity * 100) / 100,
        knocks: acc.knocks,
        conversions,
        saturation,
        centroid, // {lat,lng} | null — defensive parse of TEXT geo column
      };
    });

    return ok({ territories: rows, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/territories GET] failed:', err);
    return internal('Failed to load territories');
  }
}
