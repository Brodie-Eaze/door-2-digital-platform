/**
 * Auth routes — POST /login, /refresh, /logout; GET /me.
 *
 * SSO / MFA / WebAuthn remain 501 stubs (Phase 1.2).
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { loginRequestSchema, refreshRequestSchema, logoutRequestSchema } from './schemas';
import { login, refresh, logout, getCurrentUser } from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'auth', status: 'live', phase: '1.1' }));

  // POST /v1/auth/login
  app.post('/login', async (req, reply) => {
    const body = loginRequestSchema.parse(req.body);
    const result = await login({
      email: body.email,
      password: body.password,
      ip: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    return reply.code(200).send(result);
  });

  // POST /v1/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const body = refreshRequestSchema.parse(req.body);
    const result = await refresh({
      refreshToken: body.refreshToken,
      ip: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    return reply.code(200).send(result);
  });

  // POST /v1/auth/logout
  app.post('/logout', { preHandler: requireAuth }, async (req, reply) => {
    const body = logoutRequestSchema.parse(req.body ?? {});
    await logout({
      refreshToken: body.refreshToken,
      userId: req.principal?.userId,
      orgId: req.principal?.orgId,
      regionCode: req.principal?.regionCode as never,
    });
    return reply.code(204).send();
  });

  // GET /v1/auth/me
  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.principal?.userId;
    if (!userId) throw new ProblemError(Problems.unauthorized());
    const me = await getCurrentUser(userId);
    if (!me) throw new ProblemError(Problems.unauthorized('User not active'));
    return reply.code(200).send({ user: me });
  });

  // ── Stubs preserved for Phase 1.2 ─────────────────────────────────────

  app.post('/verify-mfa', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'TOTP/SMS verification lands in Phase 1.2',
    }),
  );

  app.post('/sso/:orgSlug/start', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'SAML SP lands in Phase 1.2',
    }),
  );

  app.post('/sso/:orgSlug/acs', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'SAML SP lands in Phase 1.2',
    }),
  );

  app.post('/webauthn/begin', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'WebAuthn step-up lands in Phase 1.2',
    }),
  );

  app.post('/webauthn/finish', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'WebAuthn step-up lands in Phase 1.2',
    }),
  );
}
