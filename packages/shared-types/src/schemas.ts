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
export const idSchema = z
  .string()
  .min(20)
  .max(36)
  .regex(/^[a-zA-Z0-9_-]+$/);

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

/** Cursor pagination query. */
export const cursorPageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type CursorPageQuery = z.infer<typeof cursorPageQuerySchema>;

/** Bounding box for map queries: minLng, minLat, maxLng, maxLat. */
export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

// ───────────────────────────────────────────────────────────────────────────
// Org & user
// ───────────────────────────────────────────────────────────────────────────

export const createOrgRequestSchema = z.object({
  legalName: z.string().min(1).max(200),
  tradingName: z.string().min(1).max(200),
  vertical: verticalSchema,
  type: orgTypeSchema,
  regionCode: regionCodeSchema,
  brandCode: z.string().min(1).max(40).optional(),
  abnAcnUen: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  ssoProvider: z.enum(['okta', 'azuread', 'auth0', 'google_workspace', 'generic_saml']).optional(),
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

/**
 * Self-service / admin PATCH on a user. SECURITY: this is NOT allowed to carry
 * any privilege- or access-gating field. `role` is omitted so a user can never
 * escalate themselves via PATCH (role changes flow through POST /:id/role,
 * which is guarded). `.strict()` rejects unknown keys, so an attacker cannot
 * mass-assign `orgId` (cross-tenant move) or `status` (re-activate / un-archive)
 * by smuggling them in the body — Zod throws on any extra field.
 */
export const updateUserRequestSchema = createUserRequestSchema
  .omit({ role: true })
  .partial()
  .strict();
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

/**
 * Body for the guarded role-change path (POST /v1/users/:id/role). Only the
 * target role travels in the body; WHO may set WHICH role on WHOM is enforced
 * server-side (same-org, no self-escalation, super_admin only by super_admin).
 */
export const changeUserRoleRequestSchema = z
  .object({
    role: platformRoleSchema,
  })
  .strict();
export type ChangeUserRoleRequest = z.infer<typeof changeUserRoleRequestSchema>;

export const inviteUserRequestSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).default(7),
  message: z.string().max(2000).optional(),
});
export type InviteUserRequest = z.infer<typeof inviteUserRequestSchema>;

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

export const territoryAssignmentRequestSchema = z.object({
  userId: idSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  primary: z.boolean().default(false),
});
export type TerritoryAssignmentRequest = z.infer<typeof territoryAssignmentRequestSchema>;

export const heatmapQuerySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .describe('minLng,minLat,maxLng,maxLat'),
  layer: z.enum(['seifa', 'acs', 'singstat', 'knock-density']).default('knock-density'),
  resolution: z.coerce.number().int().min(4).max(12).default(8),
});
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

export const knockGeoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10000),
});

export const createKnockRequestSchema = z.object({
  sessionId: idSchema,
  territoryId: idSchema.optional(),
  addressId: idSchema.optional(),
  rawAddress: z.string().optional(),
  disposition: knockDispositionSchema,
  geo: knockGeoSchema,
  capturedAt: z.string().datetime(),
  clientOffsetMs: z.number().int().optional(),
  photoKey: z.string().optional(),
  signatureKey: z.string().optional(),
  notes: z.string().max(4000).optional(),
  leadDraft: z
    .object({
      givenName: z.string().min(1),
      familyName: z.string().min(1),
      email: z.string().email().toLowerCase().optional(),
      phone: z.string().optional(),
      consentChannels: z.array(consentChannelSchema).optional(),
    })
    .optional(),
});
export type CreateKnockRequest = z.infer<typeof createKnockRequestSchema>;

/** Back-compat alias for the original POST /knocks schema. */
export const knockRequestSchema = createKnockRequestSchema.extend({
  idempotencyKey: z.string().min(8).max(64),
});
export type KnockRequest = z.infer<typeof knockRequestSchema>;

export const knockBatchRequestSchema = z.object({
  batchId: z.string().min(8).max(64),
  knocks: z.array(createKnockRequestSchema).min(1).max(500),
});
export type KnockBatchRequest = z.infer<typeof knockBatchRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Lead
// ───────────────────────────────────────────────────────────────────────────

export const createLeadRequestSchema = z.object({
  sourceKnockId: idSchema.optional(),
  addressId: idSchema.optional(),
  vertical: verticalSchema,
  givenName: z.string().min(1).optional(),
  familyName: z.string().min(1).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().optional(),
  consentChannels: z.array(consentChannelSchema).optional(),
  notes: z.string().max(4000).optional(),
});
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>;

export const assignLeadRequestSchema = z.object({
  userId: idSchema,
  reason: z.string().max(500).optional(),
});
export type AssignLeadRequest = z.infer<typeof assignLeadRequestSchema>;

export const leadActivityRequestSchema = z.object({
  type: z.enum(['call', 'sms', 'email', 'note', 'status_change']),
  body: z.string().max(8000).optional(),
  outcome: z.string().max(200).optional(),
  newStatus: leadStatusSchema.optional(),
});
export type LeadActivityRequest = z.infer<typeof leadActivityRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// CRM sequences
// ───────────────────────────────────────────────────────────────────────────

export const createSequenceRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  steps: z
    .array(
      z.object({
        order: z.number().int().min(0),
        channel: z.enum(['sms', 'email', 'task']),
        delayHours: z
          .number()
          .int()
          .min(0)
          .max(24 * 90),
        templateId: idSchema.optional(),
        body: z.string().max(8000).optional(),
      }),
    )
    .min(1)
    .max(50),
});
export type CreateSequenceRequest = z.infer<typeof createSequenceRequestSchema>;

export const enrollSequenceRequestSchema = z.object({
  leadIds: z.array(idSchema).min(1).max(500),
  startAt: z.string().datetime().optional(),
});
export type EnrollSequenceRequest = z.infer<typeof enrollSequenceRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Conversion / donation / sale
// ───────────────────────────────────────────────────────────────────────────

export const donationDetailsSchema = z.object({
  frequency: donationFrequencySchema,
  firstChargeAt: z.string().datetime().optional(),
  giftAidEligible: z.boolean().optional(),
});

export const saleDetailsSchema = z.object({
  productSku: z.string().min(1).max(100),
  installSlotId: idSchema.optional(),
  contractTermMonths: z.number().int().min(0).max(120).optional(),
});

export const createConversionRequestSchema = z.object({
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
  donationDetails: donationDetailsSchema.optional(),
  saleDetails: saleDetailsSchema.optional(),
});
export type CreateConversionRequest = z.infer<typeof createConversionRequestSchema>;

/** Back-compat alias — earlier ad-hoc shape that also carries an idempotencyKey field. */
export const conversionRequestSchema = createConversionRequestSchema.extend({
  frequency: donationFrequencySchema.optional(),
  idempotencyKey: z.string().min(8).max(64),
});
export type ConversionRequest = z.infer<typeof conversionRequestSchema>;

export const changeDonationAmountRequestSchema = z.object({
  newAmountCents: bigIntCentsSchema,
  effectiveAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});
export type ChangeDonationAmountRequest = z.infer<typeof changeDonationAmountRequestSchema>;

export const pauseDonationRequestSchema = z.object({
  resumeAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});
export type PauseDonationRequest = z.infer<typeof pauseDonationRequestSchema>;

export const cancelDonationRequestSchema = z.object({
  reason: z.string().max(500),
  refundLastChargeCents: bigIntCentsSchema.optional(),
});
export type CancelDonationRequest = z.infer<typeof cancelDonationRequestSchema>;

export const createSaleRequestSchema = z.object({
  conversionId: idSchema,
  productSku: z.string().min(1).max(100),
  installSlotId: idSchema.optional(),
  contractTermMonths: z.number().int().min(0).max(120).optional(),
});
export type CreateSaleRequest = z.infer<typeof createSaleRequestSchema>;

export const installerHandoffRequestSchema = z.object({
  installerOrgId: idSchema,
  scheduledFor: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});
export type InstallerHandoffRequest = z.infer<typeof installerHandoffRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Commission & payout
// ───────────────────────────────────────────────────────────────────────────

export const commissionQuerySchema = z.object({
  userId: idSchema.optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  status: z.enum(['accrued', 'projected', 'paid', 'clawed_back']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type CommissionQuery = z.infer<typeof commissionQuerySchema>;

export const createPayoutBatchRequestSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  userIds: z.array(idSchema).optional(),
  dryRun: z.boolean().default(false),
});
export type CreatePayoutBatchRequest = z.infer<typeof createPayoutBatchRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Billing
// ───────────────────────────────────────────────────────────────────────────

export const generateInvoiceRequestSchema = z.object({
  orgId: idSchema,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  lineItems: z
    .array(
      z.object({
        kind: z.enum(['platform_fee', 'overage', 'one_off', 'credit']),
        description: z.string().min(1).max(500),
        amountCents: bigIntCentsSchema,
        currency: z.string().length(3),
      }),
    )
    .optional(),
});
export type GenerateInvoiceRequest = z.infer<typeof generateInvoiceRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Compliance — paid solicitor, state clearance, cooling-off
// ───────────────────────────────────────────────────────────────────────────

export const paidSolicitorRegistrationRequestSchema = z.object({
  campaignId: idSchema,
  state: z.string().min(2).max(8),
  filedAt: z.string().datetime().optional(),
  evidenceKey: z.string().optional(),
  status: solicitorStatusSchema.optional(),
});
export type PaidSolicitorRegistrationRequest = z.infer<
  typeof paidSolicitorRegistrationRequestSchema
>;

// ───────────────────────────────────────────────────────────────────────────
// Do-not-knock / do-not-call / consent
// ───────────────────────────────────────────────────────────────────────────

export const dnkCheckRequestSchema = z.object({
  addressId: idSchema.optional(),
  hashedAddress: z.string().optional(),
});
export type DnkCheckRequest = z.infer<typeof dnkCheckRequestSchema>;

export const dnkIngestRequestSchema = z.object({
  source: z.enum(['internal_request', 'state_registry', 'manager_flag']),
  rows: z
    .array(
      z.object({
        hashedAddress: z.string().min(8),
        reason: z.string().max(200).optional(),
        capturedAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(10_000),
});
export type DnkIngestRequest = z.infer<typeof dnkIngestRequestSchema>;

export const dncScrubRequestSchema = z.object({
  phones: z.array(z.string().min(6)).min(1).max(10_000),
});
export type DncScrubRequest = z.infer<typeof dncScrubRequestSchema>;

export const dncIngestRequestSchema = z.object({
  source: z.enum(['dnc_registry', 'tps', 'pdpa', 'internal']),
  rows: z
    .array(
      z.object({
        hashedPhone: z.string().min(8),
        registeredAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(50_000),
});
export type DncIngestRequest = z.infer<typeof dncIngestRequestSchema>;

export const captureConsentRequestSchema = z.object({
  leadId: idSchema.optional(),
  conversionId: idSchema.optional(),
  channels: z.array(consentChannelSchema).min(1),
  scope: z.enum(['marketing', 'recurring_payment', 'data_sharing']),
  evidenceKey: z.string().optional(),
  signatureKey: z.string().optional(),
  capturedAt: z.string().datetime(),
});
export type CaptureConsentRequest = z.infer<typeof captureConsentRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// PII vault
// ───────────────────────────────────────────────────────────────────────────

export const unmaskRequestSchema = z.object({
  resource: z.enum(['lead', 'donation', 'sale', 'conversion']),
  resourceId: idSchema,
  fields: z.array(z.enum(['email', 'phone', 'address', 'fullName', 'paymentLast4'])).min(1),
  reason: z.string().min(10).max(500),
  durationMinutes: z.number().int().min(1).max(240).default(30),
});
export type UnmaskRequest = z.infer<typeof unmaskRequestSchema>;

export const unmaskApprovalRequestSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(500).optional(),
});
export type UnmaskApprovalRequest = z.infer<typeof unmaskApprovalRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Notification
// ───────────────────────────────────────────────────────────────────────────

export const sendSmsRequestSchema = z.object({
  toPhone: z.string().min(6),
  body: z.string().min(1).max(1600),
  templateId: idSchema.optional(),
  leadId: idSchema.optional(),
});
export type SendSmsRequest = z.infer<typeof sendSmsRequestSchema>;

export const sendEmailRequestSchema = z.object({
  toEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
  templateId: idSchema.optional(),
  leadId: idSchema.optional(),
});
export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>;

export const sendPushRequestSchema = z.object({
  userId: idSchema,
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type SendPushRequest = z.infer<typeof sendPushRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Webhook
// ───────────────────────────────────────────────────────────────────────────

export const webhookEventTypeSchema = z.enum([
  'knock.created',
  'lead.created',
  'lead.updated',
  'lead.converted',
  'conversion.created',
  'conversion.finalised',
  'donation.charged',
  'donation.cancelled',
  'sale.created',
  'commission.accrued',
  'payout.locked',
  'payout.instructed',
  'compliance.state_clearance_changed',
]);

export const createWebhookEndpointSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(webhookEventTypeSchema).min(1),
  description: z.string().max(500).optional(),
  /** Optional manual secret rotation policy, days. Default 90. */
  secretRotationDays: z.number().int().min(7).max(365).default(90),
});
export type CreateWebhookEndpointRequest = z.infer<typeof createWebhookEndpointSchema>;

// ───────────────────────────────────────────────────────────────────────────
// DSAR
// ───────────────────────────────────────────────────────────────────────────

export const dsarRequestSchema = z.object({
  kind: z.enum(['access', 'deletion', 'portability', 'restriction']),
  subjectEmail: z.string().email().optional(),
  subjectPhone: z.string().optional(),
  subjectLeadId: idSchema.optional(),
  jurisdiction: z.enum(['au_privacy_act', 'ccpa', 'cpra', 'pdpa_sg', 'gdpr', 'other']),
  proofOfIdentityKey: z.string().optional(),
  note: z.string().max(4000).optional(),
});
export type DsarRequestBody = z.infer<typeof dsarRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Marketing & content-studio
// ───────────────────────────────────────────────────────────────────────────

export const linkAdAccountRequestSchema = z.object({
  provider: z.enum(['meta', 'google', 'tiktok', 'youtube']),
  returnUrl: z.string().url(),
});
export type LinkAdAccountRequest = z.infer<typeof linkAdAccountRequestSchema>;

export const generateCreativeRequestSchema = z.object({
  campaignId: idSchema.optional(),
  kind: z.enum(['copy', 'image', 'video']),
  brief: z.string().min(10).max(8000),
  brandKitId: idSchema.optional(),
  variantCount: z.number().int().min(1).max(20).default(3),
});
export type GenerateCreativeRequest = z.infer<typeof generateCreativeRequestSchema>;

export const deliverCampaignRequestSchema = z.object({
  campaignId: idSchema,
  adAccountId: idSchema,
  creativeIds: z.array(idSchema).min(1),
  dailyBudgetCents: bigIntCentsSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});
export type DeliverCampaignRequest = z.infer<typeof deliverCampaignRequestSchema>;

export const contentJobRequestSchema = z.object({
  brief: z.string().min(10).max(8000),
  brandKitId: idSchema.optional(),
  variantCount: z.number().int().min(1).max(20).default(3),
  referenceAssetKeys: z.array(z.string()).max(10).optional(),
});
export type ContentJobRequest = z.infer<typeof contentJobRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Realtime
// ───────────────────────────────────────────────────────────────────────────

export const realtimeTokenRequestSchema = z.object({
  channels: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        caps: z.array(z.enum(['subscribe', 'history', 'presence'])).min(1),
      }),
    )
    .min(1)
    .max(20),
  ttlSeconds: z.number().int().min(60).max(3600).default(900),
});
export type RealtimeTokenRequest = z.infer<typeof realtimeTokenRequestSchema>;
