/**
 * CRM (sequences + activities) routes — Phase 1.4 real.
 *
 *   GET  /v1/crm/activities              cross-lead activity feed
 *   POST /v1/crm/sequences               create sequence template (audit-trailed)
 *   POST /v1/crm/sequences/:id/enroll    enroll leads into sequence (audit-trailed)
 */
import type { FastifyInstance } from 'fastify';
import { createSequenceRequestSchema, enrollSequenceRequestSchema } from '@d2d/shared-types';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';
import { createSequence, enrollLeadsInSequence } from './service';

interface ActivitiesQuery {
  userId?: string;
  type?: string;
  cursor?: string;
  limit?: string;
}

interface IdParams {
  id: string;
}

export async function registerCrm(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'crm', status: 'live', phase: '1.4' }));

  // GET /v1/crm/activities — paginated cross-lead activity feed scoped to caller's org
  app.get('/activities', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const q = req.query as ActivitiesQuery;
    const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);

    const rows = await prisma().leadActivity.findMany({
      where: {
        lead: { orgId: ctx.orgId },
        ...(q.userId && { userId: q.userId }),
        ...(q.type && { type: q.type }),
        ...(q.cursor && { id: { lt: q.cursor } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        leadId: true,
        userId: true,
        type: true,
        outcome: true,
        payload: true,
        createdAt: true,
        lead: { select: { id: true, givenName: true, familyName: true, status: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return reply.code(200).send({
      data: page.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    });
  });

  // POST /v1/crm/sequences — create a sequence template
  app.post('/sequences', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createSequenceRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const sequence = await createSequence(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { sequence } };
      },
    });
  });

  // POST /v1/crm/sequences/:id/enroll — enroll leads into a sequence
  app.post<{ Params: IdParams }>(
    '/sequences/:id/enroll',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = enrollSequenceRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const enrollment = await enrollLeadsInSequence(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { enrollment } };
        },
      });
    },
  );
}
