/**
 * Auth Zod request schemas.
 */
import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(16),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(16).optional(),
});
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
