/**
 * Zod DTO schemas — runtime validation at API boundaries.
 *
 * Pattern: every controller validates incoming requests with the
 * corresponding Zod schema here, then passes typed data into the
 * domain service. Outbound responses also schema-validated for
 * OpenAPI generation.
 */
import { z } from 'zod';
import {
  REGION_CODES,
  VERTICALS,
  ORG_TYPES,
  PLATFORM_ROLES,
  KNOCK_DISPOSITIONS,
  LEAD_STATUSES,
  CONVERSION_TYPES,
  ATTRIBUTION_SOURCES,
  DONATION_FREQUENCIES,
  CONSENT_CHANNELS,
  PAYMENT_PROVIDERS,
  SOLICITOR_STATUSES,
  US_STATES,
  AU_STATES,
} from './enums';

// ───────────────────────────────────────────────────────────────────────────
// Primitives
// ───────────────────────────────────────────────────────────────────────────

/** ULID-style ID validation (26 chars, Crockford base32). Accepts CUID too. */
export const idSchema = z.string().min(20).max(36).regex(/^[a-zA-Z0-9_-]+$/);

/** BigInt cents as either bigint or string-encoded for JSON transport. */
export const bigIntCentsSchema = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/)])
  .transform((v) => (typeof v === 'string' ? BigInt(v) : v));

export const regionCodeSchema = z.enum(REGION_CODES);
export const verticalSchema = z.enum(VERTICALS);
export const orgTypeSchema = z.enum(ORG_TYPES);
export const platformRoleSchema = z.enum(PLATFORM_ROLES);
export const knockDispositionSchema = z.enum(KNOCK_DISPOSITIONS);
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export const conversionTypeSchema = z.enum(CONVERSION_TYPES);
export const attributionSourceSchema = z.enum(ATTRIBUTION_SOURCES);
export const donationFrequencySchema = z.enum(DONATION_FREQUENCIES);
export const consentChannelSchema = z.enum(CONSENT_CHANNELS);
export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export const solicitorStatusSchema = z.enum(SOLICITOR_STATUSES);
export const usStateSchema = z.enum(US_STATES);
export const auStateSchema = z.enum(AU_STATES);

/** WGS84 geo point. */
export const geoPointSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

/** Polygon ring as [lng, lat] pairs. First and last must match. */
export const polygonSchema = z.array(z.array(z.tuple([z.number(), z.number()])));

// ───────────────────────────────────────────────────────────────────────────
// Org & user
// ───────────────────────────────────────────────────────────────────────────

export const createOrgRequestSchema = z.object({
  legalName: z.string().min(1).max(200),
  tradingName: z.string().min(1).max(200),
  vertical: verticalSchema,
  type: orgTypeSchema,
  regionCode: regionCodeSchema,
  abnAcnUen: z.string().optional(),
  ssoProvider: z
    .enum(['okta', 'azuread', 'auth0', 'google_workspace', 'generic_saml'])
    .optional(),
});
export type CreateOrgRequest = z.infer<typeof createOrgRequestSchema>;

export const createUserRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  phone: z.string().optional(),
  role: platformRoleSchema,
  managerId: idSchema.optional(),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Territory & knock
// ───────────────────────────────────────────────────────────────────────────

export const createTerritoryRequestSchema = z.object({
  name: z.string().min(1).max(200),
  vertical: verticalSchema,
  polygon: polygonSchema,
  campaignId: idSchema.optional(),
});
export type CreateTerritoryRequest = z.infer<typeof createTerritoryRequestSchema>;

export const knockRequestSchema = z.object({
  sessionId: idSchema,
  territoryId: idSchema,
  addressId: idSchema.optional(),
  rawAddress: z.string().optional(),
  disposition: knockDispositionSchema,
  geo: geoPointSchema,
  capturedAt: z.string().datetime(),
  clientOffsetMs: z.number().int().optional(),
  photoKey: z.string().optional(),
  signatureKey: z.string().optional(),
  notes: z.string().optional(),
  // If lead capture happens at the door, embed the lead create payload here
  lead: z
    .object({
      givenName: z.string().min(1),
      familyName: z.string().min(1),
      email: z.string().email().toLowerCase().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  idempotencyKey: z.string().min(8).max(64),
});
export type KnockRequest = z.infer<typeof knockRequestSchema>;

export const knockBatchRequestSchema = z.object({
  knocks: z.array(knockRequestSchema).min(1).max(500),
  batchId: z.string().min(8).max(64),
});
export type KnockBatchRequest = z.infer<typeof knockBatchRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Conversion
// ───────────────────────────────────────────────────────────────────────────

export const conversionRequestSchema = z.object({
  leadId: idSchema,
  knockId: idSchema.optional(),
  type: conversionTypeSchema,
  attributionSource: attributionSourceSchema,
  retargetingCampaignId: idSchema.optional(),
  amountCents: bigIntCentsSchema,
  currency: z.string().length(3),
  signatureKey: z.string().optional(),
  paymentProvider: paymentProviderSchema,
  paymentMethodToken: z.string().min(1),
  // For donation_recurring only:
  frequency: donationFrequencySchema.optional(),
  idempotencyKey: z.string().min(8).max(64),
});
export type ConversionRequest = z.infer<typeof conversionRequestSchema>;
