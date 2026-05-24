/**
 * Territory-domain Zod schemas. Re-exports the shared base where possible
 * but bakes in the Phase 1.2 WKT-polygon shape this service stores.
 *
 * PostGIS is not yet installed locally, so polygons travel + persist as
 * WKT text (`POLYGON((lng lat, lng lat, ...))`) and we compute centroid /
 * S2 covering in-app. See `apps/api/prisma/schema.prisma` Territory model.
 */
import { z } from 'zod';
import { verticalSchema, idSchema, cursorPageQuerySchema } from '@d2d/shared-types';

/**
 * WKT POLYGON string — loose match, full validation lives in the service
 * (parseWkt throws if vertex count is bad or the ring doesn't close).
 */
export const wktPolygonSchema = z
  .string()
  .min(20)
  .max(64_000)
  .regex(/^POLYGON\s*\(\(.+\)\)\s*$/i, 'polygon must be a WKT POLYGON((...)) string');

export const territoryMetadataSchema = z
  .object({
    seifaDecile: z.number().int().min(1).max(10).optional(),
    medianIncomeCents: z
      .union([z.bigint(), z.string().regex(/^\d+$/), z.number().int()])
      .optional(),
    density: z.number().min(0).max(100_000).optional(),
  })
  .catchall(z.unknown())
  .optional();

export const createTerritoryRequestSchema = z
  .object({
    name: z.string().min(1).max(200),
    vertical: verticalSchema,
    campaignId: idSchema.optional(),
    polygonWkt: wktPolygonSchema,
    metadata: territoryMetadataSchema,
  })
  .strict();
export type CreateTerritoryRequest = z.infer<typeof createTerritoryRequestSchema>;

export const updateTerritoryRequestSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    metadata: territoryMetadataSchema,
    // Trap fields — must NOT be patchable after create.
    polygonWkt: z.never().optional(),
    centroid: z.never().optional(),
    s2CellIds: z.never().optional(),
  })
  .strict();
export type UpdateTerritoryRequest = z.infer<typeof updateTerritoryRequestSchema>;

export const listTerritoriesQuerySchema = cursorPageQuerySchema.extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
  vertical: verticalSchema.optional(),
  campaignId: idSchema.optional(),
});
export type ListTerritoriesQuery = z.infer<typeof listTerritoriesQuerySchema>;

export const createAssignmentRequestSchema = z
  .object({
    userId: idSchema,
    expiresAt: z.string().datetime().optional(),
  })
  .strict();
export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequestSchema>;

/** `bbox=west,south,east,north` — four decimals. */
export const heatmapQuerySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .describe('west,south,east,north'),
});
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
