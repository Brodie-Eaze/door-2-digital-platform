/**
 * Auth routes — Phase 0 stubs.
 *
 * Full implementation lands in Phase 1.1:
 *   - POST /v1/auth/login            (email + password → MFA challenge)
 *   - POST /v1/auth/verify-mfa       (TOTP / SMS verify → session)
 *   - POST /v1/auth/refresh          (refresh token rotation)
 *   - POST /v1/auth/logout
 *   - GET  /v1/auth/sso/:org/start   (SAML SP-initiated)
 *   - POST /v1/auth/sso/:org/acs     (SAML assertion consumer)
 *   - POST /v1/auth/webauthn/begin   (step-up for admin actions)
 *   - POST /v1/auth/webauthn/finish
 */
import type { FastifyInstance } from 'fastify';

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'auth', status: 'scaffold', phase: '1.1' }));

  // Stubs — return 501 so engineers know what's outstanding.
  app.post('/login', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Auth login lands in Phase 1.1',
    }),
  );

  app.post('/sso/:orgSlug/start', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'SAML SP lands in Phase 1.1',
    }),
  );
}
