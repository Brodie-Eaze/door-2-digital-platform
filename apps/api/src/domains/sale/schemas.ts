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
