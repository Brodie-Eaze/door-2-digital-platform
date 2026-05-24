/**
 * AuthGuard — extracts Bearer JWT, verifies it, and sets req.principal with
 * the authenticated principal. Used by every authenticated route.
 */
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { env } from '../../config/env';
import { verifyAccessToken } from '../../domains/auth/tokens';

/**
 * Fastify preHandler that requires a valid Bearer token. Sets req.principal.
 */
export const requireAuth: preHandlerHookHandler = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    throw new ProblemError(Problems.unauthorized('Bearer token required'));
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    throw new ProblemError(Problems.unauthorized('Bearer token required'));
  }
  const token = match[1]!;
  try {
    const payload = verifyAccessToken(token, env().JWT_ACCESS_SECRET);
    req.principal = {
      orgId: payload.orgId,
      userId: payload.sub,
      role: payload.role,
      regionCode: payload.regionCode,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid token';
    if (/expired/i.test(msg)) {
      throw new ProblemError(Problems.unauthorized('Token expired'));
    }
    throw new ProblemError(Problems.unauthorized('Invalid token'));
  }
};

/**
 * Optional-auth preHandler — populates req.principal if present, but does
 * not throw if missing. For routes that have public + authenticated modes.
 */
export const optionalAuth: preHandlerHookHandler = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return;
  try {
    const payload = verifyAccessToken(match[1]!, env().JWT_ACCESS_SECRET);
    req.principal = {
      orgId: payload.orgId,
      userId: payload.sub,
      role: payload.role,
      regionCode: payload.regionCode,
    };
  } catch {
    // optional: swallow
  }
};
