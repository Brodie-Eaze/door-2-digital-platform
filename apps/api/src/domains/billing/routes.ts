/**
 * Billing routes — Phase 1.3.
 *
 *   GET  /v1/billing/invoices                  list invoices (filter status, cursor)
 *   GET  /v1/billing/invoices/:id              single invoice with line items
 *   POST /v1/billing/invoices/generate         generate from usage for a billing period
 *   GET  /v1/billing/processor-residuals       MiCamp/Stripe residual reconciliation
 */
import type { FastifyInstance } from 'fastify';
import { generateInvoiceRequestSchema } from '@d2d/shared-types';
import { ProblemError } from '@d2d/shared-utils';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { generateInvoice, listInvoices, getInvoice, getProcessorResiduals } from './service';
import { listInvoicesQuerySchema, residualsQuerySchema } from './schemas';

export async function registerBilling(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'billing', status: 'live', phase: '1.3' }));

  // GET /invoices — cursor-paginated list for this org
  app.get('/invoices', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listInvoicesQuerySchema.parse(req.query);
    const result = await listInvoices(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /invoices/:id — single invoice with line items
  app.get<{ Params: { id: string } }>(
    '/invoices/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      try {
        const invoice = await getInvoice(req.params.id, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return reply.code(200).send(invoice);
      } catch (err) {
        if (err instanceof ProblemError) {
          return reply.code(err.problem.status).type('application/problem+json').send(err.problem);
        }
        throw err;
      }
    },
  );

  // POST /invoices/generate — idempotent, creates invoice for a billing period
  app.post('/invoices/generate', { preHandler: requireAuth }, async (req, reply) => {
    requireIdempotencyKey(req);
    const ctx = requireTenant(req);
    const body = generateInvoiceRequestSchema.parse(req.body);
    try {
      const invoice = await generateInvoice(body, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(201).send(invoice);
    } catch (err) {
      if (err instanceof ProblemError) {
        return reply.code(err.problem.status).type('application/problem+json').send(err.problem);
      }
      throw err;
    }
  });

  // GET /processor-residuals — ISO residual reconciliation view
  app.get('/processor-residuals', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = residualsQuerySchema.parse(req.query);
    const result = await getProcessorResiduals(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });
}
