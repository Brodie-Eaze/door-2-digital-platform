/**
 * Sale Zod schemas — installer handoff.
 */
import { z } from 'zod';
import { idSchema } from '@d2d/shared-types';

export const installerHandoffRequestSchema = z
  .object({
    installerOrgId: idSchema,
    scheduledInstallAt: z.string().datetime(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type InstallerHandoffRequest = z.infer<typeof installerHandoffRequestSchema>;

export const cancelSaleRequestSchema = z
  .object({
    reason: z.string().min(1).max(500),
    clawbackCommissions: z.boolean().default(false),
  })
  .strict();
export type CancelSaleRequest = z.infer<typeof cancelSaleRequestSchema>;
