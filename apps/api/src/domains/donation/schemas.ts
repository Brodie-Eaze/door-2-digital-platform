/**
 * Donation Zod schemas — pause / cancel / change-amount.
 */
import { z } from 'zod';
import { bigIntCentsSchema } from '@d2d/shared-types';

export const pauseDonationRequestSchema = z
  .object({
    resumeAt: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type PauseDonationRequest = z.infer<typeof pauseDonationRequestSchema>;

export const cancelDonationRequestSchema = z
  .object({
    reason: z.string().min(1).max(500),
    refundLastChargeCents: bigIntCentsSchema.optional(),
  })
  .strict();
export type CancelDonationRequest = z.infer<typeof cancelDonationRequestSchema>;

export const changeDonationAmountRequestSchema = z
  .object({
    newAmountCents: bigIntCentsSchema,
    effectiveAt: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type ChangeDonationAmountRequest = z.infer<typeof changeDonationAmountRequestSchema>;
