/**
 * User routes — invite / accept-invite / list / get / patch / archive.
 *
 * All endpoints are live: invite / accept-invite / list / get / patch / archive / role / reset-mfa.
 */
import type { FastifyInstance } from 'fastify';
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  changeUserRoleRequestSchema,
  inviteUserRequestSchema,
  acceptInviteRequestSchema,
  listUsersQuerySchema,
} from './schemas';
import {
  inviteUser,
  acceptInvite,
  listUsers,
  getUser,
  updateUser,
  changeUserRole,
  archiveUser,
  resendInvite,
  resetMfa,
  unlockUser,
} from './service';
import { getDailyStats } from './daily-stats.service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface UserIdParams {
  id: string;
}

export async function registerUser(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'user',
    status: 'live',
    phase: '1.1',
  }));

  // POST /v1/users — invite a user; returns inviteToken
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    // Combine create + invite shapes — caller may include expiresInDays inline
    const merged = createUserRequestSchema.merge(inviteUserRequestSchema.partial()).parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await inviteUser(merged, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
          role: ctx.role,
        });
        return { status: 201, body: result };
      },
    });
  });

  // POST /v1/users/accept-invite — unauthenticated
  // SEC-003: tight rate limit — 5 attempts per IP per minute. Prevents invite
  // token brute-force on this unauthenticated endpoint.
  app.post(
    '/accept-invite',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = acceptInviteRequestSchema.parse(req.body);
      const user = await acceptInvite(body);
      return reply.code(200).send({ user });
    },
  );

  // GET /v1/users — list within actor's org
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listUsersQuerySchema.parse(req.query);
    const result = await listUsers(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/users/:id
  app.get<{ Params: UserIdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const user = await getUser(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ user });
  });

  // GET /v1/users/:userId/daily-stats — today's activity + in-org leaderboard
  // for the native Knocker "Me" screen. Self-only unless the caller is an
  // admin/manager (enforced in the service).
  app.get<{ Params: { userId: string } }>(
    '/:userId/daily-stats',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const stats = await getDailyStats(req.params.userId, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
        role: ctx.role,
      });
      return reply.code(200).send(stats);
    },
  );

  // PATCH /v1/users/:id
  app.patch<{ Params: UserIdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = updateUserRequestSchema.parse(req.body);
    const user = await updateUser(req.params.id, body, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      role: ctx.role,
    });
    return reply.code(200).send({ user });
  });

  // POST /v1/users/:id/archive
  app.post<{ Params: UserIdParams }>(
    '/:id/archive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const user = await archiveUser(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
            role: ctx.role,
          });
          return { status: 200, body: { user } };
        },
      });
    },
  );

  // POST /v1/users/:id/invite — resend invite token
  app.post<{ Params: UserIdParams }>(
    '/:id/invite',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await resendInvite(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
            role: ctx.role,
          });
          return { status: 200, body: result };
        },
      });
    },
  );

  // POST /v1/users/:id/role — guarded role change. requireAuth + org_admin/
  // super_admin (enforced in service) + same-org + no self-escalation +
  // super_admin only assignable by super_admin. This is the ONLY path that
  // writes `role`; the self-service PATCH can never set it.
  app.post<{ Params: UserIdParams }>(
    '/:id/role',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = changeUserRoleRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const user = await changeUserRole(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
            role: ctx.role,
          });
          return { status: 200, body: { user } };
        },
      });
    },
  );

  // POST /v1/users/:id/unlock — clear a login lockout (lockedUntil +
  // failedLoginCount). org_admin/super_admin only (enforced in the service via
  // ROLE_GRANT_ROLES — tighter than archive). Idempotent: replays via the
  // Idempotency-Key, and re-unlocking an unlocked account is a no-op that still
  // audits. Same-org guard → cross-tenant target is a tenant mismatch (404).
  app.post<{ Params: UserIdParams }>(
    '/:id/unlock',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const user = await unlockUser(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
            role: ctx.role,
          });
          return { status: 200, body: { user } };
        },
      });
    },
  );

  // POST /v1/users/:id/reset-mfa — clear TOTP secret; user must re-enroll
  app.post<{ Params: UserIdParams }>(
    '/:id/reset-mfa',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const user = await resetMfa(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
            role: ctx.role,
          });
          return { status: 200, body: { user } };
        },
      });
    },
  );

  // DELETE /v1/users/:id — soft-delete (sets status → 'archived', revokes tokens).
  // ADR-0013: immutable history — records are never hard-deleted.
  app.delete<{ Params: UserIdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const user = await archiveUser(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      role: ctx.role,
    });
    return reply.code(200).send({ user });
  });
}
