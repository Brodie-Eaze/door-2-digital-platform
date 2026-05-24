/**
 * TenantGuard — extracts the orgId from the authenticated principal and
 * attaches it to req.context. Domain services must use this orgId for
 * every query. The Prisma `$extends` injector (Phase 1.1) will use it
 * automatically.
 */
import type { FastifyRequest } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';

declare module 'fastify' {
  interface FastifyRequest {
    context?: TenantContext;
  }
}

export interface TenantContext {
  orgId: string;
  userId: string;
  role: string;
  regionCode: string;
}

/**
 * Read the authenticated principal (set by auth middleware) and ensure
 * an orgId is present. Throws ProblemError(unauthorized) if missing.
 */
export function requireTenant(req: FastifyRequest): TenantContext {
  if (!req.context?.orgId) {
    throw new ProblemError(Problems.unauthorized('No tenant context'));
  }
  return req.context;
}
