/**
 * Lead routes — Phase 1.2 real implementation.
 *
 * Endpoints:
 *   POST   /v1/leads                          create (auto-routes if no assignee)
 *   GET    /v1/leads                          cursor-paginated list
 *   GET    /v1/leads/:id                      one + last 20 activities
 *   PATCH  /v1/leads/:id                      status (state-machine), assignedToId
 *   POST   /v1/leads/:id/assign               reassign + LeadActivity entry
 *   POST   /v1/leads/:id/activities           append activity (call/sms/email/note)
 *   POST   /v1/leads/:id/dnk                  flag lead address as do-not-knock + archive lead
 */
import type { FastifyInstance } from 'fastify';
import {
  createLeadRequestSchema,
  updateLeadRequestSchema,
  assignLeadRequestSchema,
  leadActivityRequestSchema,
  listLeadsQuerySchema,
} from './schemas';
import {
  createLead,
  listLeads,
  listCallbacks,
  getLead,
  updateLead,
  assignLead,
  appendActivity,
  flagLeadDnk,
} from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface IdParams {
  id: string;
}

export async function registerLead(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'lead',
    status: 'live',
    phase: '1.2',
  }));

  // POST /v1/leads — create
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createLeadRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const lead = await createLead(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { lead } };
      },
    });
  });

  // GET /v1/leads — list
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listLeadsQuerySchema.parse(req.query);
    const result = await listLeads(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/leads/callbacks — scheduled callbacks for the native Knocker app.
  // Static segment so find-my-way matches it ahead of the `/:id` param route.
  app.get('/callbacks', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const callbacks = await listCallbacks({
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(callbacks);
  });

  // GET /v1/leads/:id — one + last 20 activities
  app.get<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const lead = await getLead(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ lead });
  });

  // PATCH /v1/leads/:id — state machine guarded
  app.patch<{ Params: IdParams }>('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = updateLeadRequestSchema.parse(req.body);
    const lead = await updateLead(req.params.id, body, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ lead });
  });

  // POST /v1/leads/:id/assign — reassign
  app.post<{ Params: IdParams }>('/:id/assign', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = assignLeadRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const lead = await assignLead(req.params.id, body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: { lead } };
      },
    });
  });

  // POST /v1/leads/:id/activities — append activity
  app.post<{ Params: IdParams }>(
    '/:id/activities',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = leadActivityRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const activity = await appendActivity(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 201, body: { activity } };
        },
      });
    },
  );

  // POST /v1/leads/:id/dnk — flag lead's address as do-not-knock + update status
  app.post<{ Params: IdParams }>('/:id/dnk', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = (req.body as { reason?: string }) ?? {};
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const lead = await flagLeadDnk(
          req.params.id,
          { reason: body.reason },
          {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          },
        );
        return { status: 200, body: { lead } };
      },
    });
  });
}
