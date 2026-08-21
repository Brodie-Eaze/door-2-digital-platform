/**
 * Catalog routes — per-tenant ServiceOffering catalog.
 *
 *   GET    /v1/catalog        active offerings, sortOrder asc (native Knocker app)
 *   POST   /v1/catalog        create offering   — manager|org_admin|super_admin
 *   PATCH  /v1/catalog/:id     update offering   — manager|org_admin|super_admin
 *   DELETE /v1/catalog/:id     archive (soft)    — manager|org_admin|super_admin
 *
 * GET is open to any authed role in the org (knockers fetch the catalog).
 * Writes require manager+ and carry an Idempotency-Key, mirroring field-signup.
 * The org is taken from the authenticated principal — NEVER from the body/path.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { archiveOffering, createOffering, listOfferings, updateOffering } from './service';
import { createOfferingRequestSchema, updateOfferingRequestSchema } from './schemas';

const WRITE_ROLES = new Set(['super_admin', 'org_admin', 'manager']);

function requireRole(role: string, allowed: Set<string>): void {
  if (!allowed.has(role)) {
    throw new ProblemError(Problems.forbidden('Role not permitted to manage the catalog'));
  }
}

export async function registerCatalog(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'catalog', status: 'live' }));

  // GET /v1/catalog — active offerings for the org (any authed role).
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const offerings = await listOfferings({
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(offerings);
  });

  // POST /v1/catalog — create an offering (manager+).
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, WRITE_ROLES);
    const body = createOfferingRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await createOffering(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: result };
      },
    });
  });

  // PATCH /v1/catalog/:id — update an offering (manager+).
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, WRITE_ROLES);
    const body = updateOfferingRequestSchema.parse(req.body);
    const result = await updateOffering(req.params.id, body, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // DELETE /v1/catalog/:id — soft delete (active=false) (manager+).
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireRole(ctx.role, WRITE_ROLES);
      const result = await archiveOffering(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send(result);
    },
  );
}
