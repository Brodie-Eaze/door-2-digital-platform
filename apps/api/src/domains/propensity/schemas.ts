/**
 * Propensity-domain Zod schemas — the ML <-> platform contract.
 *
 * This domain is the *plug-in surface* for data scientists: the ML team WRITES
 * neighbourhood propensity scores (POST /scores), the platform READS them to
 * drive heatmaps (GET /heatmap) and the manager area-setting UI (GET /).
 *
 * `geoType` is the spatial key namespace the score is bucketed by:
 *   - "h3"      — Uber H3 cell id (the heatmap default; one score per cell)
 *   - "address" — a single street address hash
 *   - "bbox"    — a bounding-box bin key
 *   - "latlng"  — a raw rounded lat/lng bin
 *
 * `score` is a calibrated 0..1 propensity-to-convert. `band` is the heatmap
 * bucket; if the ML team omits it the service derives it (>=0.66 high,
 * >=0.33 medium, else low) so the read contract is always populated.
 */
import { z } from 'zod';

export const geoTypeSchema = z.enum(['h3', 'address', 'bbox', 'latlng']);
export type GeoType = z.infer<typeof geoTypeSchema>;

export const bandSchema = z.enum(['high', 'medium', 'low']);
export type Band = z.infer<typeof bandSchema>;

/**
 * `bbox=minLng,minLat,maxLng,maxLat` — four decimals (WGS84). Mirrors the
 * territory domain's bbox query string format exactly. A centroid is "within"
 * when minLng<=lng<=maxLng AND minLat<=lat<=maxLat.
 */
const bboxStringSchema = z
  .string()
  .regex(
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
    'must be minLng,minLat,maxLng,maxLat',
  )
  .describe('minLng,minLat,maxLng,maxLat');

/**
 * GET / — list scores visible to the caller org. Cursor cap is 500 (this is a
 * map-tile read, denser than the platform's default 50/200), so we define the
 * cursor/limit locally rather than extend the shared 200-capped page schema.
 */
export const listScoresQuerySchema = z
  .object({
    bbox: bboxStringSchema.optional(),
    geoType: geoTypeSchema.optional(),
    band: bandSchema.optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict();
export type ListScoresQuery = z.infer<typeof listScoresQuerySchema>;

/**
 * GET /heatmap — compact map layer. `geoType` defaults to h3 (the heatmap is
 * built on H3 cells). bbox is the viewport. No cursor: the heatmap returns a
 * single capped page sized for a map tile.
 */
export const heatmapQuerySchema = z
  .object({
    bbox: bboxStringSchema.optional(),
    geoType: geoTypeSchema.default('h3'),
    limit: z.coerce.number().int().min(1).max(500).default(500),
  })
  .strict();
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

/**
 * One score in a write-back batch. `centroidLat/Lng` are optional but REQUIRED
 * in practice for any score that should appear on a heatmap (the heatmap reads
 * centroids) — the ML team should always supply them for h3/bbox keys.
 */
export const scoreInputSchema = z
  .object({
    geoType: geoTypeSchema,
    geoKey: z.string().min(1).max(200),
    centroidLat: z.number().min(-90).max(90).optional(),
    centroidLng: z.number().min(-180).max(180).optional(),
    score: z.number().min(0).max(1),
    band: bandSchema.optional(),
    // Free-form feature vector / SHAP-style explanation. Persisted verbatim.
    features: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type ScoreInput = z.infer<typeof scoreInputSchema>;

/**
 * POST /scores — ML write-back batch upsert. Upsert key is
 * (orgId, geoType, geoKey). `global:true` writes shared/platform rows
 * (orgId IS NULL) and is restricted to super_admin. Batch is capped at 1000
 * scores per call so a single request stays bounded.
 */
export const writeScoresRequestSchema = z
  .object({
    modelName: z.string().min(1).max(120),
    modelVersion: z.string().min(1).max(60),
    global: z.boolean().optional(),
    scores: z.array(scoreInputSchema).min(1).max(1000),
  })
  .strict();
export type WriteScoresRequest = z.infer<typeof writeScoresRequestSchema>;
