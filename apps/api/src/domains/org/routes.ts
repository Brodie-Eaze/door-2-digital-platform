/**
 * Org routes — POST / | GET /:id | PATCH /:id | POST /:id/archive
 *               POST /:id/brand-kit | PATCH /:id/billing
 *
 * All mutations require Idempotency-Key. Region pinned at create, immutable.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { createOrgRequestSchema } from '@d2d/shared-types';
import {
  updateOrgRequestSchema,
  updateBrandKitRequestSchema,
  updateBillingRequestSchema,
} from './schemas';
import { createOrg, getOrg, updateOrg, archiveOrg, upsertBrandKit, updateBilling } from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface OrgIdParams {
  id: string;
}

export async function registerOrg(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'org', status: 'live', phase: '1.1' }));

  // POST /v1/orgs — unauthenticated for now (Phase 1.2 wires super-admin only).
  // Idempotency-Key required; new orgs are scoped under the special
  // '__public__' key bucket.
  app.post('/', async (req, reply) => {
    const body = createOrgRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: '__public__',
      handler: async () => {
        const result = await createOrg(body);
        return { status: 201, body: result };
      },
    });
  });

  // GET /v1/orgs/:id
  app.get<{ Params: OrgIdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    if (req.params.id !== ctx.orgId) {
      throw new ProblemError(Problems.tenantMismatch(req.params.id));
    }
    const org = await getOrg(req.params.id);
    return reply.code(200).send({ org });
  });

  // PATCH /v1/orgs/:id
  app.patch<{ Params: OrgIdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    if (req.params.id !== ctx.orgId) {
      throw new ProblemError(Problems.tenantMismatch(req.params.id));
    }
    // Reject regionCode pre-validation for a clearer error than zod's `never` reject.
    if (
      req.body !== null &&
      typeof req.body === 'object' &&
      'regionCode' in (req.body as Record<string, unknown>)
    ) {
      throw new ProblemError({
        type: 'https://docs.d2d.io/problems/region-immutable',
        title: 'Region immutable',
        status: 400,
        detail: 'Region code is locked at org creation and cannot be changed',
      });
    }
    const body = updateOrgRequestSchema.parse(req.body);
    const updated = await updateOrg(req.params.id, body, {
      userId: ctx.userId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ org: updated });
  });

  // POST /v1/orgs/:id/archive
  app.post<{ Params: OrgIdParams }>(
    '/:id/archive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      if (req.params.id !== ctx.orgId) {
        throw new ProblemError(Problems.tenantMismatch(req.params.id));
      }
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const archived = await archiveOrg(req.params.id, {
            userId: ctx.userId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { org: archived } };
        },
      });
    },
  );

  // POST /v1/orgs/:id/brand-kit (upsert)
  app.post<{ Params: OrgIdParams }>(
    '/:id/brand-kit',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      if (req.params.id !== ctx.orgId) {
        throw new ProblemError(Problems.tenantMismatch(req.params.id));
      }
      const body = updateBrandKitRequestSchema.parse(req.body ?? {});
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const kit = await upsertBrandKit(req.params.id, body, {
            userId: ctx.userId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { brandKit: kit } };
        },
      });
    },
  );

  // PATCH /v1/orgs/:id/billing
  app.patch<{ Params: OrgIdParams }>(
    '/:id/billing',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      if (req.params.id !== ctx.orgId) {
        throw new ProblemError(Problems.tenantMismatch(req.params.id));
      }
      const body = updateBillingRequestSchema.parse(req.body);
      const billing = await updateBilling(req.params.id, body, {
        userId: ctx.userId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ billing });
    },
  );
}
