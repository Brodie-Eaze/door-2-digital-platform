/**
 * Payout-batch routes — Phase 1.3 real.
 *
 *   POST /v1/payout-batches                       generate batch from accrued commissions
 *   GET  /v1/payout-batches                       list (filter period, status)
 *   GET  /v1/payout-batches/:id                   read batch + line count
 *   POST /v1/payout-batches/:id/lock              draft → ready_to_pay
 *   GET  /v1/payout-batches/:id/instruction-file  download CSV for bank upload
 *   POST /v1/payout-batches/:id/acknowledge       instructed → acknowledged
 *
 * THE PLATFORM NEVER AUTO-PAYS (ADR-0019).
 * Instruction-file download marks the batch 'instructed'; Brodie executes
 * the transfer manually in the bank portal.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireWebAuthnStepUp } from '../../shared/middleware/webauthn-step-up';
import { requireIdempotencyKey, withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import {
  acknowledgePayoutBatch,
  generateInstructionFile,
  generatePayoutBatch,
  getPayoutBatch,
  listPayoutBatches,
  lockPayoutBatch,
} from './service';
import { createPayoutBatchBodySchema, listPayoutBatchesQuerySchema } from './schemas';

interface IdParams {
  id: string;
}

export async function registerPayout(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'payout', status: 'live', phase: '1.3' }));

  // POST /v1/payout-batches
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createPayoutBatchBodySchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const batch = await generatePayoutBatch(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { batch } };
      },
    });
  });

  // GET /v1/payout-batches
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listPayoutBatchesQuerySchema.parse(req.query);
    const result = await listPayoutBatches(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/payout-batches/:id
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const batch = await getPayoutBatch(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ batch });
  });

  // POST /v1/payout-batches/:id/lock  (draft → ready_to_pay)
  // ADR-0026: hardware-key step-up required before locking a batch for payout.
  app.post<{ Params: IdParams }>(
    '/:id/lock',
    { preHandler: [requireAuth, requireWebAuthnStepUp] },
    async (req, reply) => {
      requireIdempotencyKey(req);
      const ctx = requireTenant(req);
      const batch = await lockPayoutBatch(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ batch });
    },
  );

  // GET /v1/payout-batches/:id/instruction-file
  // Returns a CSV download; marks batch 'instructed' on first download.
  // ADR-0026: hardware-key step-up required to download the instruction file.
  app.get<{ Params: IdParams }>(
    '/:id/instruction-file',
    { preHandler: [requireAuth, requireWebAuthnStepUp] },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const { csv, filename } = await generateInstructionFile(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply
        .code(200)
        .type('text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csv);
    },
  );

  // POST /v1/payout-batches/:id/acknowledge  (instructed → acknowledged)
  app.post<{ Params: IdParams }>(
    '/:id/acknowledge',
    { preHandler: requireAuth },
    async (req, reply) => {
      requireIdempotencyKey(req);
      const ctx = requireTenant(req);
      const batch = await acknowledgePayoutBatch(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ batch });
    },
  );
}
