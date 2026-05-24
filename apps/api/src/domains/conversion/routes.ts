/**
 * Conversion routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - POST /v1/conversions                  polymorphic create (donation | sale);
 *                                           idempotency REQUIRED; tokenised payment method only
 *   - GET  /v1/conversions                  list (filter type, attribution, period, knocker)
 *   - GET  /v1/conversions/:id              read with linked Donation | Sale + Commission preview
 *   - POST /v1/conversions/:id/finalise     server-side finaliser (worker uses this internally
 *                                           after payment-provider webhook confirms); 423 if
 *                                           called from public API
 *   - POST /v1/conversions/:id/refund       initiate refund + emit clawback worker
 *
 * Cross-cutting:
 *   - Idempotent finalisation via `IdempotencyRecord` (24h TTL).
 *   - Attribution rake: door | inside_sales | retargeting | other → drives commission split.
 *   - State-clearance gate (charity_us only): rejects with 409 PROBLEM_STATE_NOT_CLEARED
 *     if `PaidSolicitorRegistration.status != approved` for donor state.
 *   - On success, emits `conversion.created` + `conversion.finalised` webhooks
 *     and enqueues `commission-calc` worker.
 */
import type { FastifyInstance } from 'fastify';
import { createConversionRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerConversion(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'conversion', status: 'scaffold', phase: '1.3' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createConversionRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Conversion create lands in Phase 1.3',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Conversion list lands in Phase 1.3',
    }),
  );

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Conversion read lands in Phase 1.3',
    }),
  );
}
