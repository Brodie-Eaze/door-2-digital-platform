/**
 * Knock-domain Zod schemas.
 *
 * Single-knock body matches the shared `createKnockRequestSchema` shape
 * but requires `idempotencyKey` inline (also accepted via the header).
 * For batch, the array's `idempotencyKey` field doubles as the dedupe
 * token so retries don't double-insert.
 */
import { z } from 'zod';
import {
  idSchema,
  knockDispositionSchema,
  consentChannelSchema,
  cursorPageQuerySchema,
} from '@d2d/shared-types';

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10_000).optional(),
});

/** Loose address shape — server normalises + hashes for dedupe. */
export const rawAddressSchema = z.object({
  formatted: z.string().min(3).max(500),
  unit: z.string().max(50).optional(),
  street: z.string().min(1).max(300),
  locality: z.string().min(1).max(200),
  region: z.string().min(1).max(50),
  postcode: z.string().min(1).max(20),
  countryCode: z.string().length(2),
  geo: geoPointSchema.optional(),
});
export type RawAddress = z.infer<typeof rawAddressSchema>;

export const startSessionRequestSchema = z
  .object({
    territoryId: idSchema,
    deviceId: z.string().min(1).max(200),
    startGeo: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    appVersion: z.string().max(50).optional(),
    osVersion: z.string().max(50).optional(),
  })
  .strict();
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;

export const createKnockRequestSchema = z
  .object({
    sessionId: idSchema,
    territoryId: idSchema.optional(),
    addressId: idSchema.optional(),
    rawAddress: rawAddressSchema.optional(),
    disposition: knockDispositionSchema,
    geo: geoPointSchema,
    capturedAt: z.string().datetime(),
    photoKey: z.string().max(500).optional(),
    signatureKey: z.string().max(500).optional(),
    notes: z.string().max(4000).optional(),
    /** Per-knock idempotency token — required for both single + batch flows. */
    idempotencyKey: z.string().min(8).max(64),
    leadDraft: z
      .object({
        givenName: z.string().min(1).max(200),
        familyName: z.string().min(1).max(200),
        email: z.string().email().toLowerCase().optional(),
        phone: z.string().max(50).optional(),
        consentChannels: z.array(consentChannelSchema).optional(),
      })
      .optional(),
  })
  .strict()
  .refine((v) => Boolean(v.addressId) || Boolean(v.rawAddress), {
    message: 'Either addressId or rawAddress must be provided',
    path: ['addressId'],
  });
export type CreateKnockRequest = z.infer<typeof createKnockRequestSchema>;

export const knockBatchRequestSchema = z
  .object({
    knocks: z.array(createKnockRequestSchema).min(1).max(500),
  })
  .strict();
export type KnockBatchRequest = z.infer<typeof knockBatchRequestSchema>;

export const listKnocksQuerySchema = cursorPageQuerySchema.extend({
  sessionId: idSchema.optional(),
  territoryId: idSchema.optional(),
  disposition: knockDispositionSchema.optional(),
  capturedFrom: z.string().datetime().optional(),
  capturedTo: z.string().datetime().optional(),
});
export type ListKnocksQuery = z.infer<typeof listKnocksQuerySchema>;
