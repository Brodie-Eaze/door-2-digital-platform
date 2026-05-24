/**
 * Marketing-domain Zod schemas (Agent 16).
 *
 * Validates the input shape for `POST /v1/marketing/*` and `GET /v1/marketing/*`
 * endpoints. The adapter-side capability types live in `@d2d/integrations` —
 * we re-validate at the route layer so a 400 fires before the dispatch.
 */
import { z } from 'zod';
import { cursorPageQuerySchema } from '@d2d/shared-types';

// ───────────────────────────────────────────────────────────────────────────
// Shared enum-like primitives
// ───────────────────────────────────────────────────────────────────────────

export const providerKindSchema = z.enum([
  'meta_marketing',
  'meta_mcp',
  'google_ads',
  'tiktok_marketing',
  'higgsfield',
  'claude_copy',
  'openai_copy',
  'flux_image',
  'ideogram_image',
  'runway_video',
  'heygen_avatar',
]);
export type ProviderKindLiteral = z.infer<typeof providerKindSchema>;

export const providerCapabilitySchema = z.enum([
  'audience.build',
  'audience.push',
  'creative.generate.text',
  'creative.generate.image',
  'creative.generate.video',
  'creative.generate.avatar',
  'campaign.deliver',
  'campaign.status',
  'conversion.ingest',
  'mcp.server.expose',
]);
export type ProviderCapabilityLiteral = z.infer<typeof providerCapabilitySchema>;

export const providerModeSchema = z.enum(['sandbox', 'production']);

// ───────────────────────────────────────────────────────────────────────────
// Connect / disconnect
// ───────────────────────────────────────────────────────────────────────────

export const connectProviderRequestSchema = z
  .object({
    credentials: z.record(z.string(), z.string()).default({}),
    accountIdentifiers: z.record(z.string(), z.string()).optional(),
    mode: providerModeSchema.default('sandbox'),
  })
  .strict();
export type ConnectProviderRequest = z.infer<typeof connectProviderRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Creative generation IO — re-validated at the route, dispatched to adapters.
// ───────────────────────────────────────────────────────────────────────────

export const generateTextInputSchema = z
  .object({
    prompt: z.string().min(1).max(8000),
    brandVoice: z.string().max(1000).optional(),
    vertical: z.enum(['charity', 'commercial', 'healthcare']).optional(),
    region: z.enum(['US', 'AU', 'SG']).optional(),
    channel: z.enum(['meta', 'google', 'tiktok', 'youtube', 'email', 'sms', 'door']).optional(),
    maxTokens: z.number().int().min(1).max(4096).optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();
export type GenerateTextInput = z.infer<typeof generateTextInputSchema>;

export const generateImageInputSchema = z
  .object({
    prompt: z.string().min(1).max(4000),
    aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:2']),
    brandColors: z.array(z.string().max(20)).max(8).optional(),
    styleRef: z.string().max(500).optional(),
    count: z.number().int().min(1).max(8),
  })
  .strict();
export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;

export const generateVideoInputSchema = z
  .object({
    prompt: z.string().min(1).max(4000),
    durationSec: z.number().int().min(2).max(60),
    aspectRatio: z.enum(['9:16', '16:9', '1:1']),
    styleRef: z.string().max(500).optional(),
  })
  .strict();
export type GenerateVideoInput = z.infer<typeof generateVideoInputSchema>;

export const generateAvatarInputSchema = z
  .object({
    script: z.string().min(1).max(4000),
    avatarId: z.string().min(1),
    voiceId: z.string().min(1),
    background: z.string().max(120).optional(),
  })
  .strict();
export type GenerateAvatarInput = z.infer<typeof generateAvatarInputSchema>;

export const buildAudienceInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    hashedIdentifiers: z.array(z.string().length(64)).min(1).max(100_000),
    lookalikeSeed: z.boolean().optional(),
    countryCode: z.enum(['US', 'AU', 'SG']),
  })
  .strict();
export type BuildAudienceInput = z.infer<typeof buildAudienceInputSchema>;

export const deliverCampaignInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    audienceId: z.string().min(1),
    creativeIds: z.array(z.string().min(1)).min(1),
    budgetCents: z.number().int().min(100),
    bidStrategy: z.enum(['auto', 'cost_cap', 'value_optimization']),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    objective: z.enum(['leads', 'conversions', 'reach', 'video_views']),
  })
  .strict();
export type DeliverCampaignInput = z.infer<typeof deliverCampaignInputSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Dispatch envelopes
// ───────────────────────────────────────────────────────────────────────────

export const generateCreativeRequestSchema = z.discriminatedUnion('capability', [
  z.object({
    capability: z.literal('creative.generate.text'),
    providerKind: providerKindSchema,
    input: generateTextInputSchema,
  }),
  z.object({
    capability: z.literal('creative.generate.image'),
    providerKind: providerKindSchema,
    input: generateImageInputSchema,
  }),
  z.object({
    capability: z.literal('creative.generate.video'),
    providerKind: providerKindSchema,
    input: generateVideoInputSchema,
  }),
  z.object({
    capability: z.literal('creative.generate.avatar'),
    providerKind: providerKindSchema,
    input: generateAvatarInputSchema,
  }),
]);
export type GenerateCreativeRequest = z.infer<typeof generateCreativeRequestSchema>;

export const buildAudienceRequestSchema = z
  .object({
    providerKind: providerKindSchema,
    input: buildAudienceInputSchema,
  })
  .strict();
export type BuildAudienceRequest = z.infer<typeof buildAudienceRequestSchema>;

export const deliverCampaignRequestSchema = z
  .object({
    providerKind: providerKindSchema,
    input: deliverCampaignInputSchema,
  })
  .strict();
export type DeliverCampaignRequest = z.infer<typeof deliverCampaignRequestSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Listing
// ───────────────────────────────────────────────────────────────────────────

export const listJobsQuerySchema = cursorPageQuerySchema.extend({
  providerKind: providerKindSchema.optional(),
  capability: providerCapabilitySchema.optional(),
  status: z.enum(['pending', 'running', 'ready', 'failed', 'cancelled']).optional(),
});
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

export const listWebhookEventsQuerySchema = cursorPageQuerySchema;
export type ListWebhookEventsQuery = z.infer<typeof listWebhookEventsQuerySchema>;
