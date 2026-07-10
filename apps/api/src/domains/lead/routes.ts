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
 *   POST   /v1/leads/:id/dnk                  501 — handled by Agent 15's DNK service
 */
import type { FastifyInstance } from 'fastify';
import {
  createLeadRequestSchema,
  updateLeadRequestSchema,
  assignLeadRequestSchema,
  leadActivityRequestSchema,
  listLeadsQuerySchema,
} from './schemas';
import { createLead, listLeads, getLead, updateLead, assignLead, appendActivity } from './service';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';

interface IdParams {
  id: string;
}

export async function registerLead(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'lead', status: 'live', phase: '1.2' }));

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
  // PATCH is idempotent by HTTP definition (RFC 5789); no Idempotency-Key required.
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

  // POST /v1/leads/:id/dnk — 501 stub, DNK service in Agent 15
  app.post<{ Params: IdParams }>('/:id/dnk', { preHandler: requireAuth }, async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DNK marking is handled by the do-not-knock service (Agent 15)',
    }),
  );
}
