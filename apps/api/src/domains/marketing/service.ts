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
