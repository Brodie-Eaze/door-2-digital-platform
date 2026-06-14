/**
 * Payment-domain Zod schemas — request validation for
 * `POST /v1/payment-methods/tokenize`
 * `POST /v1/payment-methods/:token/charge`
 * `POST /v1/payment-methods/:token/subscribe`
 * `DELETE /v1/payment-methods/:token/subscriptions/:subId`
 * `POST /v1/payment-methods/:token/refund`
 *
 * Raw card numbers NEVER hit D2D servers in production — tokenize is a
 * server-side sandbox helper only. The `tokenizeCard` endpoint is
 * conditionally available via the `D2D_PAYMENT_SANDBOX` env flag.
 */
import { z } from 'zod';
import { bigIntCentsSchema, paymentProviderSchema } from '@d2d/shared-types';

// ── Tokenize (sandbox / server-side only) ────────────────────────────────────

export const tokenizeCardRequestSchema = z
  .object({
    provider: paymentProviderSchema,
    cardNumber: z.string().min(13).max(19).regex(/^\d+$/, 'Must be digits only'),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int().min(2024).max(2099),
    cvv: z.string().min(3).max(4).regex(/^\d+$/, 'Must be digits only'),
    billingName: z.string().min(1).max(120),
    billingZip: z.string().max(20).optional(),
  })
  .strict();
export type TokenizeCardRequest = z.infer<typeof tokenizeCardRequestSchema>;

// ── Charge ────────────────────────────────────────────────────────────────────

export const chargeRequestSchema = z
  .object({
    provider: paymentProviderSchema,
    token: z.string().min(1).max(200),
    amountCents: bigIntCentsSchema,
    currency: z.string().length(3),
    description: z.string().min(1).max(500),
    merchantId: z.string().max(120).optional(),
  })
  .strict();
export type ChargeRequest = z.infer<typeof chargeRequestSchema>;

// ── Subscribe (recurring) ─────────────────────────────────────────────────────

export const subscribeRequestSchema = z
  .object({
    provider: paymentProviderSchema,
    token: z.string().min(1).max(200),
    amountCents: bigIntCentsSchema,
    currency: z.string().length(3),
    frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'annual']),
    startDate: z.string().datetime(),
    description: z.string().min(1).max(500),
    merchantId: z.string().max(120).optional(),
  })
  .strict();
export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;

// ── Refund ────────────────────────────────────────────────────────────────────

export const refundRequestSchema = z
  .object({
    provider: paymentProviderSchema,
    transactionId: z.string().min(1).max(120),
    amountCents: bigIntCentsSchema,
    reason: z.string().max(500).optional(),
  })
  .strict();
export type RefundRequest = z.infer<typeof refundRequestSchema>;
