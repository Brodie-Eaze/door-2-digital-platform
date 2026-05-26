/**
 * Auth routes — POST /login, /refresh, /logout; GET /me.
 *
 * Sessions are returned both as JSON tokens (for native/CLI/test clients) AND
 * as httpOnly cookies (for browser clients — `d2d_at` and `d2d_rt`). The
 * cookie path on `d2d_rt` is scoped to `/v1/auth` so the refresh secret is
 * never sent to any other route.
 *
 * SSO / MFA / WebAuthn remain 501 stubs (Phase 1.2).
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { loginRequestSchema, refreshRequestSchema, logoutRequestSchema } from './schemas';
import { login, refresh, logout, getCurrentUser } from './service';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth-guard';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokens';

/**
 * Write the access + refresh tokens to httpOnly cookies. Browser flows rely
 * on these; programmatic flows can keep using the JSON body.
 *
 * - `d2d_at` is path=/ so middleware can shape-check it on every operator
 *   route. `secure` is gated on NODE_ENV=production so localhost http works.
 * - `d2d_rt` is path=/v1/auth so the refresh secret never crosses other
 *   route surfaces.
 */
function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieReply = reply as FastifyReply & {
    setCookie?: (name: string, value: string, opts: Record<string, unknown>) => void;
  };
  if (typeof cookieReply.setCookie !== 'function') return;
  cookieReply.setCookie('d2d_at', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  cookieReply.setCookie('d2d_rt', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

function clearAuthCookies(reply: FastifyReply): void {
  const cookieReply = reply as FastifyReply & {
    clearCookie?: (name: string, opts?: Record<string, unknown>) => void;
  };
  if (typeof cookieReply.clearCookie !== 'function') return;
  cookieReply.clearCookie('d2d_at', { path: '/' });
  cookieReply.clearCookie('d2d_rt', { path: '/v1/auth' });
}

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
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return reply.code(200).send(result);
  });

  // POST /v1/auth/refresh — accept refresh token from JSON body OR d2d_rt cookie.
  app.post('/refresh', async (req, reply) => {
    let refreshToken: string | undefined;
    // Prefer cookie if present.
    const cookies = (req as unknown as { cookies?: Record<string, string | undefined> }).cookies;
    if (cookies && typeof cookies.d2d_rt === 'string') {
      refreshToken = cookies.d2d_rt;
    } else {
      const body = refreshRequestSchema.parse(req.body);
      refreshToken = body.refreshToken;
    }
    const result = await refresh({
      refreshToken,
      ip: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return reply.code(200).send(result);
  });

  // POST /v1/auth/logout — works with cookie OR Authorization header. Auth
  // is OPTIONAL so a stale cookie still gets cleared cleanly without 401.
  app.post('/logout', { preHandler: optionalAuth }, async (req, reply) => {
    const cookies = (req as unknown as { cookies?: Record<string, string | undefined> }).cookies;
    let refreshToken: string | undefined;
    if (cookies && typeof cookies.d2d_rt === 'string') {
      refreshToken = cookies.d2d_rt;
    } else if (req.body) {
      const body = logoutRequestSchema.parse(req.body);
      refreshToken = body.refreshToken;
    }
    await logout({
      refreshToken,
      userId: req.principal?.userId,
      orgId: req.principal?.orgId,
      regionCode: req.principal?.regionCode as never,
    });
    clearAuthCookies(reply);
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
