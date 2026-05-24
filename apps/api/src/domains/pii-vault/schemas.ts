/**
 * PII Vault Zod schemas — unmask request, approval, reveal.
 */
import { z } from 'zod';

export const unmaskRowTypeSchema = z.enum(['Lead', 'Donation', 'Sale', 'Conversion']);
export const unmaskFieldSchema = z.enum(['email', 'phone', 'address', 'fullName', 'paymentLast4']);

export const unmaskRequestInputSchema = z
  .object({
    rowType: unmaskRowTypeSchema,
    rowId: z.string().min(20).max(120),
    fields: z.array(unmaskFieldSchema).min(1).max(5),
    justification: z.string().min(10).max(500),
  })
  .strict();
export type UnmaskRequestInput = z.infer<typeof unmaskRequestInputSchema>;

export const unmaskApproveInputSchema = z
  .object({
    approved: z.boolean().default(true),
    note: z.string().max(500).optional(),
  })
  .strict();
export type UnmaskApproveInput = z.infer<typeof unmaskApproveInputSchema>;

export const unmaskRevealInputSchema = z
  .object({
    grantToken: z.string().min(20).max(120),
  })
  .strict();
export type UnmaskRevealInput = z.infer<typeof unmaskRevealInputSchema>;
