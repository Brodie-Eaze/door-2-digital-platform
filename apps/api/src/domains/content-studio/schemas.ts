/**
 * Content-Studio Zod schemas — thin wrapper over the marketing schemas
 * with a sensible default provider per media kind.
 */
import { z } from 'zod';
import {
  generateAvatarInputSchema,
  generateImageInputSchema,
  generateTextInputSchema,
  generateVideoInputSchema,
} from '../marketing/schemas';

export const copyJobRequestSchema = generateTextInputSchema.extend({
  providerOverride: z.enum(['claude_copy', 'openai_copy']).optional(),
});
export type CopyJobRequest = z.infer<typeof copyJobRequestSchema>;

export const imageJobRequestSchema = generateImageInputSchema.extend({
  providerOverride: z.enum(['flux_image', 'ideogram_image']).optional(),
});
export type ImageJobRequest = z.infer<typeof imageJobRequestSchema>;

export const videoJobRequestSchema = generateVideoInputSchema.extend({
  providerOverride: z.enum(['runway_video', 'higgsfield']).optional(),
});
export type VideoJobRequest = z.infer<typeof videoJobRequestSchema>;

export const avatarJobRequestSchema = generateAvatarInputSchema;
export type AvatarJobRequest = z.infer<typeof avatarJobRequestSchema>;
