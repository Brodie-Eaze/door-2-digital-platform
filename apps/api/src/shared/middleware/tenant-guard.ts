/**
 * TenantGuard — extracts the orgId from the authenticated principal and
 * attaches it to req.principal. Domain services must use this orgId for
 * every query. The Prisma `$extends` injector (Phase 1.2) will use it
 * automatically.
 *
 * NOTE: Fastify already has `req.context` for route metadata. We use the
 * distinct field `principal` so we don't collide with it.
 */
import type { FastifyRequest } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export interface Principal {
  orgId: string;
  userId: string;
  role: string;
  regionCode: string;
}

/** Back-compat alias — older code referred to the same shape as `TenantContext`. */
export type TenantContext = Principal;

/**
 * Read the authenticated principal (set by auth middleware) and ensure
 * an orgId is present. Throws ProblemError(unauthorized) if missing.
 */
export function requireTenant(req: FastifyRequest): Principal {
  if (!req.principal?.orgId) {
    throw new ProblemError(Problems.unauthorized('No tenant context'));
  }
  return req.principal;
}
