/**
 * Knock routes — Phase 1.2 real implementation.
 *
 * Two route bundles share this file:
 *
 *   registerKnockSessions @ /v1/sessions
 *     POST   /                            start a session
 *     POST   /:id/end                     end a session (idempotent)
 *
 *   registerKnock @ /v1/knocks
 *     POST   /                            single knock (idempotency req'd)
 *     POST   /batch                       offline reconcile (≤500 per call,
 *                                         body limit bumped to 10 MB)
 *     GET    /                            cursor-paginated list
 *     GET    /:id                         read one
 *     POST   /:id/contest                 501 — disposition correction
 *                                         workflow lands in Phase 1.2
 */
import type { FastifyInstance } from 'fastify';
import {
  startSessionRequestSchema,
  createKnockRequestSchema,
  knockBatchRequestSchema,
  listKnocksQuerySchema,
} from './schemas';
import {
  startSession,
  endSession,
  createKnock,
  createKnockBatch,
  contestKnock,
  listKnocks,
  getKnock,
} from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface IdParams {
  id: string;
}

export async function registerKnockSessions(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'knock-session',
    status: 'live',
    phase: '1.2',
  }));

  // POST /v1/sessions — start a new KnockSession
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = startSessionRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const session = await startSession(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { session } };
      },
    });
  });

  // POST /v1/sessions/:id/end — end a session
  app.post<{ Params: IdParams }>('/:id/end', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const session = await endSession(req.params.id, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: { session } };
      },
    });
  });
}

export async function registerKnock(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'knock',
    status: 'live',
    phase: '1.2',
  }));

  // Bump body limit for batch route. Fastify resolves the highest limit on
  // the route options if registered there; we use plugin-level so all
  // POSTs under /v1/knocks can accept big offline reconcile payloads.
  // 10 MB matches the public contract.
  // NB: this only loosens for THIS encapsulated child app.
  app.addHook('onRoute', (route) => {
    if (route.method === 'POST') {
      route.bodyLimit = 10 * 1024 * 1024;
    }
  });

  // POST /v1/knocks/batch — declared first so Fastify doesn't shadow it.
  app.post('/batch', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = knockBatchRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await createKnockBatch(body.knocks, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: result };
      },
    });
  });

  // POST /v1/knocks — single
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createKnockRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await createKnock(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { knock: result.knock, deduped: result.deduped } };
      },
    });
  });

  // GET /v1/knocks — list
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listKnocksQuerySchema.parse(req.query);
    const result = await listKnocks(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/knocks/:id — one
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const knock = await getKnock(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ knock });
  });

  // POST /v1/knocks/:id/contest — log a disposition dispute + audit event
  app.post<{ Params: IdParams }>(
    '/:id/contest',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = (req.body as { reason?: string }) ?? {};
      const reason =
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim()
          : 'No reason provided';
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const knock = await contestKnock(
            req.params.id,
            { reason },
            {
              userId: ctx.userId,
              orgId: ctx.orgId,
              regionCode: ctx.regionCode as never,
            },
          );
          return { status: 200, body: { knock } };
        },
      });
    },
  );
}
