/**
 * Do-Not-Knock (DNK) routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST /v1/do-not-knock/check                  precheck a single address (called by mobile app
 *                                                  before allowing a knock to be recorded)
 *   - POST /v1/do-not-knock/ingest                 bulk ingest (up to 10k rows) from registry feed
 *                                                  or manager flag
 *   - GET  /v1/do-not-knock                        list (cursor-paginated; admin only)
 *   - DELETE /v1/do-not-knock/:id                  remove (after retention period expires;
 *                                                  audit-logged)
 *
 * Cross-cutting:
 *   - Address hashed with `services/pii-vault.deterministicHash` so we never store
 *     plaintext street-level data alongside the DNK flag.
 *   - DNK precheck path uses Redis cache (TTL 1h) — bulk ingest invalidates cache by region.
 *   - Per region: AU = self-managed + opt-out registry; US = state DNK lists ingested nightly;
 *     SG = PDPA registry.
 */
import type { FastifyInstance } from 'fastify';
import { dnkCheckRequestSchema, dnkIngestRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';

export async function registerDoNotKnock(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'do-not-knock',
    status: 'scaffold',
    phase: '1.2',
  }));

  app.post('/check', async (req, reply) => {
    const parsed = dnkCheckRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DNK check lands in Phase 1.2',
    });
  });

  app.post('/ingest', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = dnkIngestRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DNK ingest lands in Phase 1.2',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DNK list lands in Phase 1.2',
    }),
  );
}
