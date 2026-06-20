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
 *   POST   /v1/territories/:id/draft             create draft copy with new polygon (status=draft)
 */
import type { FastifyInstance } from 'fastify';
import {
  createTerritoryRequestSchema,
  draftTerritoryRequestSchema,
  updateTerritoryRequestSchema,
  listTerritoriesQuerySchema,
  createAssignmentRequestSchema,
  heatmapQuerySchema,
} from './schemas';
import {
  createTerritory,
  draftTerritory,
  listTerritories,
  listAssignedTerritories,
  getTerritory,
  updateTerritory,
  addAssignment,
  removeAssignment,
  heatmap,
  claimTerritory,
  releaseClaim,
  getActiveClaims,
} from './service';
import { getTerritoryIntel } from '../satellite/service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';

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

  // GET /claims — all active (non-expired) claims for this org.
  // Declared before /:id so Fastify doesn't capture "claims" as a param.
  app.get('/claims', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const claims = await getActiveClaims(ctx.orgId);
    return reply.code(200).send({ data: claims });
  });

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

  // GET /assigned — territories assigned to the caller (Knocker iOS map).
  // Must be declared before GET /:id so Fastify doesn't capture "assigned"
  // as a route parameter. Returns a bare JSON array — the iOS client decodes
  // it directly, so do NOT wrap it in an envelope.
  app.get('/assigned', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const result = await listAssignedTerritories({
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

  // GET /v1/territories/:id/satellite — Planet Labs intel for a territory.
  // Returns construction counts, satellite score, and basemap tile URL.
  // 404 if territory doesn't belong to the caller's org (cross-tenant guard
  // is inside getTerritoryIntel — returns 404 not 403).
  app.get<{ Params: TerritoryIdParams }>(
    '/:id/satellite',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      try {
        const intel = await getTerritoryIntel(req.params.id, ctx.orgId);
        return reply.code(200).send({ intel });
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        if (e?.statusCode === 404) return reply.code(404).send({ error: 'not_found' });
        throw err;
      }
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

  // POST /v1/territories/:id/claims — claim a territory (upsert, 4-hour TTL).
  app.post<{ Params: TerritoryIdParams }>(
    '/:id/claims',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          // Resolve display name from the User row (JWT has no name claims).
          const user = await prisma().user.findUnique({
            where: { id: ctx.userId },
            select: { givenName: true, familyName: true },
          });
          const userName = user ? `${user.givenName} ${user.familyName}`.trim() : ctx.userId;
          const claim = await claimTerritory(req.params.id, ctx.userId, userName, ctx.orgId);
          return { status: 200, body: claim };
        },
      });
    },
  );

  // DELETE /v1/territories/:id/claims — release the caller's claim.
  app.delete<{ Params: TerritoryIdParams }>(
    '/:id/claims',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await releaseClaim(req.params.id, ctx.userId, ctx.orgId);
      return reply.code(204).send();
    },
  );

  // POST /v1/territories/:id/draft — propose a polygon edit without going live.
  // Creates a new territory row (status='draft') pointing back to the original.
  app.post<{ Params: TerritoryIdParams }>(
    '/:id/draft',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = draftTerritoryRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const territory = await draftTerritory(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 201, body: { territory } };
        },
      });
    },
  );
}
