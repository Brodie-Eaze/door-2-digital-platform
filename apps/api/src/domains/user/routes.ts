/**
 * User routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.1:
 *   - POST   /v1/users                    create staff/knocker; emits invite if `invite=true`
 *   - GET    /v1/users                    list (filter by role, manager, status); cursor-paginated
 *   - GET    /v1/users/:id                read single user (PII masked unless `unmask` scope)
 *   - PATCH  /v1/users/:id                update (role, manager, phone); audit-logged
 *   - POST   /v1/users/:id/invite         (re)send invite email with magic link
 *   - POST   /v1/users/:id/archive        soft-delete (status=archived); preserves audit trail
 *   - POST   /v1/users/:id/role           role change (org_admin+ only; step-up auth required)
 *   - POST   /v1/users/:id/reset-mfa      org_admin force-reset MFA (audit + notify subject)
 *
 * Cross-cutting:
 *   - TenantGuard required on every route — derives orgId from JWT.
 *   - RegionGuard required on writes — user.regionCode must match deploy region.
 *   - PII masking applied at egress (givenName, familyName, email, phone).
 *   - All writes idempotent via Idempotency-Key header.
 */
import type { FastifyInstance } from 'fastify';
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  inviteUserRequestSchema,
} from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerUser(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'user', status: 'scaffold', phase: '1.1' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createUserRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'User create lands in Phase 1.1',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'User list lands in Phase 1.1',
    }),
  );

  app.patch('/:id', async (req, reply) => {
    const parsed = updateUserRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'User update lands in Phase 1.1',
    });
  });

  app.post('/:id/invite', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = inviteUserRequestSchema.parse(req.body ?? {});
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'User invite lands in Phase 1.1',
    });
  });

  app.post('/:id/archive', async (req, reply) => {
    requireIdempotencyKey(req);
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'User archive lands in Phase 1.1',
    });
  });
}
