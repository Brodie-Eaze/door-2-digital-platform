/**
 * Sale routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - POST /v1/sales                              create sale tied to existing Conversion
 *   - GET  /v1/sales                              list (filter product, period, installer)
 *   - GET  /v1/sales/:id                          read with installer schedule + commission preview
 *   - PATCH /v1/sales/:id                         update product / contract metadata
 *   - POST /v1/sales/:id/installer-handoff        push to installer org + scheduling system
 *   - POST /v1/sales/:id/cancel                   cancel pre-install (refund + clawback)
 *
 * Cross-cutting:
 *   - Sales unlike Donations are one-shot; commission accrues on `conversion.finalised`
 *     but `installer-handoff` triggers the `sale.handoff.completed` webhook for
 *     downstream installer notification.
 *   - Refund/cancel path mirrors donation cancel — flips Commission rows to clawed_back.
 */
import type { FastifyInstance } from 'fastify';
import { createSaleRequestSchema, installerHandoffRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerSale(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'sale', status: 'scaffold', phase: '1.3' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createSaleRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Sale create lands in Phase 1.3',
    });
  });

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Sale read lands in Phase 1.3',
    }),
  );

  app.post('/:id/installer-handoff', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = installerHandoffRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Sale installer handoff lands in Phase 1.3',
    });
  });
}
