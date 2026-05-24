/**
 * Knock routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST /v1/knocks                       single knock (online path; idempotency REQUIRED)
 *   - POST /v1/knocks/batch                 offline reconcile (up to 500 knocks per batch,
 *                                           body limit bumped to 10 MB; per-knock idempotency
 *                                           inside `batchId` envelope)
 *   - GET  /v1/knocks                       list (filter session, territory, disposition, date);
 *                                           cursor-paginated
 *   - GET  /v1/knocks/:id                   read single knock with attachments
 *   - PATCH /v1/knocks/:id/disposition      manager-only correction (audit-logged + reason)
 *
 * Cross-cutting:
 *   - Idempotency-Key required on `/` POST. Batch uses `batchId` + per-knock `clientId`.
 *   - GPS fabrication detector runs server-side; flagged knocks land in `risk.flagged_knock`.
 *   - PII (notes, leadDraft) encrypted at rest via `services/pii-vault`.
 *   - Photo/signature uploads pre-signed via `POST /v1/uploads/sign` (separate module).
 *   - Emits `knock.created` webhook; publishes to Ably channel
 *     `org:<id>:territory:<id>:knocks` for live operator console.
 */
import type { FastifyInstance } from 'fastify';
import { createKnockRequestSchema, knockBatchRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerKnock(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'knock', status: 'scaffold', phase: '1.2' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createKnockRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Knock create lands in Phase 1.2',
    });
  });

  app.post('/batch', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = knockBatchRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Knock batch sync lands in Phase 1.2',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Knock list lands in Phase 1.2',
    }),
  );
}
