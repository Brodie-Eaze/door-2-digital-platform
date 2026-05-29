/**
 * AuthGuard — extracts a Bearer JWT from the Authorization header OR the
 * `d2d_at` httpOnly cookie, verifies it, and sets req.principal with the
 * authenticated principal. Used by every authenticated route.
 *
 * Header is preferred (programmatic clients); cookie is fallback (browser
 * flows from /apps/web-operator). The cookie path is `/`, so it travels
 * with every same-origin request — including the Next.js `/proxy/api/*`
 * rewrite.
 */
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { env } from '../../config/env';
import { verifyAccessToken } from '../../domains/auth/tokens';
import { isAccessTokenRevoked } from '../../domains/auth/token-revocation';

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match && match[1]) return match[1];
  }
  // Cookie fallback. @fastify/cookie populates `req.cookies` once registered.
  const cookies = (req as unknown as { cookies?: Record<string, string | undefined> }).cookies;
  if (cookies && typeof cookies.d2d_at === 'string' && cookies.d2d_at.length > 0) {
    return cookies.d2d_at;
  }
  return null;
}

/**
 * Fastify preHandler that requires a valid token (Bearer header OR cookie).
 * Sets req.principal.
 */
export const requireAuth: preHandlerHookHandler = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const token = extractToken(req);
  if (!token) {
    throw new ProblemError(Problems.unauthorized('Bearer token required'));
  }
  let payload;
  try {
    payload = verifyAccessToken(token, env().JWT_ACCESS_SECRET);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid token';
    if (/expired/i.test(msg)) {
      throw new ProblemError(Problems.unauthorized('Token expired'));
    }
    throw new ProblemError(Problems.unauthorized('Invalid token'));
  }
  // SEC-004: reject tokens minted before a per-user revocation epoch (set on
  // refresh-reuse / compromise). Outside the verify try/catch so the distinct
  // "Token revoked" reason survives. Fails open on Redis error (see module).
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  if (await isAccessTokenRevoked(payload.sub, iat)) {
    throw new ProblemError(Problems.unauthorized('Token revoked'));
  }
  req.principal = {
    orgId: payload.orgId,
    userId: payload.sub,
    role: payload.role,
    regionCode: payload.regionCode,
  };
};

/**
 * Optional-auth preHandler — populates req.principal if present, but does
 * not throw if missing. For routes that have public + authenticated modes.
 */
export const optionalAuth: preHandlerHookHandler = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const token = extractToken(req);
  if (!token) return;
  let payload;
  try {
    payload = verifyAccessToken(token, env().JWT_ACCESS_SECRET);
  } catch {
    return; // optional: swallow invalid/expired
  }
  // SEC-004: a revoked token must not populate the principal even on
  // optional-auth routes — otherwise the ≤5-min post-compromise window stays
  // open on public+authenticated endpoints. Same epoch check as requireAuth.
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  if (await isAccessTokenRevoked(payload.sub, iat)) return;
  req.principal = {
    orgId: payload.orgId,
    userId: payload.sub,
    role: payload.role,
    regionCode: payload.regionCode,
  };
};
