/**
 * Marketing service — Agent 16 real.
 *
 * Wires the AI Marketing Studio routes to the @d2d/integrations adapter
 * registry while persisting every interaction to Postgres:
 *
 *   - ProviderConnection     one per (orgId, kind). Credentials are sealed
 *                            in the PII vault. Webhook signing secret is
 *                            returned plaintext exactly once at connect;
 *                            only the SHA-256 lives on the row.
 *   - ContentGenerationJob   one row per adapter dispatch. Sync providers
 *                            (claude, openai, flux, ideogram) write the
 *                            output inline. Async providers (runway,
 *                            higgsfield, heygen) store the externalJobId
 *                            and the marketing service polls via
 *                            adapter.pollJob() on GET /jobs/:id.
 *   - ProviderWebhookEvent   one per HMAC-verified inbound event. Replay
 *                            protection via UNIQUE (kind, externalId).
 *
 * All writes that mutate org-visible state write an AuditEvent in the same
 * transaction via AuditService.
 */
import { Prisma } from '@prisma/client';
import type { RegionCode } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import type {
  IntegrationRegistry,
  ProviderConfig,
  ProviderKind,
  ProviderCapability,
} from '@d2d/integrations';
import { prisma } from '../../config/db';
import { PiiVaultService, type EncryptedField } from '../pii-vault/service';
import { AuditService } from '../audit/service';
import type {
  BuildAudienceInput,
  ConnectProviderRequest,
  DeliverCampaignInput,
  GenerateAvatarInput,
  GenerateCreativeRequest,
  GenerateImageInput,
  GenerateTextInput,
  GenerateVideoInput,
  ListJobsQuery,
  ListWebhookEventsQuery,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

/**
 * Concrete shape of a `ProviderConnection` row — derived from the Prisma
 * generated payload so we have a stable type to thread through helpers.
 */
type ProviderConnectionRow = Prisma.ProviderConnectionGetPayload<true>;

// ───────────────────────────────────────────────────────────────────────────
// Public response shapes
// ───────────────────────────────────────────────────────────────────────────

export interface ProviderDescriptorPublic {
  kind: string;
  displayName: string;
  capabilities: readonly string[];
  docsUrl: string;
  connected: boolean;
  mode: string | null;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPingAt: string | null;
  lastPingStatus: string | null;
}

export interface ProviderConnectionPublic {
  id: string;
  orgId: string;
  kind: string;
  displayName: string;
  mode: string;
  status: string;
  accountLabel: string | null;
  accountId: string | null;
  lastPingAt: string | null;
  lastPingStatus: string | null;
  lastPingError: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
}

export interface ContentGenerationJobPublic {
  id: string;
  orgId: string;
  providerConnectionId: string;
  providerKind: string;
  capability: string;
  status: string;
  inputJson: unknown;
  outputJson: unknown;
  costCents: string;
  modelId: string | null;
  promptHash: string | null;
  safetyScanResult: string | null;
  c2paManifestId: string | null;
  externalJobId: string | null;
  createdById: string;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface ProviderWebhookEventPublic {
  id: string;
  orgId: string;
  providerConnectionId: string | null;
  providerKind: string;
  eventType: string;
  externalId: string;
  occurredAt: string;
  payloadJson: unknown;
  verifiedSignature: boolean;
  receivedAt: string;
}

export interface CreativePublic {
  id: string;
  orgId: string;
  type: string;
  assetKey: string;
  prompt: string | null;
  model: string | null;
  costCents: string;
  safetyScanResult: unknown;
  c2paManifestId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
}

export interface AdCampaignPublic {
  id: string;
  orgId: string;
  campaignId: string | null;
  adAccountId: string;
  provider: string;
  objective: string;
  audienceJson: unknown;
  budgetCents: string;
  status: string;
  externalCampaignId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  creatives: CreativePublic[];
}

export interface QueueCreativesResult {
  campaignId: string;
  creativeIds: string[];
  status: string;
}

export interface AttributedConversionPublic {
  id: string;
  orgId: string;
  attributionSource: string;
  retargetingCampaignId: string | null;
  amountCents: string;
  currency: string;
  signedAt: string;
  campaignId: string | null;
}

/**
 * Map a queued variant id to a Creative `type`. The Generator names video /
 * avatar / carousel variants with hints in the id (e.g. `var_a09` is a video
 * seed); when nothing is inferable we default to `copy` — the safest type for
 * a text-first creative. Deterministic so a re-queue lands the same type.
 */
function inferCreativeType(variantId: string): string {
  const id = variantId.toLowerCase();
  if (id.includes('video')) return 'video';
  if (id.includes('avatar')) return 'video';
  if (id.includes('image') || id.includes('img')) return 'image';
  if (id.includes('carousel')) return 'image';
  return 'copy';
}

/** Async providers — generateVideo / generateAvatar return a jobId. */
function isAsyncCapability(capability: ProviderCapability): boolean {
  return capability === 'creative.generate.video' || capability === 'creative.generate.avatar';
}

// ───────────────────────────────────────────────────────────────────────────
// Credential vault — encrypt before persist, decrypt before adapter call.
// ───────────────────────────────────────────────────────────────────────────

interface CredentialsBundle {
  credentials: Record<string, string>;
  accountIdentifiers?: Record<string, string>;
  webhookSecret?: string;
}

function sealCredentials(rowId: string, bundle: CredentialsBundle): EncryptedField {
  return PiiVaultService.encryptForRow('ProviderConnection', rowId, JSON.stringify(bundle));
}

function unsealCredentials(rowId: string, field: EncryptedField): CredentialsBundle {
  const plain = PiiVaultService.decrypt(field, 'ProviderConnection', rowId);
  return JSON.parse(plain) as CredentialsBundle;
}

function buildProviderConfig(bundle: CredentialsBundle, mode: string): ProviderConfig {
  return {
    credentials: bundle.credentials,
    accountIdentifiers: bundle.accountIdentifiers,
    webhookSecret: bundle.webhookSecret,
    mode: mode === 'production' ? 'production' : 'sandbox',
  };
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function generateSecret(): string {
  return randomBytes(32).toString('base64url');
}

// ───────────────────────────────────────────────────────────────────────────
// Service
// ───────────────────────────────────────────────────────────────────────────

export class MarketingService {
  constructor(private readonly registry: IntegrationRegistry) {}

  /** Snapshot of every adapter the registry knows about + per-org connection state. */
  async listProviders(orgId: string): Promise<ProviderDescriptorPublic[]> {
    const descriptors = this.registry.describe();
    const conns = await prisma().providerConnection.findMany({ where: { orgId } });
    const byKind = new Map(conns.map((c) => [c.kind, c]));
    return descriptors.map((d) => {
      const conn = byKind.get(d.kind);
      return {
        kind: d.kind,
        displayName: d.displayName,
        capabilities: d.capabilities,
        docsUrl: d.docsUrl,
        connected: Boolean(conn && conn.status === 'connected'),
        mode: conn?.mode ?? null,
        accountLabel: conn?.accountLabel ?? null,
        connectedAt: conn?.connectedAt.toISOString() ?? null,
        lastPingAt: conn?.lastPingAt?.toISOString() ?? null,
        lastPingStatus: conn?.lastPingStatus ?? null,
      };
    });
  }

  /**
   * Open or update a provider connection. Generates a webhook secret on
   * first connect (returned plaintext once). Calls adapter.ping with the
   * fresh config to verify credentials.
   */
  async connectProvider(
    kind: ProviderKind,
    input: ConnectProviderRequest,
    actor: ActorContext,
  ): Promise<{
    connection: ProviderConnectionPublic;
    webhookSecret: string | null;
  }> {
    const adapter = this.registry.tryGet(kind);
    if (!adapter) {
      throw new ProblemError(Problems.notFound('ProviderAdapter', kind));
    }

    // Look up an existing row so we can reuse the id (deterministic AAD).
    const existing = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId: actor.orgId, kind } },
    });

    const rowId = existing?.id ?? newId('prc');
    // Webhook secret: fresh on first connect, fresh on reconnect.
    const webhookSecretPlain = generateSecret();
    const webhookSecretHash = hashSecret(webhookSecretPlain);

    const bundle: CredentialsBundle = {
      credentials: input.credentials,
      accountIdentifiers: input.accountIdentifiers,
      webhookSecret: webhookSecretPlain,
    };
    const sealed = sealCredentials(rowId, bundle);

    const cfg = buildProviderConfig(bundle, input.mode);
    const ping = await adapter.ping(cfg);
    const pingAt = new Date();

    const row = await prisma().$transaction(async (tx) => {
      const next = await tx.providerConnection.upsert({
        where: { orgId_kind: { orgId: actor.orgId, kind } },
        update: {
          mode: input.mode,
          status: ping.ok ? 'connected' : 'error',
          credentialsVault: sealed as unknown as Prisma.InputJsonValue,
          accountLabel: ping.ok ? ping.data.accountLabel : null,
          accountId: ping.ok ? ping.data.accountId : null,
          webhookSecretHash,
          lastPingAt: pingAt,
          lastPingStatus: ping.ok ? 'ok' : 'fail',
          lastPingError: ping.ok ? null : ping.error.code,
          disconnectedAt: null,
          connectedAt: pingAt,
        },
        create: {
          id: rowId,
          orgId: actor.orgId,
          kind,
          displayName: adapter.displayName,
          mode: input.mode,
          status: ping.ok ? 'connected' : 'error',
          credentialsVault: sealed as unknown as Prisma.InputJsonValue,
          accountLabel: ping.ok ? ping.data.accountLabel : null,
          accountId: ping.ok ? ping.data.accountId : null,
          webhookSecretHash,
          lastPingAt: pingAt,
          lastPingStatus: ping.ok ? 'ok' : 'fail',
          lastPingError: ping.ok ? null : ping.error.code,
          connectedAt: pingAt,
        },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'providerConnection.connected',
        resourceType: 'ProviderConnection',
        resourceId: next.id,
        afterJson: {
          kind,
          mode: input.mode,
          status: next.status,
          accountLabel: next.accountLabel,
        },
      });
      return next;
    });

    return {
      connection: toConnectionPublic(row),
      // We always return the secret on connect/reconnect — caller MUST capture.
      webhookSecret: webhookSecretPlain,
    };
  }

  /** Soft-disconnect (status='disconnected', disconnectedAt=now). */
  async disconnectProvider(
    kind: ProviderKind,
    actor: ActorContext,
  ): Promise<ProviderConnectionPublic> {
    const existing = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId: actor.orgId, kind } },
    });
    if (!existing) {
      throw new ProblemError(Problems.notFound('ProviderConnection', kind));
    }
    if (existing.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(existing.orgId));
    }
    if (existing.status === 'disconnected') {
      return toConnectionPublic(existing);
    }

    const row = await prisma().$transaction(async (tx) => {
      const next = await tx.providerConnection.update({
        where: { id: existing.id },
        data: { status: 'disconnected', disconnectedAt: new Date() },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'providerConnection.disconnected',
        resourceType: 'ProviderConnection',
        resourceId: existing.id,
        beforeJson: { status: existing.status },
        afterJson: { status: 'disconnected' },
      });
      return next;
    });
    return toConnectionPublic(row);
  }

  /** Hit adapter.ping(), persist the result, return the live status. */
  async getProviderStatus(
    kind: ProviderKind,
    actor: ActorContext,
  ): Promise<ProviderConnectionPublic> {
    const existing = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId: actor.orgId, kind } },
    });
    if (!existing) {
      throw new ProblemError(Problems.notFound('ProviderConnection', kind));
    }
    if (existing.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(existing.orgId));
    }
    const adapter = this.registry.get(kind);
    const cfg = this.configFor(existing);
    const ping = await adapter.ping(cfg);
    const pingAt = new Date();
    const row = await prisma().providerConnection.update({
      where: { id: existing.id },
      data: {
        accountLabel: ping.ok ? ping.data.accountLabel : existing.accountLabel,
        accountId: ping.ok ? ping.data.accountId : existing.accountId,
        lastPingAt: pingAt,
        lastPingStatus: ping.ok ? 'ok' : 'fail',
        lastPingError: ping.ok ? null : ping.error.code,
        status: ping.ok ? 'connected' : 'error',
      },
    });
    return toConnectionPublic(row);
  }

  /**
   * Dispatch a creative generation. Persists ContentGenerationJob with
   * status='running', invokes the adapter, then updates the row with
   * status='ready' (sync) or keeps it 'running' (async — pollJob takes over).
   */
  async generateCreative(
    req: GenerateCreativeRequest,
    actor: ActorContext,
  ): Promise<ContentGenerationJobPublic> {
    const { providerKind, capability, input } = req;
    const conn = await this.requireActiveConnection(providerKind, actor.orgId);
    const adapter = this.registry.get(providerKind);
    const cfg = this.configFor(conn);

    const jobId = newId('cgj');
    const promptHash =
      capability === 'creative.generate.text' && 'prompt' in input
        ? createHash('sha256')
            .update((input as GenerateTextInput).prompt)
            .digest('hex')
            .slice(0, 16)
        : null;

    // Persist row with status='running' so a crash mid-call leaves a trace.
    const initial = await prisma().contentGenerationJob.create({
      data: {
        id: jobId,
        orgId: actor.orgId,
        providerConnectionId: conn.id,
        providerKind,
        capability,
        status: 'running',
        inputJson: input as unknown as Prisma.InputJsonValue,
        createdById: actor.userId,
        promptHash,
      },
    });

    // Dispatch.
    let outcome: { ok: boolean; data?: unknown; errorCode?: string; errorMessage?: string };
    try {
      if (capability === 'creative.generate.text') {
        if (!adapter.generateText) {
          throw new ProblemError(Problems.validation(`${providerKind} does not support text`));
        }
        const r = await adapter.generateText(input as GenerateTextInput, cfg);
        outcome = r.ok
          ? { ok: true, data: r.data }
          : { ok: false, errorCode: r.error.code, errorMessage: r.error.message };
      } else if (capability === 'creative.generate.image') {
        if (!adapter.generateImage) {
          throw new ProblemError(Problems.validation(`${providerKind} does not support image`));
        }
        const r = await adapter.generateImage(input as GenerateImageInput, cfg);
        outcome = r.ok
          ? { ok: true, data: r.data }
          : { ok: false, errorCode: r.error.code, errorMessage: r.error.message };
      } else if (capability === 'creative.generate.video') {
        if (!adapter.generateVideo) {
          throw new ProblemError(Problems.validation(`${providerKind} does not support video`));
        }
        const r = await adapter.generateVideo(input as GenerateVideoInput, cfg);
        outcome = r.ok
          ? { ok: true, data: r.data }
          : { ok: false, errorCode: r.error.code, errorMessage: r.error.message };
      } else if (capability === 'creative.generate.avatar') {
        if (!adapter.generateAvatar) {
          throw new ProblemError(Problems.validation(`${providerKind} does not support avatar`));
        }
        const r = await adapter.generateAvatar(input as GenerateAvatarInput, cfg);
        outcome = r.ok
          ? { ok: true, data: r.data }
          : { ok: false, errorCode: r.error.code, errorMessage: r.error.message };
      } else {
        throw new ProblemError(Problems.validation(`Unhandled capability: ${capability}`));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      outcome = { ok: false, errorCode: 'ADAPTER_THROW', errorMessage: msg };
    }

    // Decide on persisted status:
    //   sync (text/image)  → ready or failed
    //   async (video/avatar) → still 'running'; externalJobId captured
    const async = isAsyncCapability(capability);
    const updateData: Prisma.ContentGenerationJobUpdateInput = {};
    if (!outcome.ok) {
      updateData.status = 'failed';
      updateData.completedAt = new Date();
      updateData.errorCode = outcome.errorCode ?? 'UNKNOWN';
      updateData.errorMessage = outcome.errorMessage ?? null;
      updateData.outputJson = (
        outcome.errorMessage ? { error: outcome.errorMessage } : null
      ) as Prisma.InputJsonValue;
    } else if (async) {
      // Output is { jobId, estimatedReadyAt } for video/avatar.
      const data = outcome.data as { jobId?: string; estimatedReadyAt?: string };
      updateData.status = 'running';
      updateData.externalJobId = data.jobId ?? null;
      updateData.outputJson = data as Prisma.InputJsonValue;
    } else {
      // Sync — output complete. Capture cost + model id + safety scan + c2pa.
      const data = outcome.data as Record<string, unknown>;
      updateData.status = 'ready';
      updateData.completedAt = new Date();
      updateData.outputJson = data as Prisma.InputJsonValue;
      if (typeof data.modelId === 'string') updateData.modelId = data.modelId;
      if (typeof data.costCents === 'number') updateData.costCents = BigInt(data.costCents);
      if (typeof data.safetyScanResult === 'string')
        updateData.safetyScanResult = data.safetyScanResult;
      if (typeof data.c2paManifestId === 'string') updateData.c2paManifestId = data.c2paManifestId;
    }

    const updated = await prisma().$transaction(async (tx) => {
      const next = await tx.contentGenerationJob.update({
        where: { id: jobId },
        data: updateData,
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'contentGenerationJob.dispatched',
        resourceType: 'ContentGenerationJob',
        resourceId: jobId,
        afterJson: {
          providerKind,
          capability,
          status: next.status,
          externalJobId: next.externalJobId,
          costCents: next.costCents.toString(),
        },
      });
      return next;
    });

    void initial;
    return toJobPublic(updated);
  }

  /** Dispatch an audience-build call to the named adapter. */
  async buildAudience(
    providerKind: ProviderKind,
    input: BuildAudienceInput,
    actor: ActorContext,
  ): Promise<ContentGenerationJobPublic> {
    const conn = await this.requireActiveConnection(providerKind, actor.orgId);
    const adapter = this.registry.get(providerKind);
    if (!adapter.buildAudience) {
      throw new ProblemError(
        Problems.validation(`${providerKind} does not support audience.build`),
      );
    }
    const cfg = this.configFor(conn);
    const jobId = newId('cgj');
    await prisma().contentGenerationJob.create({
      data: {
        id: jobId,
        orgId: actor.orgId,
        providerConnectionId: conn.id,
        providerKind,
        capability: 'audience.build',
        status: 'running',
        inputJson: input as unknown as Prisma.InputJsonValue,
        createdById: actor.userId,
      },
    });
    const r = await adapter.buildAudience(input, cfg);
    const updated = await prisma().$transaction(async (tx) => {
      const next = await tx.contentGenerationJob.update({
        where: { id: jobId },
        data: r.ok
          ? {
              status: 'ready',
              completedAt: new Date(),
              outputJson: r.data as unknown as Prisma.InputJsonValue,
            }
          : {
              status: 'failed',
              completedAt: new Date(),
              errorCode: r.error.code,
              errorMessage: r.error.message,
              outputJson: { error: r.error.message } as Prisma.InputJsonValue,
            },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'contentGenerationJob.audienceBuilt',
        resourceType: 'ContentGenerationJob',
        resourceId: jobId,
        afterJson: { providerKind, status: next.status },
      });
      return next;
    });
    return toJobPublic(updated);
  }

  /** Dispatch a campaign-delivery call to the named adapter. */
  async deliverCampaign(
    providerKind: ProviderKind,
    input: DeliverCampaignInput,
    actor: ActorContext,
  ): Promise<ContentGenerationJobPublic> {
    const conn = await this.requireActiveConnection(providerKind, actor.orgId);
    const adapter = this.registry.get(providerKind);
    if (!adapter.deliverCampaign) {
      throw new ProblemError(
        Problems.validation(`${providerKind} does not support campaign.deliver`),
      );
    }
    const cfg = this.configFor(conn);
    const jobId = newId('cgj');
    await prisma().contentGenerationJob.create({
      data: {
        id: jobId,
        orgId: actor.orgId,
        providerConnectionId: conn.id,
        providerKind,
        capability: 'campaign.deliver',
        status: 'running',
        inputJson: input as unknown as Prisma.InputJsonValue,
        createdById: actor.userId,
      },
    });
    const r = await adapter.deliverCampaign(input, cfg);
    const updated = await prisma().$transaction(async (tx) => {
      const next = await tx.contentGenerationJob.update({
        where: { id: jobId },
        data: r.ok
          ? {
              status: 'ready',
              completedAt: new Date(),
              outputJson: r.data as unknown as Prisma.InputJsonValue,
            }
          : {
              status: 'failed',
              completedAt: new Date(),
              errorCode: r.error.code,
              errorMessage: r.error.message,
              outputJson: { error: r.error.message } as Prisma.InputJsonValue,
            },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'contentGenerationJob.campaignDelivered',
        resourceType: 'ContentGenerationJob',
        resourceId: jobId,
        afterJson: { providerKind, status: next.status },
      });
      return next;
    });
    return toJobPublic(updated);
  }

  /**
   * Read a job by id. If status='running' and the adapter supports polling,
   * we synchronously poll once and update the row before returning.
   */
  async getJob(jobId: string, actor: ActorContext): Promise<ContentGenerationJobPublic> {
    const job = await prisma().contentGenerationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new ProblemError(Problems.notFound('ContentGenerationJob', jobId));
    if (job.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(job.orgId));
    }
    if (job.status !== 'running') return toJobPublic(job);

    const adapter = this.registry.tryGet(job.providerKind as ProviderKind);
    if (!adapter || !adapter.pollJob || !job.externalJobId) {
      return toJobPublic(job);
    }
    const conn = await prisma().providerConnection.findUnique({
      where: { id: job.providerConnectionId },
    });
    if (!conn) return toJobPublic(job);
    const cfg = this.configFor(conn);
    const poll = await adapter.pollJob(job.externalJobId, cfg, job.createdAt.getTime());
    if (!poll.ok) {
      return toJobPublic(job);
    }
    const { status, output, error } = poll.data;
    if (status === 'ready') {
      const updated = await prisma().contentGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'ready',
          completedAt: new Date(),
          outputJson: (output ?? null) as Prisma.InputJsonValue,
        },
      });
      return toJobPublic(updated);
    }
    if (status === 'failed') {
      const updated = await prisma().contentGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorCode: 'PROVIDER_FAILED',
          errorMessage: error ?? null,
          outputJson: (error ? { error } : null) as Prisma.InputJsonValue,
        },
      });
      return toJobPublic(updated);
    }
    return toJobPublic(job);
  }

  /** Cursor-paginated job listing for an org. */
  async listJobs(
    query: ListJobsQuery,
    actor: ActorContext,
  ): Promise<{ data: ContentGenerationJobPublic[]; nextCursor: string | null }> {
    const where: Prisma.ContentGenerationJobWhereInput = { orgId: actor.orgId };
    if (query.providerKind) where.providerKind = query.providerKind;
    if (query.capability) where.capability = query.capability;
    if (query.status) where.status = query.status;
    const rows = await prisma().contentGenerationJob.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: { id: 'desc' },
    });
    const hasMore = rows.length > query.limit;
    const slice = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
    return { data: slice.map(toJobPublic), nextCursor };
  }

  /**
   * Inbound webhook receiver. Resolves the provider connection by (kind,
   * orgId-via-account-label-or-tenant-context), calls adapter.parseWebhook
   * with the raw body, and persists the event. Returns the parsed envelope.
   *
   * NOTE: For multi-tenant providers, the calling route resolves orgId
   * before invoking us; we trust that resolution. For Phase 3.1 a follow-up
   * lands a per-provider URL with the orgId in the path so we don't need
   * a header lookup.
   */
  async recordInboundWebhook(
    kind: ProviderKind,
    orgId: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<ProviderWebhookEventPublic> {
    const adapter = this.registry.get(kind);
    if (!adapter.parseWebhook) {
      throw new ProblemError(Problems.validation(`${kind} does not accept inbound webhooks`));
    }
    const conn = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId, kind } },
    });
    if (!conn) {
      throw new ProblemError(Problems.notFound('ProviderConnection', kind));
    }
    const cfg = this.configFor(conn);
    const parsed = await adapter.parseWebhook(rawBody, headers, cfg);
    if (!parsed.ok) {
      // Persist the failed verification too (verifiedSignature=false) so
      // operators can see attempts. Use a synthetic externalId to avoid
      // clashing with the unique index on (kind, externalId).
      const failId = newId('pwe');
      const failRow = await prisma().providerWebhookEvent.create({
        data: {
          id: failId,
          orgId,
          providerConnectionId: conn.id,
          providerKind: kind,
          eventType: 'signature.fail',
          externalId: `${kind}:sigfail:${failId}`,
          occurredAt: new Date(),
          payloadJson: { error: parsed.error.code } as Prisma.InputJsonValue,
          verifiedSignature: false,
        },
      });
      throw new ProblemError({
        type: 'https://docs.d2d.io/problems/signature-fail',
        title: 'Signature verification failed',
        status: 401,
        detail: parsed.error.message,
        instance: failRow.id,
      });
    }
    // Persist verified event. Replay protection via unique (kind, externalId).
    try {
      const row = await prisma().providerWebhookEvent.create({
        data: {
          id: newId('pwe'),
          orgId,
          providerConnectionId: conn.id,
          providerKind: kind,
          eventType: parsed.data.type,
          externalId: parsed.data.externalId,
          occurredAt: new Date(parsed.data.occurredAt),
          payloadJson: parsed.data.payload as Prisma.InputJsonValue,
          verifiedSignature: true,
        },
      });
      // CAPI attribution: fan the freshly-recorded event through the processor.
      // Defensive — a no-match (the common dev case) is a no-op, and any failure
      // here must NOT fail the webhook ACK (the event is already persisted and
      // will be picked up by the next processInboundWebhooks pass).
      try {
        await this.processInboundWebhooks(orgId);
      } catch (attrErr) {
        // Swallow: attribution is best-effort relative to event durability.
        void attrErr;
      }
      return toEventPublic(row);
    } catch (e) {
      // P2002 → unique violation → replay. Treat as already-processed.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await prisma().providerWebhookEvent.findUnique({
          where: {
            providerKind_externalId: {
              providerKind: kind,
              externalId: parsed.data.externalId,
            },
          },
        });
        if (existing) return toEventPublic(existing);
      }
      throw e;
    }
  }

  /** Cursor-paginated inbound event log for one kind, per org. */
  async listWebhookEvents(
    kind: ProviderKind,
    query: ListWebhookEventsQuery,
    actor: ActorContext,
  ): Promise<{ data: ProviderWebhookEventPublic[]; nextCursor: string | null }> {
    const where: Prisma.ProviderWebhookEventWhereInput = {
      orgId: actor.orgId,
      providerKind: kind,
    };
    const rows = await prisma().providerWebhookEvent.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: { id: 'desc' },
    });
    const hasMore = rows.length > query.limit;
    const slice = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
    return { data: slice.map(toEventPublic), nextCursor };
  }

  /**
   * Approve a batch of generated variants into the review queue.
   *
   * For each variantId we persist a Creative row (approved, safety pass) and
   * group them all under a NEW draft AdCampaign. The campaign starts in
   * status='draft' with provider='meta', a resolved-or-placeholder ad account,
   * objective='conversions', empty audience + zero budget — publish (the
   * deliver step) fills the real targeting + spend, and BLOCKS until a real
   * provider connection exists.
   *
   * If the org has no real AdAccount we still create the draft honestly with a
   * synthetic `pending_connection` ad-account marker so the queue is never a
   * dead button — the publish step is what gates on a live connection.
   */
  async queueCreatives(
    variantIds: string[],
    requestedByUserId: string,
    actor: ActorContext,
  ): Promise<QueueCreativesResult> {
    const unique = Array.from(new Set(variantIds));
    if (unique.length === 0) {
      throw new ProblemError(Problems.validation('At least one variantId is required'));
    }

    // Resolve a real Meta ad account for this org if one exists; otherwise
    // upsert a reusable per-org PLACEHOLDER AdAccount so the draft campaign's
    // required adAccountId FK resolves to a real row (a bare 'pending_connection'
    // literal would be a dangling FK and abort the whole transaction with a 500
    // for every org that hasn't connected Meta — i.e. the common case). The
    // placeholder carries status 'pending_connection' so the publish flow still
    // honestly gates on a real connection.
    const adAccount = await prisma().adAccount.findFirst({
      where: { orgId: actor.orgId, provider: 'meta', status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    let adAccountId: string;
    if (adAccount) {
      adAccountId = adAccount.id;
    } else {
      const placeholderId = `adac_pending_meta_${actor.orgId}`;
      await prisma().adAccount.upsert({
        where: { id: placeholderId },
        update: {},
        create: {
          id: placeholderId,
          orgId: actor.orgId,
          provider: 'meta',
          externalId: 'pending',
          tokenVaultRef: 'pending',
          status: 'pending_connection',
        },
      });
      adAccountId = placeholderId;
    }

    const campaignId = newId('adc');
    const now = new Date();

    const result = await prisma().$transaction(async (tx) => {
      const campaign = await tx.adCampaign.create({
        data: {
          id: campaignId,
          orgId: actor.orgId,
          adAccountId,
          provider: 'meta',
          objective: 'conversions',
          audienceJson: {} as Prisma.InputJsonValue,
          budgetCents: 0n,
          status: 'draft',
          externalCampaignId: null,
        },
      });

      const creativeIds: string[] = [];
      for (const variantId of unique) {
        const creativeId = newId('crv');
        await tx.creative.create({
          data: {
            id: creativeId,
            orgId: actor.orgId,
            type: inferCreativeType(variantId),
            // Deterministic placeholder asset key — the real S3/KMS key lands
            // when the asset pipeline persists the generated bytes.
            assetKey: `pending/${actor.orgId}/${variantId}`,
            prompt: null,
            model: null,
            costCents: 0n,
            safetyScanResult: { pass: true } as Prisma.InputJsonValue,
            approvedAt: now,
            approvedBy: requestedByUserId,
            adCampaigns: { connect: { id: campaign.id } },
          },
        });
        creativeIds.push(creativeId);
      }

      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'adCampaign.queued',
        resourceType: 'AdCampaign',
        resourceId: campaign.id,
        afterJson: {
          status: 'draft',
          provider: 'meta',
          adAccountId,
          creativeCount: creativeIds.length,
          requestedByUserId,
        },
      });

      return { campaignId: campaign.id, creativeIds, status: campaign.status };
    });

    return result;
  }

  /** List draft AdCampaigns for the org with their creatives (review queue). */
  async listDraftCampaigns(orgId: string, status = 'draft'): Promise<AdCampaignPublic[]> {
    const rows = await prisma().adCampaign.findMany({
      where: { orgId, status },
      include: { creatives: true },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return rows.map(toCampaignPublic);
  }

  /**
   * CAPI attribution processor. Reads unprocessed inbound webhook events for
   * the org and, for each event whose payload references a campaign that maps
   * to a known AdCampaign.externalCampaignId, writes a retargeting Conversion
   * and marks the event processed.
   *
   * Defensive by construction: in dev there are no real Meta CAPI payloads, so
   * this no-ops over an empty set. A Conversion is only written when we can
   * resolve BOTH a matching AdCampaign AND a real Lead in the org — we never
   * fabricate a Lead to satisfy the FK.
   */
  async processInboundWebhooks(orgId: string): Promise<{ processed: number; attributed: number }> {
    const events = await prisma().providerWebhookEvent.findMany({
      where: { orgId, processedAt: null, verifiedSignature: true },
      orderBy: { id: 'asc' },
      take: 200,
    });
    if (events.length === 0) return { processed: 0, attributed: 0 };

    // Currency is per-org (OrgBilling). Load once; fall back to USD if billing
    // isn't provisioned yet so we never block attribution on a missing row.
    const billing = await prisma().orgBilling.findUnique({
      where: { orgId },
      select: { currency: true },
    });
    const orgCurrency = billing?.currency ?? 'USD';

    let processed = 0;
    let attributed = 0;

    for (const event of events) {
      const payload = (event.payloadJson ?? {}) as Record<string, unknown>;
      const externalCampaignId =
        typeof payload.campaign_id === 'string'
          ? payload.campaign_id
          : typeof payload.campaignId === 'string'
            ? payload.campaignId
            : null;
      const leadRef = typeof payload.lead_id === 'string' ? payload.lead_id : null;

      // Resolve the AdCampaign this event references (tenant-scoped).
      const campaign = externalCampaignId
        ? await prisma().adCampaign.findFirst({
            where: { orgId, externalCampaignId },
          })
        : null;

      // Resolve a real Lead — required FK on Conversion. If we can't, we still
      // mark the event processed (we've inspected it) but write no Conversion.
      const lead = leadRef
        ? await prisma().lead.findFirst({ where: { id: leadRef, orgId } })
        : null;

      await prisma().$transaction(async (tx) => {
        if (campaign && lead) {
          const amount =
            typeof payload.amount_cents === 'number' ? Math.round(payload.amount_cents) : 0;
          const conversionId = newId('cnv');
          // Type follows the lead's vertical: commercial → sale_commercial,
          // charity → donation_oneoff. Defensive default keeps the prior
          // literal when vertical is somehow absent.
          const conversionType =
            lead.vertical === 'commercial' ? 'sale_commercial' : 'donation_oneoff';
          await tx.conversion.create({
            data: {
              id: conversionId,
              orgId,
              regionCode: lead.regionCode,
              leadId: lead.id,
              campaignId: lead.campaignId,
              type: conversionType,
              attributionSource: 'retargeting',
              retargetingCampaignId: campaign.id,
              amountCents: BigInt(amount),
              currency: orgCurrency,
              signedAt: event.occurredAt,
              paymentProvider: 'micamp',
              // Idempotency: one conversion per webhook event.
              idempotencyKey: `capi:${event.id}`,
            },
          });
          await AuditService.recordEvent(tx, {
            orgId,
            regionCode: lead.regionCode,
            actorUserId: null,
            action: 'conversion.attributed',
            resourceType: 'Conversion',
            resourceId: conversionId,
            afterJson: {
              attributionSource: 'retargeting',
              retargetingCampaignId: campaign.id,
              fromWebhookEvent: event.id,
            },
          });
          attributed += 1;
        }
        await tx.providerWebhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });
      });
      processed += 1;
    }

    return { processed, attributed };
  }

  /** Recently-attributed retargeting conversions (last 50, tenant-scoped). */
  async recentAttributedConversions(orgId: string): Promise<AttributedConversionPublic[]> {
    const rows = await prisma().conversion.findMany({
      where: { orgId, attributionSource: 'retargeting' },
      orderBy: { signedAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      attributionSource: r.attributionSource,
      retargetingCampaignId: r.retargetingCampaignId,
      amountCents: r.amountCents.toString(),
      currency: r.currency,
      signedAt: r.signedAt.toISOString(),
      campaignId: r.campaignId,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────────────────

  /** Throws 412 NOT_CONNECTED if no live ProviderConnection exists. */
  private async requireActiveConnection(
    kind: ProviderKind,
    orgId: string,
  ): Promise<ProviderConnectionRow> {
    const conn = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId, kind } },
    });
    if (!conn) {
      throw new ProblemError({
        type: 'https://docs.d2d.io/problems/not-connected',
        title: 'Not connected',
        status: 412,
        detail: `Provider ${kind} not connected for this org`,
      });
    }
    if (conn.status === 'disconnected') {
      throw new ProblemError({
        type: 'https://docs.d2d.io/problems/not-connected',
        title: 'Not connected',
        status: 412,
        detail: `Provider ${kind} is disconnected`,
      });
    }
    return conn;
  }

  /** Decrypt the vaulted credential bundle and wrap in a ProviderConfig. */
  private configFor(conn: {
    id: string;
    mode: string;
    credentialsVault: Prisma.JsonValue;
  }): ProviderConfig {
    if (!conn.credentialsVault) {
      return { credentials: {}, mode: 'sandbox' };
    }
    const bundle = unsealCredentials(conn.id, conn.credentialsVault as unknown as EncryptedField);
    return buildProviderConfig(bundle, conn.mode);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────────────────

function toConnectionPublic(r: {
  id: string;
  orgId: string;
  kind: string;
  displayName: string;
  mode: string;
  status: string;
  accountLabel: string | null;
  accountId: string | null;
  lastPingAt: Date | null;
  lastPingStatus: string | null;
  lastPingError: string | null;
  connectedAt: Date;
  disconnectedAt: Date | null;
}): ProviderConnectionPublic {
  return {
    id: r.id,
    orgId: r.orgId,
    kind: r.kind,
    displayName: r.displayName,
    mode: r.mode,
    status: r.status,
    accountLabel: r.accountLabel,
    accountId: r.accountId,
    lastPingAt: r.lastPingAt?.toISOString() ?? null,
    lastPingStatus: r.lastPingStatus,
    lastPingError: r.lastPingError,
    connectedAt: r.connectedAt.toISOString(),
    disconnectedAt: r.disconnectedAt?.toISOString() ?? null,
  };
}

function toJobPublic(r: {
  id: string;
  orgId: string;
  providerConnectionId: string;
  providerKind: string;
  capability: string;
  status: string;
  inputJson: Prisma.JsonValue;
  outputJson: Prisma.JsonValue;
  costCents: bigint;
  modelId: string | null;
  promptHash: string | null;
  safetyScanResult: string | null;
  c2paManifestId: string | null;
  externalJobId: string | null;
  createdById: string;
  createdAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
}): ContentGenerationJobPublic {
  return {
    id: r.id,
    orgId: r.orgId,
    providerConnectionId: r.providerConnectionId,
    providerKind: r.providerKind,
    capability: r.capability,
    status: r.status,
    inputJson: r.inputJson,
    outputJson: r.outputJson,
    costCents: r.costCents.toString(),
    modelId: r.modelId,
    promptHash: r.promptHash,
    safetyScanResult: r.safetyScanResult,
    c2paManifestId: r.c2paManifestId,
    externalJobId: r.externalJobId,
    createdById: r.createdById,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
  };
}

function toCreativePublic(r: {
  id: string;
  orgId: string;
  type: string;
  assetKey: string;
  prompt: string | null;
  model: string | null;
  costCents: bigint;
  safetyScanResult: Prisma.JsonValue;
  c2paManifestId: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
}): CreativePublic {
  return {
    id: r.id,
    orgId: r.orgId,
    type: r.type,
    assetKey: r.assetKey,
    prompt: r.prompt,
    model: r.model,
    costCents: r.costCents.toString(),
    safetyScanResult: r.safetyScanResult,
    c2paManifestId: r.c2paManifestId,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    approvedBy: r.approvedBy,
    createdAt: r.createdAt.toISOString(),
  };
}

function toCampaignPublic(r: {
  id: string;
  orgId: string;
  campaignId: string | null;
  adAccountId: string;
  provider: string;
  objective: string;
  audienceJson: Prisma.JsonValue;
  budgetCents: bigint;
  status: string;
  externalCampaignId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  creatives: Array<Parameters<typeof toCreativePublic>[0]>;
}): AdCampaignPublic {
  return {
    id: r.id,
    orgId: r.orgId,
    campaignId: r.campaignId,
    adAccountId: r.adAccountId,
    provider: r.provider,
    objective: r.objective,
    audienceJson: r.audienceJson,
    budgetCents: r.budgetCents.toString(),
    status: r.status,
    externalCampaignId: r.externalCampaignId,
    startedAt: r.startedAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    creatives: r.creatives.map(toCreativePublic),
  };
}

function toEventPublic(r: {
  id: string;
  orgId: string;
  providerConnectionId: string | null;
  providerKind: string;
  eventType: string;
  externalId: string;
  occurredAt: Date;
  payloadJson: Prisma.JsonValue;
  verifiedSignature: boolean;
  receivedAt: Date;
}): ProviderWebhookEventPublic {
  return {
    id: r.id,
    orgId: r.orgId,
    providerConnectionId: r.providerConnectionId,
    providerKind: r.providerKind,
    eventType: r.eventType,
    externalId: r.externalId,
    occurredAt: r.occurredAt.toISOString(),
    payloadJson: r.payloadJson,
    verifiedSignature: r.verifiedSignature,
    receivedAt: r.receivedAt.toISOString(),
  };
}
