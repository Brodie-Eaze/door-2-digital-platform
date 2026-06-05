/**
 * User-domain Zod schemas — extend shared-types ones with the
 * Phase 1.1 invite-accept and list-query shapes.
 */
import { z } from 'zod';
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  changeUserRoleRequestSchema,
  inviteUserRequestSchema,
  cursorPageQuerySchema,
  platformRoleSchema,
} from '@d2d/shared-types';

export {
  createUserRequestSchema,
  updateUserRequestSchema,
  changeUserRoleRequestSchema,
  inviteUserRequestSchema,
  cursorPageQuerySchema,
};

export const acceptInviteRequestSchema = z.object({
  inviteToken: z.string().min(16).max(200),
  password: z.string().min(8).max(200),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

export const listUsersQuerySchema = cursorPageQuerySchema.extend({
  role: platformRoleSchema.optional(),
  status: z.enum(['active', 'invited', 'archived']).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
