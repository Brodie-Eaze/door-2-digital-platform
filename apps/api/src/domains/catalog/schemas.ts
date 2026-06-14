/**
 * Catalog-domain Zod schemas — per-tenant ServiceOffering create / patch.
 *
 * The catalog is what the native Knocker app fetches (GET /v1/catalog) so each
 * charity/business runs its own giving tiers / product plans. `frequency` and
 * `vertical` mirror the field-signup contract exactly (the offering a knocker
 * picks here is what they sign a customer up to there).
 */
import { z } from 'zod';

export const offeringFrequencySchema = z.enum(['monthly', 'weekly', 'once']);
export type OfferingFrequency = z.infer<typeof offeringFrequencySchema>;

export const offeringVerticalSchema = z.enum(['charity', 'commercial']);
export type OfferingVertical = z.infer<typeof offeringVerticalSchema>;

export const createOfferingRequestSchema = z
  .object({
    name: z.string().min(1).max(200),
    blurb: z.string().max(500).optional(),
    // Money is BigInt cents in the DB; the wire value is a positive integer of
    // cents (4000 = $40). `> 0` — a $0 offering is meaningless on a doorstep.
    amountCents: z.number().int().positive(),
    frequency: offeringFrequencySchema,
    vertical: offeringVerticalSchema,
    highlighted: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();
export type CreateOfferingRequest = z.infer<typeof createOfferingRequestSchema>;

export const updateOfferingRequestSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    blurb: z.string().max(500).optional(),
    amountCents: z.number().int().positive().optional(),
    frequency: offeringFrequencySchema.optional(),
    highlighted: z.boolean().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();
export type UpdateOfferingRequest = z.infer<typeof updateOfferingRequestSchema>;
