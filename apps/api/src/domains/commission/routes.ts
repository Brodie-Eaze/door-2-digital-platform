/**
 * Commission routes — Phase 1.3 real.
 *
 *   GET  /v1/commissions                    cursor-paginated list (per-org; filter user/period/status)
 *   GET  /v1/commissions/projection         projected payout for current calendar period
 *   GET  /v1/commissions/:id                one commission with metadata
 *   POST /v1/commissions/:id/adjust         manager ± adjustment (audit-trailed)
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { adjustCommission, getCommission, getProjection, listCommissions } from './service';
import { adjustCommissionBodySchema, listCommissionsQuerySchema } from './schemas';

interface IdParams {
  id: string;
}

export async function registerCommission(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'commission', status: 'live', phase: '1.3' }));

  // GET /v1/commissions
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listCommissionsQuerySchema.parse(req.query);
    const result = await listCommissions(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      role: ctx.role,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/commissions/projection — must come before /:id to avoid ambiguity
  app.get('/projection', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const projection = await getProjection({
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      role: ctx.role,
    });
    return reply.code(200).send({ projection });
  });

  // GET /v1/commissions/:id
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const commission = await getCommission(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      role: ctx.role,
    });
    return reply.code(200).send({ commission });
  });

  // POST /v1/commissions/:id/adjust — manager+ only (enforced in service)
  app.post<{ Params: IdParams }>('/:id/adjust', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = adjustCommissionBodySchema.parse(req.body);
    const commission = await adjustCommission(
      req.params.id,
      { amountCents: body.amountCents, reason: body.reason },
      { userId: ctx.userId, orgId: ctx.orgId, regionCode: ctx.regionCode as never, role: ctx.role },
    );
    return reply.code(200).send({ commission });
  });
}
