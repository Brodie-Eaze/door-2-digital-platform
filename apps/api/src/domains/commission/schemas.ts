/**
 * Commission-domain local schemas — augments @d2d/shared-types.
 */
import { z } from 'zod';
import { bigIntCentsSchema, cursorPageQuerySchema, idSchema } from '@d2d/shared-types';

export const listCommissionsQuerySchema = cursorPageQuerySchema.extend({
  userId: idSchema.optional(),
  payoutBatchId: idSchema.optional(),
  status: z.enum(['accrued', 'included', 'paid']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListCommissionsQuery = z.infer<typeof listCommissionsQuerySchema>;

export const adjustCommissionBodySchema = z
  .object({
    amountCents: bigIntCentsSchema,
    reason: z.string().min(1).max(500),
  })
  .strict();
export type AdjustCommissionBody = z.infer<typeof adjustCommissionBodySchema>;
