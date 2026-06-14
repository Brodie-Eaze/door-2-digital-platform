/**
 * Do-Not-Call (DNC) routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST /v1/do-not-call/scrub                   scrub a list of phones; returns
 *                                                  `{ allowed: string[], blocked: string[] }`
 *   - POST /v1/do-not-call/ingest                  nightly ingest from registry
 *                                                  (US DNC, AU DNCR/TPS, SG PDPA)
 *   - GET  /v1/do-not-call/sources                 list configured ingestion sources + last-sync
 *   - DELETE /v1/do-not-call/:id                   remove (after retention; audit-logged)
 *
 * Cross-cutting:
 *   - Phone numbers hashed with deterministic-SIV so we can scrub without storing plaintext.
 *   - Scrub path Redis-cached per region (TTL 4h).
 *   - Outbound dialler integrations call this before every dial.
 */
import type { FastifyInstance } from 'fastify';
import { dncScrubRequestSchema, dncIngestRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';

export async function registerDoNotCall(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'do-not-call',
    status: 'scaffold',
    phase: '1.2',
  }));

  app.post('/scrub', async (req, reply) => {
    const parsed = dncScrubRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DNC scrub lands in Phase 1.2',
    });
  });

  app.post('/ingest', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = dncIngestRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DNC ingest lands in Phase 1.2',
    });
  });
}
