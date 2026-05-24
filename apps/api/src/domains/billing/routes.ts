/**
 * Billing routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - GET  /v1/billing/invoices                    list invoices (filter org, period, status)
 *   - GET  /v1/billing/invoices/:id                read invoice with line items + PDF URL
 *   - POST /v1/billing/invoices/generate           generate from usage for a billing period
 *   - POST /v1/billing/invoices/:id/finalise       lock + mark sent (Stripe invoice id stored)
 *   - GET  /v1/billing/processor-residuals         MiCamp/Stripe residuals reconciliation report
 *   - POST /v1/billing/processor-residuals/import  upload monthly processor residual CSV
 *
 * Cross-cutting:
 *   - Platform-fee model per `OrgBilling` (rates, currency, billing period).
 *   - MiCamp ISO residuals (US payment volume) imported nightly + reconciled to charges.
 *   - Invoice generation idempotent per (org, periodStart, periodEnd).
 *   - All amounts in BigInt cents (ADR-0007).
 */
import type { FastifyInstance } from 'fastify';
import { generateInvoiceRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerBilling(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'billing', status: 'scaffold', phase: '1.3' }));

  app.get('/invoices', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Billing invoice list lands in Phase 1.3',
    }),
  );

  app.get('/invoices/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Billing invoice read lands in Phase 1.3',
    }),
  );

  app.post('/invoices/generate', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = generateInvoiceRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Billing invoice generate lands in Phase 1.3',
    });
  });

  app.get('/processor-residuals', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Processor residuals report lands in Phase 1.3',
    }),
  );
}
