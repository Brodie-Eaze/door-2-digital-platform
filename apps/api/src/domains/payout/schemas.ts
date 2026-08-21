/**
 * Payout-domain local schemas — Phase 1.3.
 */
import { z } from 'zod';
import { createPayoutBatchRequestSchema, cursorPageQuerySchema } from '@d2d/shared-types';

export const createPayoutBatchBodySchema = createPayoutBatchRequestSchema.extend({
  currency: z.string().length(3).optional(),
});
export type CreatePayoutBatchBody = z.infer<typeof createPayoutBatchBodySchema>;

export const listPayoutBatchesQuerySchema = cursorPageQuerySchema.extend({
  status: z.enum(['draft', 'ready_to_pay', 'instructed', 'acknowledged', 'archived']).optional(),
});
export type ListPayoutBatchesQuery = z.infer<typeof listPayoutBatchesQuerySchema>;
