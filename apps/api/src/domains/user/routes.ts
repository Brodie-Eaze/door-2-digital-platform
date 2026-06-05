/**
 * User routes — invite / accept-invite / list / get / patch / archive.
 *
 * Role / MFA-reset endpoints are still 501 stubs (Phase 1.2).
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
} from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface UserIdParams {
  id: string;
}

export async function registerUser(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'user', status: 'live', phase: '1.1' }));

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
  app.post('/accept-invite', async (req, reply) => {
    const body = acceptInviteRequestSchema.parse(req.body);
    const user = await acceptInvite(body);
    return reply.code(200).send({ user });
  });

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

  // POST /v1/users/:id/invite — resend invite (501 until rotation lands)
  app.post<{ Params: UserIdParams }>(
    '/:id/invite',
    { preHandler: requireAuth },
    async (_req, reply) =>
      reply.code(501).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/not-implemented',
        title: 'Not implemented',
        status: 501,
        detail: 'Invite-resend lands in Phase 1.2',
      }),
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

  // POST /v1/users/:id/reset-mfa — 501 (Phase 1.2)
  app.post<{ Params: UserIdParams }>(
    '/:id/reset-mfa',
    { preHandler: requireAuth },
    async (_req, reply) =>
      reply.code(501).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/not-implemented',
        title: 'Not implemented',
        status: 501,
        detail: 'MFA reset lands in Phase 1.2',
      }),
  );
}
