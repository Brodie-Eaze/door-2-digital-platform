/**
 * Integration plug-in contract.
 *
 * Every third-party provider the AI Marketing Studio talks to — Meta Marketing
 * API, Higgsfield video, Claude/OpenAI copy, FLUX/Ideogram images, Runway video,
 * HeyGen avatars, Google Ads, TikTok Marketing — implements `ProviderAdapter`.
 *
 * The contract is intentionally narrow:
 *   - One adapter file per provider (~80-150 lines).
 *   - All credentials live encrypted in the PII vault (see ProviderConfig).
 *   - Long-running work returns a `jobId` + ISO `estimatedReadyAt`; we poll.
 *   - Audiences only ever leave D2D as SHA-256 hashed identifiers.
 *
 * The route layer (`apps/api/src/domains/marketing/*`) resolves a kind to an
 * adapter via `IntegrationRegistry` and dispatches the call — never imports
 * an adapter directly.
 */

import type { ProviderError } from './errors';

/** All known provider kinds. Add new ones here + register them in `registry.ts`. */
export type ProviderKind =
  | 'meta_marketing'
  | 'meta_mcp'
  | 'google_ads'
  | 'tiktok_marketing'
  | 'higgsfield'
  | 'claude_copy'
  | 'openai_copy'
  | 'flux_image'
  | 'ideogram_image'
  | 'runway_video'
  | 'heygen_avatar';

/** Coarse-grained capability tags, used by the UI to filter provider cards. */
export type ProviderCapability =
  | 'audience.build'
  | 'audience.push'
  | 'creative.generate.text'
  | 'creative.generate.image'
  | 'creative.generate.video'
  | 'creative.generate.avatar'
  | 'campaign.deliver'
  | 'campaign.status'
  | 'conversion.ingest'
  | 'mcp.server.expose';

/** Connection mode — sandbox always returns stub success, production hits the real API. */
export type ProviderMode = 'sandbox' | 'production';

/**
 * Per-org credentials + scoping for one provider. Encrypted at rest in the
 * PII vault; the registry never persists this object — it's resolved per
 * request from the secrets manager.
 */
export interface ProviderConfig {
  /** OAuth tokens or static API keys. Shape varies per provider. */
  credentials: Record<string, string>;
  /** Account identifiers (Meta `act_*`, Google customer id, TikTok advertiser id). */
  accountIdentifiers?: Record<string, string>;
  /** Webhook signing secret for inbound calls from this provider. */
  webhookSecret?: string;
  /** Sandbox / production toggle. Defaults to sandbox if unset. */
  mode?: ProviderMode;
}

/** Standard Result envelope so callers never have to try/catch adapter calls. */
export type Result<T, E = ProviderError> = { ok: true; data: T } | { ok: false; error: E };

// ───────────────────────────────────────────────────────────────────────────
// Creative-generation IO
// ───────────────────────────────────────────────────────────────────────────

export interface GenerateTextInput {
  prompt: string;
  brandVoice?: string;
  vertical?: 'charity' | 'commercial' | 'healthcare';
  region?: 'US' | 'AU' | 'SG';
  channel?: 'meta' | 'google' | 'tiktok' | 'youtube' | 'email' | 'sms' | 'door';
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextOutput {
  text: string;
  modelId: string;
  /** Cost stored as integer cents for BigInt-safe billing reconciliation. */
  costCents: number;
  /** SHA-256 of the resolved prompt, used for cache key + audit. */
  promptHash: string;
  seed?: number;
  c2paManifestId?: string;
  safetyScanResult?: 'pass' | 'fail' | 'review';
}

export interface GenerateImageInput {
  prompt: string;
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '3:2';
  brandColors?: string[];
  styleRef?: string;
  count: number;
}

export interface GenerateImageOutput {
  images: Array<{
    url: string;
    costCents: number;
    modelId: string;
    seed: number;
    c2paManifestId: string;
  }>;
}

export interface GenerateVideoInput {
  prompt: string;
  durationSec: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  styleRef?: string;
}

export interface GenerateVideoOutput {
  /** Async — poll `GET /v1/content-studio/jobs/:id` until ready. */
  jobId: string;
  estimatedReadyAt: string;
}

export interface GenerateAvatarInput {
  script: string;
  avatarId: string;
  voiceId: string;
  background?: string;
}

export interface GenerateAvatarOutput {
  jobId: string;
  estimatedReadyAt: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Audience + campaign IO
// ───────────────────────────────────────────────────────────────────────────

export interface BuildAudienceInput {
  name: string;
  /**
   * SHA-256 of normalised email (lowercase, trimmed) or E.164 phone.
   * Plaintext PII is never sent to ad networks. Enforced in routes.
   */
  hashedIdentifiers: string[];
  lookalikeSeed?: boolean;
  countryCode: 'US' | 'AU' | 'SG';
}

export interface DeliverCampaignInput {
  name: string;
  audienceId: string;
  creativeIds: string[];
  /** Daily budget in integer cents — caller converts BigInt → number. */
  budgetCents: number;
  bidStrategy: 'auto' | 'cost_cap' | 'value_optimization';
  startAt: string;
  endAt?: string;
  objective: 'leads' | 'conversions' | 'reach' | 'video_views';
}

// ───────────────────────────────────────────────────────────────────────────
// Inbound webhook envelope
// ───────────────────────────────────────────────────────────────────────────

export interface ProviderWebhookEvent {
  /** e.g. `lead.created`, `campaign.status_changed`, `video.ready`. */
  type: string;
  /** Provider-side id (Meta lead id, Runway job id, etc.). */
  externalId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────────────────────
// Async job polling — for adapters that return a `jobId` from a
// long-running operation (video / avatar generation). The marketing
// service polls on GET to surface readiness without forcing the caller
// to maintain a worker.
// ───────────────────────────────────────────────────────────────────────────

export interface JobStatus {
  status: 'pending' | 'running' | 'ready' | 'failed';
  /** Output payload — shape matches the originating capability's *Output type. */
  output?: unknown;
  error?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Adapter contract
// ───────────────────────────────────────────────────────────────────────────

/**
 * One adapter per provider. Implementations live in `./adapters/<kind>.ts`.
 * Every method is async and returns `Result<T, ProviderError>` so route
 * handlers can map errors to RFC 7807 problem responses uniformly.
 */
export interface ProviderAdapter {
  readonly kind: ProviderKind;
  readonly displayName: string;
  readonly capabilities: ReadonlyArray<ProviderCapability>;
  readonly docsUrl: string;

  /** Verify credentials work + return account identity for display. */
  ping(config: ProviderConfig): Promise<Result<{ accountLabel: string; accountId: string }>>;

  generateText?(
    input: GenerateTextInput,
    config: ProviderConfig,
  ): Promise<Result<GenerateTextOutput>>;
  generateImage?(
    input: GenerateImageInput,
    config: ProviderConfig,
  ): Promise<Result<GenerateImageOutput>>;
  generateVideo?(
    input: GenerateVideoInput,
    config: ProviderConfig,
  ): Promise<Result<GenerateVideoOutput>>;
  generateAvatar?(
    input: GenerateAvatarInput,
    config: ProviderConfig,
  ): Promise<Result<GenerateAvatarOutput>>;

  buildAudience?(
    input: BuildAudienceInput,
    config: ProviderConfig,
  ): Promise<Result<{ audienceId: string }>>;
  deliverCampaign?(
    input: DeliverCampaignInput,
    config: ProviderConfig,
  ): Promise<Result<{ campaignId: string }>>;

  /**
   * Inbound webhook handler. Implementations verify HMAC against
   * `config.webhookSecret`, then parse the body into a `ProviderWebhookEvent`.
   */
  parseWebhook?(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    config: ProviderConfig,
  ): Promise<Result<ProviderWebhookEvent>>;

  /**
   * Optional — poll an async job's status. Adapters that return a `jobId`
   * from `generateVideo` / `generateAvatar` implement this so callers can
   * track readiness. In stub mode, return `ready` once 30s have elapsed
   * since job creation (signalled by `createdAtMs`).
   */
  pollJob?(jobId: string, config: ProviderConfig, createdAtMs?: number): Promise<Result<JobStatus>>;
}

/** Snapshot of an adapter's metadata — used by `GET /v1/marketing/providers`. */
export interface ProviderDescriptor {
  kind: ProviderKind;
  displayName: string;
  capabilities: ReadonlyArray<ProviderCapability>;
  docsUrl: string;
}
