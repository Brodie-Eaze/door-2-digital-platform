/**
 * Sale routes — Phase 1.3 real (read + installer-handoff).
 *
 *   GET   /v1/sales/:id                       read with installer schedule
 *   POST  /v1/sales/:id/installer-handoff     set installer + scheduled install date
 *   POST  /v1/sales                           501 — sales are created via /v1/conversions
 *   POST  /v1/sales/:id/cancel                501 — Phase 1.4 refund + clawback
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { z } from 'zod';
import { getSale, installerHandoff, updateSaleStatus } from './service';
import { installerHandoffRequestSchema } from './schemas';

interface IdParams {
  id: string;
}

export async function registerSale(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'sale', status: 'live', phase: '1.3' }));

  // POST /v1/sales — 501, sales are created via /v1/conversions
  app.post('/', { preHandler: requireAuth }, async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Create a sale via POST /v1/conversions with type=sale_commercial',
    }),
  );

  // GET /v1/sales/:id
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const sale = await getSale(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ sale });
  });

  // POST /v1/sales/:id/installer-handoff
  app.post<{ Params: IdParams }>(
    '/:id/installer-handoff',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = installerHandoffRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const sale = await installerHandoff(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { sale } };
        },
      });
    },
  );

  // PATCH /v1/sales/:id/status — transition sale status.
  // Valid: pending_install → installed | cancelled; installed → cancelled.
  const statusBodySchema = z.object({ status: z.enum(['installed', 'cancelled']) }).strict();

  app.patch<{ Params: IdParams }>(
    '/:id/status',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = statusBodySchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const sale = await updateSaleStatus(req.params.id, body.status, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { sale } };
        },
      });
    },
  );

  // POST /v1/sales/:id/cancel — Phase 1.4
  app.post<{ Params: IdParams }>('/:id/cancel', { preHandler: requireAuth }, async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Sale cancel + clawback lands in Phase 1.4',
    }),
  );
}
