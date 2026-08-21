/**
 * Field-signup domain Zod schema — request body for `POST /v1/field/signups`.
 *
 * This is the SIMPLE door-step shape the native Knocker app can construct in
 * the field: a customer name, optional contact PII, the service signed up for,
 * and the recurring frequency. The server derives everything the rich
 * `POST /v1/conversions` endpoint demands (leadId, ConversionType,
 * attributionSource, currency, paymentProvider) so a field rep never has to.
 *
 * LENIENT on purpose — `.strip()` (the Zod default) drops unknown keys instead
 * of rejecting them. The iOS `CreateSaleRequest` sends a few server-derived
 * extras (orgId, leadId, idempotencyKey) that we deliberately ignore here:
 *   - orgId          — NEVER trusted from the body; taken from the auth context.
 *   - leadId         — created server-side; a client-supplied one is ignored.
 *   - idempotencyKey — carried in the `Idempotency-Key` header, not the body.
 */
import { z } from 'zod';

/**
 * Field frequency as the iOS client sends it. `once` => one-off donation (no
 * recurring frequency); `weekly`/`monthly` => recurring donation mapped to the
 * DonationFrequency enum in the service.
 */
export const fieldSignupFrequencySchema = z.enum(['monthly', 'weekly', 'once']);
export type FieldSignupFrequency = z.infer<typeof fieldSignupFrequencySchema>;

export const createFieldSignupRequestSchema = z
  .object({
    knockId: z.string().min(1).max(64).optional(),
    customerName: z.string().min(1).max(400),
    customerPhone: z.string().max(50).optional(),
    customerEmail: z.string().email().toLowerCase().max(320).optional(),
    addressLine: z.string().max(500).optional(),
    serviceId: z.string().min(1).max(120),
    serviceName: z.string().min(1).max(200),
    amountCents: z.number().int().min(0),
    frequency: fieldSignupFrequencySchema,
    signedAt: z.string().datetime().optional(),
    signatureKey: z.string().max(500).optional(),
  })
  // NOTE: default `.strip()` (NOT `.strict()`) — unknown keys the iOS client
  // sends (orgId, leadId, idempotencyKey) are dropped, not rejected.
  .strip();
export type CreateFieldSignupRequest = z.infer<typeof createFieldSignupRequestSchema>;
