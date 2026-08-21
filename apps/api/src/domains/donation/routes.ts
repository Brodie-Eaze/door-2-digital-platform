/**
 * Donation routes — Phase 1.3 real.
 *
 *   GET   /v1/donations/:id                read
 *   POST  /v1/donations/:id/pause          pause recurring (audit-trailed)
 *   POST  /v1/donations/:id/cancel         cancel + cancelledAt (audit-trailed)
 *   POST  /v1/donations/:id/change-amount  change recurring amount (validates recurring)
 *   POST  /v1/donations/:id/resume         resume a paused recurring donation
 *   POST  /v1/donations/:id/receipt        regenerate + re-send IRS/DGR receipt PDF
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import {
  cancelDonation,
  changeDonationAmount,
  generateDonationReceipt,
  getDonation,
  pauseDonation,
  resumeDonation,
} from './service';
import {
  cancelDonationRequestSchema,
  changeDonationAmountRequestSchema,
  generateReceiptRequestSchema,
  pauseDonationRequestSchema,
  resumeDonationRequestSchema,
} from './schemas';

interface IdParams {
  id: string;
}

export async function registerDonation(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'donation',
    status: 'live',
    phase: '1.3',
  }));

  // GET /v1/donations/:id
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const donation = await getDonation(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ donation });
  });

  // POST /v1/donations/:id/pause
  app.post<{ Params: IdParams }>('/:id/pause', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = pauseDonationRequestSchema.parse(req.body ?? {});
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const donation = await pauseDonation(req.params.id, body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: { donation } };
      },
    });
  });

  // POST /v1/donations/:id/cancel
  app.post<{ Params: IdParams }>('/:id/cancel', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = cancelDonationRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const donation = await cancelDonation(req.params.id, body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: { donation } };
      },
    });
  });

  // POST /v1/donations/:id/change-amount
  app.post<{ Params: IdParams }>(
    '/:id/change-amount',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = changeDonationAmountRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const donation = await changeDonationAmount(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { donation } };
        },
      });
    },
  );

  // POST /v1/donations/:id/resume
  app.post<{ Params: IdParams }>('/:id/resume', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = resumeDonationRequestSchema.parse(req.body ?? {});
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const donation = await resumeDonation(req.params.id, body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: { donation } };
      },
    });
  });

  // POST /v1/donations/:id/receipt
  app.post<{ Params: IdParams }>(
    '/:id/receipt',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = generateReceiptRequestSchema.parse(req.body ?? {});
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const receipt = await generateDonationReceipt(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { receipt } };
        },
      });
    },
  );
}
