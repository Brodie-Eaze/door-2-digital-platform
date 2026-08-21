/**
 * Audit-domain Zod schemas — read-side filters and verify input.
 */
import { z } from 'zod';
import { cursorPageQuerySchema, idSchema } from '@d2d/shared-types';

export const listAuditEventsQuerySchema = cursorPageQuerySchema.extend({
  actorUserId: idSchema.optional(),
  resourceType: z.string().min(1).max(100).optional(),
  resourceId: z.string().min(1).max(120).optional(),
  action: z.string().min(1).max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;

export const exportAuditEventsQuerySchema = z.object({
  resourceType: z.string().min(1).max(100).optional(),
  resourceId: z.string().min(1).max(120).optional(),
  action: z.string().min(1).max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ExportAuditEventsQuery = z.infer<typeof exportAuditEventsQuerySchema>;

export const verifyChainRequestSchema = z
  .object({
    fromUlid: z.string().min(20).max(40).optional(),
    toUlid: z.string().min(20).max(40).optional(),
    /** Cursor returned as nextAfterId from the previous page (string form of BigInt). */
    afterId: z.string().regex(/^\d+$/).optional(),
    /** Max rows per call; server caps at 10 000. */
    limit: z.number().int().min(1).max(10_000).optional(),
  })
  .strict();
export type VerifyChainRequest = z.infer<typeof verifyChainRequestSchema>;
