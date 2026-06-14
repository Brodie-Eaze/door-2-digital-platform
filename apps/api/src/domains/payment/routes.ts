/**
 * Payment routes — Phase 1.3.
 *
 *   POST /v1/payments/tokenize
 *     Server-side card tokenization. Gated by D2D_PAYMENT_SANDBOX env flag —
 *     returns 403 in production. Raw PANs must never reach D2D servers in
 *     real usage; clients use the provider's hosted fields / JS-SDK instead.
 *
 *   POST /v1/payments/charge
 *     One-off charge against a vaulted token.
 *     Returns chargeResult + ISO residual cents for ledger.
 *
 *   POST /v1/payments/subscribe
 *     Create a recurring subscription (weekly/fortnightly/monthly/annual).
 *
 *   DELETE /v1/payments/subscriptions/:subscriptionId
 *     Cancel an active subscription.
 *
 *   POST /v1/payments/refund
 *     Full or partial refund against a prior transaction.
 *
 * All mutation routes require:
 *   - Valid JWT (requireAuth)
 *   - Idempotency-Key header (withIdempotency)
 *
 * Response shapes are the raw adapter results so the caller can persist
 * `transactionId`, `processorResidualCents`, etc. to the Conversion row.
 */
import { env } from '../../config/env';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { newId } from '@d2d/shared-utils';
import { getAdapter } from './service';
import {
  chargeRequestSchema,
  refundRequestSchema,
  subscribeRequestSchema,
  tokenizeCardRequestSchema,
} from './schemas';

interface SubParams {
  subscriptionId: string;
}

export async function registerPayment(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'payment', status: 'live', phase: '1.3' }));

  // POST /v1/payments/tokenize — SANDBOX ONLY
  app.post('/tokenize', { preHandler: requireAuth }, async (req, reply) => {
    const e = env();
    if (!e.D2D_PAYMENT_SANDBOX) {
      return reply.code(403).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail:
          'Server-side card tokenization is disabled in production. Use provider hosted fields.',
      });
    }

    requireTenant(req);
    const body = tokenizeCardRequestSchema.parse(req.body);
    const adapter = getAdapter(body.provider);
    const tokenized = await adapter.tokenizeCard({
      cardNumber: body.cardNumber,
      expiryMonth: body.expiryMonth,
      expiryYear: body.expiryYear,
      cvv: body.cvv,
      billingName: body.billingName,
      billingZip: body.billingZip,
    });

    return reply.code(200).send({ tokenizedCard: tokenized });
  });

  // POST /v1/payments/charge
  app.post('/charge', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = chargeRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const adapter = getAdapter(body.provider);
        const result = await adapter.charge({
          token: body.token,
          amountCents: body.amountCents,
          currency: body.currency,
          description: body.description,
          merchantId: body.merchantId,
          idempotencyKey: (req.headers['idempotency-key'] as string) ?? newId('idem'),
        });
        // Serialise BigInt → string for JSON transport.
        return {
          status: result.status === 'approved' ? 201 : 402,
          body: {
            charge: {
              ...result,
              processorResidualCents: result.processorResidualCents.toString(),
            },
          },
        };
      },
    });
  });

  // POST /v1/payments/subscribe
  app.post('/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = subscribeRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const adapter = getAdapter(body.provider);
        const result = await adapter.createSubscription({
          token: body.token,
          amountCents: body.amountCents,
          currency: body.currency,
          frequency: body.frequency,
          startDate: new Date(body.startDate),
          description: body.description,
          merchantId: body.merchantId,
          idempotencyKey: (req.headers['idempotency-key'] as string) ?? newId('idem'),
        });
        return {
          status: result.status === 'error' ? 422 : 201,
          body: {
            subscription: {
              ...result,
              nextBillingDate: result.nextBillingDate.toISOString(),
              processorResidualCents: result.processorResidualCents.toString(),
            },
          },
        };
      },
    });
  });

  // DELETE /v1/payments/subscriptions/:subscriptionId
  app.delete<{ Params: SubParams }>(
    '/subscriptions/:subscriptionId',
    { preHandler: requireAuth },
    async (req, reply) => {
      requireTenant(req);
      // Provider must be passed as a query param since DELETE has no body.
      const provider = (req.query as Record<string, string>)['provider'];
      if (!provider) {
        return reply.code(400).type('application/problem+json').send({
          type: 'https://docs.d2d.io/problems/validation',
          title: 'Bad Request',
          status: 400,
          detail: '`provider` query parameter is required (micamp | stripe_au | stripe_sg)',
        });
      }
      const adapter = getAdapter(provider as Parameters<typeof getAdapter>[0]);
      const result = await adapter.cancelSubscription(req.params.subscriptionId);
      return reply.code(200).send({
        cancellation: {
          ...result,
          cancelledAt: result.cancelledAt.toISOString(),
        },
      });
    },
  );

  // POST /v1/payments/refund
  app.post('/refund', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = refundRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const adapter = getAdapter(body.provider);
        const result = await adapter.refund({
          transactionId: body.transactionId,
          amountCents: body.amountCents,
          reason: body.reason,
          idempotencyKey: (req.headers['idempotency-key'] as string) ?? newId('idem'),
        });
        return {
          status: result.status === 'approved' ? 200 : 422,
          body: {
            refund: {
              ...result,
              refundedCents: result.refundedCents.toString(),
            },
          },
        };
      },
    });
  });
}
