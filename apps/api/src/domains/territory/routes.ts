/**
 * Territory routes — Phase 1.2 real implementation.
 *
 * Endpoints:
 *   POST   /v1/territories                       create (WKT polygon)
 *   GET    /v1/territories                       cursor-paginated list
 *   GET    /v1/territories/:id                   one + assignments
 *   PATCH  /v1/territories/:id                   name/status/metadata only
 *   POST   /v1/territories/:id/assignments       assign user
 *   DELETE /v1/territories/:id/assignments/:aid  soft-revoke (expiresAt=now)
 *   GET    /v1/territories/heatmap?bbox=         knock-density aggregate
 *   POST   /v1/territories/:id/draft             501 — polygon draft edit
 *                                                workflow lands in Phase 1.2
 */
import type { FastifyInstance } from 'fastify';
import {
  createTerritoryRequestSchema,
  updateTerritoryRequestSchema,
  listTerritoriesQuerySchema,
  createAssignmentRequestSchema,
  heatmapQuerySchema,
} from './schemas';
import {
  createTerritory,
  listTerritories,
  getTerritory,
  updateTerritory,
  addAssignment,
  removeAssignment,
  heatmap,
} from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface TerritoryIdParams {
  id: string;
}
interface AssignmentParams {
  id: string;
  assignmentId: string;
}

export async function registerTerritory(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'territory',
    status: 'live',
    phase: '1.2',
  }));

  // GET /heatmap — must be declared before GET /:id so Fastify doesn't
  // capture the literal segment as a route parameter.
  app.get('/heatmap', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = heatmapQuerySchema.parse(req.query);
    const result = await heatmap(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // POST /v1/territories — create
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createTerritoryRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await createTerritory(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { territory: result } };
      },
    });
  });

  // GET /v1/territories — list
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listTerritoriesQuerySchema.parse(req.query);
    const result = await listTerritories(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/territories/:id — one + assignments
  app.get<{ Params: TerritoryIdParams }>(
    '/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const territory = await getTerritory(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ territory });
    },
  );

  // PATCH /v1/territories/:id
  app.patch<{ Params: TerritoryIdParams }>(
    '/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = updateTerritoryRequestSchema.parse(req.body);
      const territory = await updateTerritory(req.params.id, body, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ territory });
    },
  );

  // POST /v1/territories/:id/assignments — assign user
  app.post<{ Params: TerritoryIdParams }>(
    '/:id/assignments',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = createAssignmentRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await addAssignment(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 201, body: { assignment: result } };
        },
      });
    },
  );

  // DELETE /v1/territories/:id/assignments/:assignmentId — soft-revoke
  app.delete<{ Params: AssignmentParams }>(
    '/:id/assignments/:assignmentId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const result = await removeAssignment(req.params.id, req.params.assignmentId, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ assignment: result });
    },
  );

  // POST /v1/territories/:id/draft — 501 stub (polygon edit workflow Phase 1.2)
  app.post<{ Params: TerritoryIdParams }>(
    '/:id/draft',
    { preHandler: requireAuth },
    async (_req, reply) =>
      reply.code(501).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/not-implemented',
        title: 'Not implemented',
        status: 501,
        detail: 'Draft polygon edit workflow lands in Phase 1.2',
      }),
  );
}
