/**
 * Commission routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - GET /v1/commissions                          list (filter user, period, status); cursor-paginated
 *   - GET /v1/commissions/projection               projected payout for current period (live)
 *   - GET /v1/commissions/:id                      single commission with derivation trail
 *   - POST /v1/commissions/:id/adjust              manager adjustment (+/- with audit reason)
 *
 * Cross-cutting:
 *   - Plans defined in `CommissionPlan`: per_knock | per_appointment | per_conversion | override.
 *     Crew-leader override is computed by joining knocker → manager hierarchy.
 *   - Calc happens in `commission-calc` worker (BullMQ); this API serves results.
 *   - Projection endpoint reads accrued + estimates remaining via period-to-date run-rate.
 *   - Money in BigInt cents; never floating point.
 */
import type { FastifyInstance } from 'fastify';
import { commissionQuerySchema } from '@d2d/shared-types';

export async function registerCommission(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'commission', status: 'scaffold', phase: '1.3' }));

  app.get('/', async (req, reply) => {
    const parsed = commissionQuerySchema.parse(req.query);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Commission list lands in Phase 1.3',
    });
  });

  app.get('/projection', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Commission projection lands in Phase 1.3',
    }),
  );

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Commission read lands in Phase 1.3',
    }),
  );
}
