/**
 * Content-Studio routes — the AI creative-job surface.
 *
 * This is the "kick off a generation, get a job id, poll" half of the
 * Marketing Studio (the marketing-studio routes handle the dispatch to
 * ad networks). The same adapters power both surfaces — content-studio
 * routes are a UX-friendly facade defaulting to the right provider per
 * media kind.
 *
 * Mount: `app.register(registerContentStudio, { prefix: '/v1/content-studio' })`.
 *
 *   - POST  /jobs/copy        text generation via claude_copy (fallback openai_copy)
 *   - POST  /jobs/image       image via flux_image (fallback ideogram_image)
 *   - POST  /jobs/video       video via runway_video (fallback higgsfield)
 *   - POST  /jobs/avatar      avatar via heygen_avatar
 *   - GET   /jobs/:id         poll job status (in-memory job tracker)
 *   - GET   /providers        snapshot of integrations registry
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProviderKind } from '@d2d/integrations';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

// ── In-memory job tracker (Phase 3.1 → migrate to ContentJob Prisma table) ──

interface JobRecord {
  id: string;
  kind: 'copy' | 'image' | 'video' | 'avatar';
  providerKind: ProviderKind;
  status: 'pending' | 'running' | 'ready' | 'failed';
  createdAt: string;
  readyAt?: string;
  result?: unknown;
  error?: string;
}

const jobs = new Map<string, JobRecord>();

function newJobId(): string {
  return `csj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Request schemas (slim — reuse adapter shapes via providerKind override) ──

const copyJobSchema = z.object({
  prompt: z.string().min(1).max(8000),
  brandVoice: z.string().max(1000).optional(),
  vertical: z.enum(['charity', 'commercial', 'healthcare']).optional(),
  region: z.enum(['US', 'AU', 'SG']).optional(),
  channel: z.enum(['meta', 'google', 'tiktok', 'youtube', 'email', 'sms', 'door']).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  providerOverride: z.enum(['claude_copy', 'openai_copy']).optional(),
});

const imageJobSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:2']),
  brandColors: z.array(z.string().max(20)).max(8).optional(),
  styleRef: z.string().max(500).optional(),
  count: z.number().int().min(1).max(8),
  providerOverride: z.enum(['flux_image', 'ideogram_image']).optional(),
});

const videoJobSchema = z.object({
  prompt: z.string().min(1).max(4000),
  durationSec: z.number().int().min(2).max(60),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']),
  styleRef: z.string().max(500).optional(),
  providerOverride: z.enum(['runway_video', 'higgsfield']).optional(),
});

const avatarJobSchema = z.object({
  script: z.string().min(1).max(4000),
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  background: z.string().max(120).optional(),
});

export async function registerContentStudio(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'content-studio', status: 'live', phase: '3' }));

  app.get('/providers', async () => app.integrations.describe());

  // ── Copy ──────────────────────────────────────────────────────────────

  app.post('/jobs/copy', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = copyJobSchema.parse(req.body);
    const providerKind: ProviderKind = body.providerOverride ?? 'claude_copy';
    const adapter = app.integrations.get(providerKind);
    if (!adapter.generateText) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${providerKind} does not support text`,
        });
    }
    const id = newJobId();
    jobs.set(id, {
      id,
      kind: 'copy',
      providerKind,
      status: 'running',
      createdAt: new Date().toISOString(),
    });
    const result = await adapter.generateText(
      {
        prompt: body.prompt,
        brandVoice: body.brandVoice,
        vertical: body.vertical,
        region: body.region,
        channel: body.channel,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      },
      { credentials: {}, mode: 'sandbox' },
    );
    const record = jobs.get(id)!;
    if (result.ok) {
      record.status = 'ready';
      record.readyAt = new Date().toISOString();
      record.result = result.data;
    } else {
      record.status = 'failed';
      record.error = result.error.code;
    }
    return reply.code(202).send({ jobId: id, status: record.status });
  });

  // ── Image ─────────────────────────────────────────────────────────────

  app.post('/jobs/image', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = imageJobSchema.parse(req.body);
    const providerKind: ProviderKind = body.providerOverride ?? 'flux_image';
    const adapter = app.integrations.get(providerKind);
    if (!adapter.generateImage) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${providerKind} does not support image`,
        });
    }
    const id = newJobId();
    jobs.set(id, {
      id,
      kind: 'image',
      providerKind,
      status: 'running',
      createdAt: new Date().toISOString(),
    });
    const result = await adapter.generateImage(
      {
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        brandColors: body.brandColors,
        styleRef: body.styleRef,
        count: body.count,
      },
      { credentials: {}, mode: 'sandbox' },
    );
    const record = jobs.get(id)!;
    if (result.ok) {
      record.status = 'ready';
      record.readyAt = new Date().toISOString();
      record.result = result.data;
    } else {
      record.status = 'failed';
      record.error = result.error.code;
    }
    return reply.code(202).send({ jobId: id, status: record.status });
  });

  // ── Video ─────────────────────────────────────────────────────────────

  app.post('/jobs/video', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = videoJobSchema.parse(req.body);
    const providerKind: ProviderKind = body.providerOverride ?? 'runway_video';
    const adapter = app.integrations.get(providerKind);
    if (!adapter.generateVideo) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${providerKind} does not support video`,
        });
    }
    const id = newJobId();
    jobs.set(id, {
      id,
      kind: 'video',
      providerKind,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    const result = await adapter.generateVideo(
      {
        prompt: body.prompt,
        durationSec: body.durationSec,
        aspectRatio: body.aspectRatio,
        styleRef: body.styleRef,
      },
      { credentials: {}, mode: 'sandbox' },
    );
    const record = jobs.get(id)!;
    if (result.ok) {
      record.status = 'pending';
      record.readyAt = result.data.estimatedReadyAt;
      record.result = result.data;
    } else {
      record.status = 'failed';
      record.error = result.error.code;
    }
    return reply.code(202).send({ jobId: id, status: record.status });
  });

  // ── Avatar ────────────────────────────────────────────────────────────

  app.post('/jobs/avatar', async (req, reply) => {
    requireIdempotencyKey(req);
    const body = avatarJobSchema.parse(req.body);
    const providerKind: ProviderKind = 'heygen_avatar';
    const adapter = app.integrations.get(providerKind);
    if (!adapter.generateAvatar) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/unsupported',
          title: 'Unsupported',
          status: 400,
          detail: `Provider ${providerKind} does not support avatar`,
        });
    }
    const id = newJobId();
    jobs.set(id, {
      id,
      kind: 'avatar',
      providerKind,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    const result = await adapter.generateAvatar(body, { credentials: {}, mode: 'sandbox' });
    const record = jobs.get(id)!;
    if (result.ok) {
      record.status = 'pending';
      record.readyAt = result.data.estimatedReadyAt;
      record.result = result.data;
    } else {
      record.status = 'failed';
      record.error = result.error.code;
    }
    return reply.code(202).send({ jobId: id, status: record.status });
  });

  // ── Job status ────────────────────────────────────────────────────────

  app.get('/jobs/:id', async (req, reply) => {
    const id = (req.params as { id?: string }).id;
    if (!id) {
      return reply.code(400).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/validation-failed',
        title: 'Bad request',
        status: 400,
        detail: 'id required',
      });
    }
    const record = jobs.get(id);
    if (!record) {
      return reply
        .code(404)
        .type('application/problem+json')
        .send({
          type: 'https://docs.d2d.io/problems/not-found',
          title: 'Not found',
          status: 404,
          detail: `job ${id} not found`,
        });
    }
    return record;
  });
}
