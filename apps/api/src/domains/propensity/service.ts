/**
 * Propensity service — the ML <-> platform read/write interface for
 * neighbourhood propensity scores.
 *
 * ┌─ CONTRACT FOR DATA SCIENTISTS ────────────────────────────────────────────┐
 * │ WRITE  (ML team):    writeScores() — batch upsert by (orgId, geoType,      │
 * │                      geoKey). orgId = the principal's org, or NULL when    │
 * │                      `global:true` (super_admin only) for shared models    │
 * │                      that every org sees.                                  │
 * │ READ   (platform):   listScores() / heatmap() — return rows visible to the │
 * │                      caller = (orgId == caller.org OR orgId IS NULL).      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * TENANCY NOTE — why reads use the RAW `prisma()` client, not the tenant-scoped
 * `$extends` injector:
 *   The injector force-ANDs `where.orgId = caller.org` onto every query, which
 *   would EXCLUDE the shared/global rows (orgId IS NULL) that this domain is
 *   explicitly designed to surface to every org. The visibility predicate here
 *   is `orgId IN (caller.org, NULL)`, which the injector cannot express. We
 *   therefore build that OR-filter by hand on the raw client and NEVER read an
 *   arbitrary orgId from the request — the only orgId in the filter is the
 *   authenticated principal's. (PropensityScore is post-dated relative to the
 *   rls_belt migration, so it carries no RLS policy yet; this app-layer filter
 *   is the read enforcement. Org-specific WRITES still go through tenantTx.)
 *
 * Scores carry no PII (they are aggregate neighbourhood signals), so there is
 * no vault/HMAC handling here.
 */
import { Prisma } from '@prisma/client';
import type { RegionCode } from '@prisma/client';
import { newId } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type { Band, HeatmapQuery, ListScoresQuery, WriteScoresRequest } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  role: string;
  regionCode: RegionCode;
}

/**
 * The read shape returned by GET / — the full score record minus internal-only
 * columns (orgId/regionCode are caller-scoped, not echoed). `features` is
 * intentionally NOT returned here to keep the list-tile response light; fetch
 * a single score's features via a dedicated lookup if/when that lands.
 */
export interface ScorePublic {
  id: string;
  geoType: string;
  geoKey: string;
  centroidLat: number | null;
  centroidLng: number | null;
  score: number;
  band: string | null;
  modelName: string;
  modelVersion: string;
  computedAt: string;
}

/** Compact heatmap point — only what a map layer needs to colour a cell. */
export interface HeatmapPoint {
  lat: number;
  lng: number;
  score: number;
  band: string | null;
}

const BAND_HIGH = 0.66;
const BAND_MEDIUM = 0.33;

/**
 * Derive the heatmap band from a 0..1 score when the ML team omits it.
 * >=0.66 high, >=0.33 medium, else low. Kept here (not the DB) so the band
 * thresholds are versioned with the read/write contract, not the schema.
 */
function deriveBand(score: number): Band {
  if (score >= BAND_HIGH) return 'high';
  if (score >= BAND_MEDIUM) return 'medium';
  return 'low';
}

/** Parse `minLng,minLat,maxLng,maxLat` into numbers (already regex-validated). */
function parseBbox(bbox: string): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number) as [
    number,
    number,
    number,
    number,
  ];
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * The org-OR-global visibility filter. Always pinned to the authenticated
 * principal's org plus the shared (NULL) rows — never an attacker-supplied id.
 */
function visibilityWhere(orgId: string): Prisma.PropensityScoreWhereInput {
  return { OR: [{ orgId }, { orgId: null }] };
}

/**
 * Add a centroid-within-bbox constraint. A score is included only when BOTH
 * centroid coordinates are present and fall inside the box, so NULL-centroid
 * rows are excluded from spatial queries (they can't be placed on a map).
 */
function applyBboxFilter(
  where: Prisma.PropensityScoreWhereInput,
  bbox: string | undefined,
): Prisma.PropensityScoreWhereInput {
  if (!bbox) return where;
  const { minLng, minLat, maxLng, maxLat } = parseBbox(bbox);
  return {
    ...where,
    centroidLng: { gte: minLng, lte: maxLng },
    centroidLat: { gte: minLat, lte: maxLat },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// READS — platform consumes (heatmaps + manager area-setting)
// ───────────────────────────────────────────────────────────────────────────

export async function listScores(
  query: ListScoresQuery,
  actor: ActorContext,
): Promise<{ data: ScorePublic[]; nextCursor: string | null }> {
  let where = visibilityWhere(actor.orgId);
  if (query.geoType) where.geoType = query.geoType;
  if (query.band) where.band = query.band;
  where = applyBboxFilter(where, query.bbox);

  const rows = await prisma().propensityScore.findMany({
    where,
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
  });
  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toPublic), nextCursor };
}

export async function heatmap(query: HeatmapQuery, actor: ActorContext): Promise<HeatmapPoint[]> {
  let where = visibilityWhere(actor.orgId);
  where.geoType = query.geoType; // defaults to 'h3' in the schema
  where = applyBboxFilter(where, query.bbox);
  // The heatmap can only plot rows that have a centroid — require both coords.
  where.centroidLat = { ...(where.centroidLat as object), not: null };
  where.centroidLng = { ...(where.centroidLng as object), not: null };

  const rows = await prisma().propensityScore.findMany({
    where,
    take: query.limit,
    orderBy: { id: 'asc' },
    select: { centroidLat: true, centroidLng: true, score: true, band: true },
  });

  const points: HeatmapPoint[] = [];
  for (const r of rows) {
    if (r.centroidLat === null || r.centroidLng === null) continue;
    points.push({
      lat: r.centroidLat,
      lng: r.centroidLng,
      score: r.score,
      band: r.band ?? deriveBand(r.score),
    });
  }
  return points;
}

// ───────────────────────────────────────────────────────────────────────────
// WRITE — ML team produces (batch upsert)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Batch upsert scores written back by the ML pipeline.
 *
 * `global` (super_admin only — enforced at the route) targets the shared
 * orgId=NULL rows every org reads; otherwise rows are written under the
 * principal's org.
 *
 * Upsert key is (orgId, geoType, geoKey). PropensityScore has NO unique
 * constraint on that triple (only a non-unique index), so we cannot use
 * Prisma `upsert` (it needs a unique selector). Instead we read the existing
 * row id within the tenant transaction and update it, or create a fresh
 * pps_* row — both inside ONE transaction so the batch is atomic.
 */
export async function writeScores(
  input: WriteScoresRequest,
  actor: ActorContext,
): Promise<{ upserted: number }> {
  const isGlobal = input.global === true;
  // orgId for the rows: NULL for global (shared) writes, else the principal's.
  const targetOrgId: string | null = isGlobal ? null : actor.orgId;

  // Global rows (orgId IS NULL) can't be written through tenantTx — that helper
  // sets app.current_org_id and is meant for org-pinned RLS writes. We run the
  // global path on a plain transaction. Org-scoped writes use tenantTx so the
  // GUC + (future) RLS policy pins every row to the caller's org.
  const runTx = isGlobal
    ? <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma().$transaction(fn)
    : <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => tenantTx(actor.orgId, fn);

  const upserted = await runTx(async (tx) => {
    let count = 0;
    for (const s of input.scores) {
      const band = s.band ?? deriveBand(s.score);
      const features =
        s.features !== undefined ? (s.features as Prisma.InputJsonValue) : Prisma.DbNull;

      // Look up the existing row for this (orgId, geoType, geoKey) tuple. We
      // match orgId explicitly (NULL for global) so an org write never collides
      // with a global row and vice-versa.
      const existing = await tx.propensityScore.findFirst({
        where: { orgId: targetOrgId, geoType: s.geoType, geoKey: s.geoKey },
        select: { id: true },
      });

      if (existing) {
        await tx.propensityScore.update({
          where: { id: existing.id },
          data: {
            centroidLat: s.centroidLat ?? null,
            centroidLng: s.centroidLng ?? null,
            score: s.score,
            band,
            modelName: input.modelName,
            modelVersion: input.modelVersion,
            features,
            computedAt: new Date(),
          },
        });
      } else {
        await tx.propensityScore.create({
          data: {
            id: newId('pps'),
            orgId: targetOrgId,
            regionCode: actor.regionCode,
            geoType: s.geoType,
            geoKey: s.geoKey,
            centroidLat: s.centroidLat ?? null,
            centroidLng: s.centroidLng ?? null,
            score: s.score,
            band,
            modelName: input.modelName,
            modelVersion: input.modelVersion,
            features,
          },
        });
      }
      count += 1;
    }

    await AuditService.recordEvent(tx, {
      // Global writes are platform-level events (orgId NULL); the audit chain
      // scopes them per-region. Org writes scope to the org chain.
      orgId: targetOrgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'propensity.scores_written',
      resourceType: 'PropensityScore',
      resourceId: `${input.modelName}@${input.modelVersion}`,
      afterJson: {
        modelName: input.modelName,
        modelVersion: input.modelVersion,
        global: isGlobal,
        count,
      },
    });

    return count;
  });

  return { upserted };
}

// ───────────────────────────────────────────────────────────────────────────
// Mapper
// ───────────────────────────────────────────────────────────────────────────

function toPublic(r: {
  id: string;
  geoType: string;
  geoKey: string;
  centroidLat: number | null;
  centroidLng: number | null;
  score: number;
  band: string | null;
  modelName: string;
  modelVersion: string;
  computedAt: Date;
}): ScorePublic {
  return {
    id: r.id,
    geoType: r.geoType,
    geoKey: r.geoKey,
    centroidLat: r.centroidLat,
    centroidLng: r.centroidLng,
    score: r.score,
    band: r.band,
    modelName: r.modelName,
    modelVersion: r.modelVersion,
    computedAt: r.computedAt.toISOString(),
  };
}
