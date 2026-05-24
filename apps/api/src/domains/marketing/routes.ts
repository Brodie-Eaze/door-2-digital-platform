/**
 * Marketing routes — plug-in dispatch surface for the AI Marketing Studio.
 *
 * Every endpoint here is provider-agnostic. The route resolves
 * `body.providerKind` → `ProviderAdapter` via `app.integrations`, then
 * dispatches the call. Per-org credentials are loaded from the secrets
 * manager in `loadProviderConfig()` (currently a sandbox stub — full vault
 * lookup lands in Phase 3.1 with PII vault integration).
 *
 * Mount: `app.register(registerMarketing, { prefix: '/v1/marketing' })`.
 *
 * Endpoints:
 *   - GET    /providers                           list available + connected providers
 *   - POST   /providers/:kind/connect             save creds, ping for verification
 *   - DELETE /providers/:kind                     disconnect (clear creds)
 *   - GET    /providers/:kind/status              connection status + last ping
 *   - POST   /creatives/generate                  dispatch creative-gen to adapter
 *   - POST   /campaigns/deliver                   dispatch ad-delivery to adapter
 *   - POST   /audiences/build                     dispatch audience-build to adapter
 *   - POST   /webhooks/:kind                      inbound webhook (HMAC-verified)
 *   - GET    /webhooks/:kind/recent               last 50 inbound events
 *
 * All POSTs require an `Idempotency-Key` header.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  type ProviderConfig,
  type ProviderKind,
  type ProviderWebhookEvent,
} from '@d2d/integrations';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

// ───────────────────────────────────────────────────────────────────────────
// Request validation
// ───────────────────────────────────────────────────────────────────────────

const providerKindSchema = z.enum([
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

const generateTextInputSchema = z.object({
  prompt: z.string().min(1).max(8000),
  brandVoice: z.string().max(1000).optional(),
  vertical: z.enum(['charity', 'commercial', 'healthcare']).optional(),
  region: z.enum(['US', 'AU', 'SG']).optional(),
  channel: z.enum(['meta', 'google', 'tiktok', 'youtube', 'email', 'sms', 'door']).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const generateImageInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:2']),
  brandColors: z.array(z.string().max(20)).max(8).optional(),
  styleRef: z.string().max(500).optional(),
  count: z.number().int().min(1).max(8),
});

const generateVideoInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  durationSec: z.number().int().min(2).max(60),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']),
  styleRef: z.string().max(500).optional(),
});

const generateAvatarInputSchema = z.object({
  script: z.string().min(1).max(4000),
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  background: z.string().max(120).optional(),
});

const buildAudienceInputSchema = z.object({
  name: z.string().min(1).max(200),
  hashedIdentifiers: z.array(z.string().length(64)).min(1).max(100_000),
  lookalikeSeed: z.boolean().optional(),
  countryCode: z.enum(['US', 'AU', 'SG']),
});

const deliverCampaignInputSchema = z.object({
  name: z.string().min(1).max(200),
  audienceId: z.string().min(1),
  creativeIds: z.array(z.string().min(1)).min(1),
  budgetCents: z.number().int().min(100),
  bidStrategy: z.enum(['auto', 'cost_cap', 'value_optimization']),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  objective: z.enum(['leads', 'conversions', 'reach', 'video_views']),
});

const creativeGenerateRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('text'),
    providerKind: providerKindSchema,
    input: generateTextInputSchema,
  }),
  z.object({
    mode: z.literal('image'),
    providerKind: providerKindSchema,
    input: generateImageInputSchema,
  }),
  z.object({
    mode: z.literal('video'),
    providerKind: providerKindSchema,
    input: generateVideoInputSchema,
  }),
  z.object({
    mode: z.literal('avatar'),
    providerKind: providerKindSchema,
    input: generateAvatarInputSchema,
  }),
]);

const audienceBuildRequestSchema = z.object({
  providerKind: providerKindSchema,
  input: buildAudienceInputSchema,
});

const campaignDeliverRequestSchema = z.object({
  providerKind: providerKindSchema,
  input: deliverCampaignInputSchema,
});

const connectRequestSchema = z.object({
  credentials: z.record(z.string(), z.string()).default({}),
  accountIdentifiers: z.record(z.string(), z.string()).optional(),
  webhookSecret: z.string().optional(),
  mode: z.enum(['sandbox', 'production']).default('sandbox'),
});

// ───────────────────────────────────────────────────────────────────────────
// Per-org connection state (in-memory placeholder; PII vault in Phase 3.1)
// ───────────────────────────────────────────────────────────────────────────

interface ConnectionState {
  config: ProviderConfig;
  connectedAt: string;
  lastPing?: { ok: boolean; at: string; detail: string };
}

interface WebhookLogEntry {
  id: string;
  providerKind: ProviderKind;
  receivedAt: string;
  signatureValid: boolean;
  event?: ProviderWebhookEvent;
  error?: string;
}

const connections = new Map<ProviderKind, ConnectionState>();
const webhookLog: WebhookLogEntry[] = [];

function seedDefaultSandboxConnections(): void {
  if (connections.size > 0) return;
  const kinds: ProviderKind[] = [
    'meta_marketing',
    'meta_mcp',
    'claude_copy',
    'flux_image',
    'higgsfield',
  ];
  for (const k of kinds) {
    connections.set(k, {
      config: { credentials: {}, mode: 'sandbox' },
      connectedAt: new Date(Date.now() - 86_400_000).toISOString(),
      lastPing: { ok: true, at: new Date().toISOString(), detail: 'sandbox' },
    });
  }
}

function loadProviderConfig(kind: ProviderKind): ProviderConfig {
  seedDefaultSandboxConnections();
  const state = connections.get(kind);
  if (!state) return { credentials: {}, mode: 'sandbox' };
  return state.config;
}

// ───────────────────────────────────────────────────────────────────────────
// Route registration
// ───────────────────────────────────────────────────────────────────────────

export async function registerMarketing(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'marketing', status: 'live', phase: '3' }));

  // ── Providers ──────────────────────────────────────────────────────────

  app.get('/providers', async () => {
    seedDefaultSandboxConnections();
    const descriptors = app.integrations.describe();
    return descriptors.map((d) => {
      const conn = connections.get(d.kind);
      return {
        ...d,
        connected: Boolean(conn),
        mode: conn?.config.mode ?? null,
        connectedAt: conn?.connectedAt ?? null,
        lastPing: conn?.lastPing ?? null,
      };
    });
  });

  app.get('/providers/:kind/status', async (req, reply) => {
    const kind = providerKindSchema.parse((req.params as { kind?: string }).kind);
    seedDefaultSandboxConnections();
    const conn = connections.get(kind);
    if (!conn) {
      return reply
        .code(404)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/not-found',
          title: 'Not connected',
          status: 404,
          detail: `Provider ${kind} not connected for this org`,
        });
    }
    const adapter = app.integrations.tryGet(kind);
    if (!adapter) {
      return reply.code(404).send({ kind, connected: false });
    }
    const ping = await adapter.ping(conn.config);
    conn.lastPing = {
      ok: ping.ok,
      at: new Date().toISOString(),
      detail: ping.ok ? ping.data.accountLabel : ping.error.code,
    };
    return { kind, connected: true, mode: conn.config.mode, lastPing: conn.lastPing };
  });

  app.post('/providers/:kind/connect', async (req, reply) => {
    requireIdempotencyKey(req);
    const kind = providerKindSchema.parse((req.params as { kind?: string }).kind);
    const body = connectRequestSchema.parse(req.body);
    const config: ProviderConfig = {
      credentials: body.credentials,
      accountIdentifiers: body.accountIdentifiers,
      webhookSecret: body.webhookSecret,
      mode: body.mode,
    };
    const adapter = app.integrations.get(kind);
    const ping = await adapter.ping(config);
    connections.set(kind, {
      config,
      connectedAt: new Date().toISOString(),
      lastPing: {
        ok: ping.ok,
        at: new Date().toISOString(),
        detail: ping.ok ? ping.data.accountLabel : ping.error.code,
      },
    });
    return reply.code(201).send({
      kind,
      mode: config.mode,
      pingOk: ping.ok,
      detail: ping.ok ? ping.data.accountLabel : ping.error.message,
    });
  });

  app.delete('/providers/:kind', async (req, reply) => {
    const kind = providerKindSchema.parse((req.params as { kind?: string }).kind);
    connections.delete(kind);
    return reply.code(204).send();
  });

  // ── Creative generation ────────────────────────────────────────────────

  app.post('/creatives/generate', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = creativeGenerateRequestSchema.parse(req.body);
    const adapter = app.integrations.get(body.providerKind);
    const config = loadProviderConfig(body.providerKind);

    if (body.mode === 'text') {
      if (!adapter.generateText) {
        return reply
          .code(400)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/unsupported',
            title: 'Unsupported',
            status: 400,
            detail: `Provider ${body.providerKind} does not support text generation`,
          });
      }
      const result = await adapter.generateText(body.input, config);
      if (!result.ok) {
        return reply
          .code(result.error.httpStatus ?? 502)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/provider-error',
            title: result.error.code,
            status: result.error.httpStatus ?? 502,
            detail: result.error.message,
            providerKind: body.providerKind,
          });
      }
      return reply.code(201).send(result.data);
    }

    if (body.mode === 'image') {
      if (!adapter.generateImage) {
        return reply
          .code(400)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/unsupported',
            title: 'Unsupported',
            status: 400,
            detail: `Provider ${body.providerKind} does not support image generation`,
          });
      }
      const result = await adapter.generateImage(body.input, config);
      if (!result.ok) {
        return reply
          .code(result.error.httpStatus ?? 502)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/provider-error',
            title: result.error.code,
            status: result.error.httpStatus ?? 502,
            detail: result.error.message,
            providerKind: body.providerKind,
          });
      }
      return reply.code(201).send(result.data);
    }

    if (body.mode === 'video') {
      if (!adapter.generateVideo) {
        return reply
          .code(400)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/unsupported',
            title: 'Unsupported',
            status: 400,
            detail: `Provider ${body.providerKind} does not support video generation`,
          });
      }
      const result = await adapter.generateVideo(body.input, config);
      if (!result.ok) {
        return reply
          .code(result.error.httpStatus ?? 502)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/provider-error',
            title: result.error.code,
            status: result.error.httpStatus ?? 502,
            detail: result.error.message,
            providerKind: body.providerKind,
          });
      }
      return reply.code(202).send(result.data);
    }

    // avatar
    if (!adapter.generateAvatar) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${body.providerKind} does not support avatar generation`,
        });
    }
    const result = await adapter.generateAvatar(body.input, config);
    if (!result.ok) {
      return reply
        .code(result.error.httpStatus ?? 502)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/provider-error',
          title: result.error.code,
          status: result.error.httpStatus ?? 502,
          detail: result.error.message,
          providerKind: body.providerKind,
        });
    }
    return reply.code(202).send(result.data);
  });

  // ── Audience build ─────────────────────────────────────────────────────

  app.post('/audiences/build', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = audienceBuildRequestSchema.parse(req.body);
    const adapter = app.integrations.get(body.providerKind);
    if (!adapter.buildAudience) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${body.providerKind} does not support audience build`,
        });
    }
    const config = loadProviderConfig(body.providerKind);
    const result = await adapter.buildAudience(body.input, config);
    if (!result.ok) {
      return reply
        .code(result.error.httpStatus ?? 502)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/provider-error',
          title: result.error.code,
          status: result.error.httpStatus ?? 502,
          detail: result.error.message,
          providerKind: body.providerKind,
        });
    }
    return reply.code(201).send(result.data);
  });

  // ── Campaign delivery ──────────────────────────────────────────────────

  app.post('/campaigns/deliver', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = campaignDeliverRequestSchema.parse(req.body);
    const adapter = app.integrations.get(body.providerKind);
    if (!adapter.deliverCampaign) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${body.providerKind} does not support campaign delivery`,
        });
    }
    const config = loadProviderConfig(body.providerKind);
    const result = await adapter.deliverCampaign(body.input, config);
    if (!result.ok) {
      return reply
        .code(result.error.httpStatus ?? 502)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/provider-error',
          title: result.error.code,
          status: result.error.httpStatus ?? 502,
          detail: result.error.message,
          providerKind: body.providerKind,
        });
    }
    return reply.code(201).send(result.data);
  });

  // ── Inbound webhooks ───────────────────────────────────────────────────

  app.post('/webhooks/:kind', { config: { rawBody: true } }, async (req, reply) => {
    const kind = providerKindSchema.parse((req.params as { kind?: string }).kind);
    const adapter = app.integrations.get(kind);
    const config = loadProviderConfig(kind);
    if (!adapter.parseWebhook) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${kind} does not accept inbound webhooks`,
        });
    }
    const raw = Buffer.from(JSON.stringify(req.body ?? {}));
    const result = await adapter.parseWebhook(raw, req.headers, config);
    const entry: WebhookLogEntry = {
      id: `whk_${Date.now().toString(36)}`,
      providerKind: kind,
      receivedAt: new Date().toISOString(),
      signatureValid: result.ok,
      ...(result.ok ? { event: result.data } : { error: result.error.code }),
    };
    webhookLog.unshift(entry);
    if (webhookLog.length > 200) webhookLog.length = 200;
    if (!result.ok) {
      return reply.code(401).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/provider-error',
        title: result.error.code,
        status: 401,
        detail: result.error.message,
      });
    }
    return reply.code(202).send({ accepted: true, eventType: result.data.type });
  });

  app.get('/webhooks/:kind/recent', async (req) => {
    const kind = providerKindSchema.parse((req.params as { kind?: string }).kind);
    return webhookLog.filter((e) => e.providerKind === kind).slice(0, 50);
  });
}
