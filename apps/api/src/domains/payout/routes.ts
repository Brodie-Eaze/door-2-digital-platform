/**
 * Payout-batch routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - POST /v1/payout-batches                      generate batch from accrued commissions
 *   - GET  /v1/payout-batches                      list (filter period, status)
 *   - GET  /v1/payout-batches/:id                  read batch + line items
 *   - POST /v1/payout-batches/:id/lock             lock for payment (status → ready_to_pay)
 *   - GET  /v1/payout-batches/:id/instruction-file download CSV/ABA/NACHA instruction file
 *                                                  (region-specific format)
 *   - POST /v1/payout-batches/:id/acknowledge      mark instructed → acknowledged
 *                                                  (after Brodie confirms transfer in bank app)
 *   - POST /v1/payout-batches/:id/archive          archive after acknowledged
 *
 * Cross-cutting:
 *   - **The platform NEVER auto-pays.** It computes + emits an instruction file
 *     (ABA for AU, NACHA for US, GIRO for SG). Brodie executes the transfer manually.
 *   - Lock is irreversible: locked batches become the source of truth for accounting.
 *   - Each lock writes `payout.locked` webhook + audit row.
 */
import type { FastifyInstance } from 'fastify';
import { createPayoutBatchRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';

export async function registerPayout(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'payout',
    status: 'scaffold',
    phase: '1.3',
  }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createPayoutBatchRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Payout batch generate lands in Phase 1.3',
    });
  });

  app.post('/:id/lock', async (req, reply) => {
    requireIdempotencyKey(req);
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Payout batch lock lands in Phase 1.3',
    });
  });

  app.get('/:id/instruction-file', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Payout instruction file download lands in Phase 1.3',
    }),
  );
}
