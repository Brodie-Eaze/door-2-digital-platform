/**
 * Conversion routes — Phase 1.3 real.
 *
 *   POST /v1/conversions                  polymorphic create (donation | sale).
 *                                         Same TX: Conversion + Donation|Sale + Lead.status='converted'.
 *   GET  /v1/conversions                  cursor-paginated list (filters).
 *   GET  /v1/conversions/:id              one with linked donation/sale.
 *   POST /v1/conversions/:id/refund       501 — Phase 1.4 refund + clawback.
 *   POST /v1/conversions/:id/dispute      501 — Phase 1.4 chargeback intake.
 *
 * All write paths require Idempotency-Key + JWT. attributionSource enum
 * drives billing rake at create time.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import {
  createConversion,
  disputeConversion,
  getConversion,
  listConversions,
  refundConversion,
} from './service';
import {
  createConversionRequestSchema,
  disputeConversionRequestSchema,
  listConversionsQuerySchema,
  refundConversionRequestSchema,
} from './schemas';

interface IdParams {
  id: string;
}

export async function registerConversion(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'conversion', status: 'live', phase: '1.4' }));

  // POST /v1/conversions — polymorphic create
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createConversionRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const conversion = await createConversion(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { conversion } };
      },
    });
  });

  // GET /v1/conversions
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listConversionsQuerySchema.parse(req.query);
    const result = await listConversions(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/conversions/:id
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const conversion = await getConversion(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ conversion });
  });

  // POST /v1/conversions/:id/refund — Phase 1.4
  // ADR-0019: instruct-only; operator executes the actual payment reversal manually.
  app.post<{ Params: IdParams }>('/:id/refund', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = refundConversionRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const refundInstruction = await refundConversion(req.params.id, body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: { refundInstruction } };
      },
    });
  });

  // POST /v1/conversions/:id/dispute — Phase 1.4
  app.post<{ Params: IdParams }>(
    '/:id/dispute',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = disputeConversionRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const dispute = await disputeConversion(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { dispute } };
        },
      });
    },
  );
}
