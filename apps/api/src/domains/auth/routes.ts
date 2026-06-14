/**
 * Auth routes — POST /login, /refresh, /logout; GET /me; SAML SSO.
 *
 * Sessions are returned both as JSON tokens (for native/CLI/test clients) AND
 * as httpOnly cookies (for browser clients — `d2d_at` and `d2d_rt`). The
 * cookie path on `d2d_rt` is scoped to `/v1/auth` so the refresh secret is
 * never sent to any other route.
 *
 * SAML SSO (Phase 1.1 enterprise table-stakes):
 *   - GET  /sso/:orgSlug/start    → 302 to the IdP (SP-initiated)
 *   - POST /sso/:orgSlug/acs      → IdP posts the signed SAMLResponse here
 *   - GET  /sso/:orgSlug/metadata → this SP's SAML metadata XML
 *   - GET  /sso/:orgSlug/config   → cert-free config view (org_admin+)
 *   - PUT  /sso/:orgSlug/config   → upsert IdP config (org_admin+)
 *
 * MFA (TOTP) — GET /mfa/setup + POST /verify-mfa — Phase 1.2 real.
 * WebAuthn remains 501 (Phase 1.2+).
 */
import * as querystring from 'node:querystring';
import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { loginRequestSchema, refreshRequestSchema, logoutRequestSchema } from './schemas';
import { login, refresh, logout, getCurrentUser } from './service';
import { setupTotp, verifyTotp } from './mfa';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth-guard';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokens';
import { env } from '../../config/env';
import {
  startSso,
  consumeAcs,
  samlMetadata,
  getSsoConfigPublic,
  upsertSsoConfigurationBySlug,
  type SsoActor,
} from './saml/service';
import { acsBodySchema, upsertSsoConfigSchema } from './saml/schemas';

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

/**
 * Gate SSO config mutations to org admins. Requires an authenticated principal
 * (401 if none) carrying `super_admin` (D2D ops) or `org_admin` (this org).
 * Per-org ownership is enforced downstream in the service (an org_admin of org
 * A cannot configure org B). Returns the actor shape the service expects.
 */
function assertSsoAdmin(req: FastifyRequest): SsoActor {
  const principal = req.principal;
  if (!principal?.userId) {
    throw new ProblemError(Problems.unauthorized());
  }
  if (principal.role !== 'super_admin' && principal.role !== 'org_admin') {
    throw new ProblemError(Problems.forbidden('SSO configuration requires an org admin'));
  }
  return {
    userId: principal.userId,
    orgId: principal.orgId,
    role: principal.role,
    regionCode: principal.regionCode,
  };
}

/**
 * Where the browser lands after a successful SSO login. The session is in
 * httpOnly cookies by this point, so we redirect to the first configured app
 * origin (CORS_ORIGINS), falling back to '/'. A per-org post-login URL
 * (BrandKit.customDomain) is a documented follow-up.
 */
function postLoginRedirect(): string {
  const first = env()
    .CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .find((o) => o.length > 0);
  return first ?? '/';
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  // The SAML ACS receives application/x-www-form-urlencoded from the IdP.
  // `registerAuth` runs in an encapsulated child instance (registered with a
  // /v1/auth prefix), so this parser is scoped to auth routes only and does
  // not affect the JSON-only surface elsewhere.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, querystring.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

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

  // ── MFA — TOTP setup + verify (Phase 1.2 real) ────────────────────────

  const verifyMfaSchema = z.object({ token: z.string().length(6) }).strict();

  // GET /v1/auth/mfa/setup — generate + store a TOTP credential.
  // Returns the otpauth:// URI the authenticator app scans.
  // Requires a live session (auth guard). Re-calling overwrites any pending
  // un-confirmed credential; to prevent casual reset of an active MFA, gate
  // at the product layer (e.g. require re-password before calling this).
  app.get('/mfa/setup', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.principal?.userId;
    if (!userId) throw new ProblemError(Problems.unauthorized());
    const me = await getCurrentUser(userId);
    if (!me) throw new ProblemError(Problems.unauthorized('User not active'));
    const result = await setupTotp(userId, me.email, {
      orgId: me.orgId,
      regionCode: me.regionCode,
    });
    return reply.code(200).send(result);
  });

  // POST /v1/auth/verify-mfa — verify a TOTP code.
  // On the first successful call after setup, stamps mfaEnabledAt.
  // Subsequent calls serve as step-up verification.
  app.post('/verify-mfa', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.principal?.userId;
    if (!userId) throw new ProblemError(Problems.unauthorized());
    const me = await getCurrentUser(userId);
    if (!me) throw new ProblemError(Problems.unauthorized('User not active'));
    const body = verifyMfaSchema.parse(req.body);
    const result = await verifyTotp(userId, body.token, {
      orgId: me.orgId,
      regionCode: me.regionCode,
    });
    return reply.code(200).send(result);
  });

  // ── SAML SSO (Phase 1.1 enterprise table-stakes) ──────────────────────

  // GET /v1/auth/sso/:orgSlug/start — SP-initiated login. 302 to the IdP with
  // a signed RelayState. GET (not POST) so it's link/bookmark friendly.
  app.get<{ Params: { orgSlug: string } }>('/sso/:orgSlug/start', async (req, reply) => {
    const { redirectUrl } = await startSso(req.params.orgSlug);
    return reply.redirect(redirectUrl);
  });

  // POST /v1/auth/sso/:orgSlug/acs — the IdP posts the signed SAMLResponse
  // here (application/x-www-form-urlencoded). On success the session lands in
  // httpOnly cookies and we 302 the browser into the app.
  app.post<{ Params: { orgSlug: string } }>('/sso/:orgSlug/acs', async (req, reply) => {
    const body = acsBodySchema.parse(req.body);
    const { session } = await consumeAcs({
      slug: req.params.orgSlug,
      samlResponse: body.SAMLResponse,
      relayState: body.RelayState,
      ip: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    setAuthCookies(reply, session.accessToken, session.refreshToken);
    return reply.redirect(postLoginRedirect());
  });

  // GET /v1/auth/sso/:orgSlug/metadata — this SP's SAML metadata XML, to hand
  // to the IdP admin. Requires the org's SSO config to exist (404 otherwise).
  app.get<{ Params: { orgSlug: string } }>('/sso/:orgSlug/metadata', async (req, reply) => {
    const xml = await samlMetadata(req.params.orgSlug);
    return reply.code(200).type('application/xml').send(xml);
  });

  // GET /v1/auth/sso/:orgSlug/config — cert-free config view (org_admin+).
  app.get<{ Params: { orgSlug: string } }>(
    '/sso/:orgSlug/config',
    { preHandler: requireAuth },
    async (req, reply) => {
      assertSsoAdmin(req);
      const ssoConfiguration = await getSsoConfigPublic(req.params.orgSlug);
      if (!ssoConfiguration) {
        throw new ProblemError(Problems.notFound('SsoConfiguration', req.params.orgSlug));
      }
      return reply.code(200).send({ ssoConfiguration });
    },
  );

  // PUT /v1/auth/sso/:orgSlug/config — upsert the IdP config (org_admin+). The
  // cert is encrypted at rest; the response is always the cert-free view.
  app.put<{ Params: { orgSlug: string } }>(
    '/sso/:orgSlug/config',
    { preHandler: requireAuth },
    async (req, reply) => {
      const actor = assertSsoAdmin(req);
      const body = upsertSsoConfigSchema.parse(req.body);
      const ssoConfiguration = await upsertSsoConfigurationBySlug(req.params.orgSlug, body, actor);
      return reply.code(200).send({ ssoConfiguration });
    },
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
