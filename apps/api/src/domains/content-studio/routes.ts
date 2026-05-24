/**
 * Content-Studio routes — Phase 0 stubs.
 *
 * Full implementation Phase 3 (AI generation pipelines):
 *   - POST /v1/content-studio/jobs/copy            ad copy generation via Claude/OpenAI
 *   - POST /v1/content-studio/jobs/image           image generation via FLUX
 *   - POST /v1/content-studio/jobs/video           video generation via Runway/HeyGen
 *   - GET  /v1/content-studio/jobs                 list jobs (filter status, kind, brandKitId)
 *   - GET  /v1/content-studio/jobs/:id             read job with variants + provider cost cents
 *   - POST /v1/content-studio/jobs/:id/cancel      cancel queued/running job
 *   - POST /v1/content-studio/jobs/:id/approve     mark variant approved → moves to Creative table
 *
 * Cross-cutting:
 *   - All jobs queued to BullMQ (`content-generate` worker); long-running, callbacks via webhook.
 *   - Per-org monthly AI budget enforced; over-budget returns 429 PROBLEM_BUDGET_EXHAUSTED.
 *   - Brand kit (logo, palette, voice) loaded from BrandKit table; passed to prompt.
 *   - Output assets staged in `s3://d2d-<region>-content-studio/<org>/<job>/<variant>`.
 */
import type { FastifyInstance } from 'fastify';
import { contentJobRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerContentStudio(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({
    domain: 'content-studio',
    status: 'scaffold',
    phase: '3',
  }));

  app.post('/jobs/copy', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = contentJobRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Content-studio copy job lands in Phase 3',
    });
  });

  app.post('/jobs/image', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = contentJobRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Content-studio image job lands in Phase 3',
    });
  });

  app.post('/jobs/video', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = contentJobRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Content-studio video job lands in Phase 3',
    });
  });

  app.get('/jobs/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Content-studio job read lands in Phase 3',
    }),
  );
}
