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
import { tenantPrisma, type TenantPrismaClient } from '../../config/db';

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

/**
 * Convenience accessor — returns a tenant-scoped Prisma client bound to the
 * authenticated principal's orgId. Services that adopt the "suspenders"
 * injector should reach for this instead of `prisma()` so every query is
 * automatically constrained to the caller's tenant.
 *
 * Throws ProblemError(unauthorized) when no principal/orgId is present.
 */
export function tenantDb(req: FastifyRequest): TenantPrismaClient {
  const principal = requireTenant(req);
  return tenantPrisma(principal.orgId);
}
