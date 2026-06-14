/**
 * CRM (sequences + activities) routes — Phase 1.3.
 *
 *   GET  /v1/crm/activities          cross-lead activity feed for the org
 *   POST /v1/crm/sequences           501 — BullMQ workers needed (Phase 1.3b)
 *   POST /v1/crm/sequences/:id/enroll 501 — BullMQ workers needed (Phase 1.3b)
 *
 * Sequence execution requires BullMQ step workers + notification dispatch.
 * The activity feed is standalone and ships now.
 */
import type { FastifyInstance } from 'fastify';
import { createSequenceRequestSchema, enrollSequenceRequestSchema } from '@d2d/shared-types';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';

interface ActivitiesQuery {
  userId?: string;
  type?: string;
  cursor?: string;
  limit?: string;
}

export async function registerCrm(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'crm', status: 'live', phase: '1.3' }));

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

  // POST /v1/crm/sequences — 501 until BullMQ step workers land
  app.post('/sequences', { preHandler: requireAuth }, async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createSequenceRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'CRM sequence execution requires BullMQ workers — Phase 1.3b',
    });
  });

  // POST /v1/crm/sequences/:id/enroll — 501 until BullMQ step workers land
  app.post('/sequences/:id/enroll', { preHandler: requireAuth }, async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = enrollSequenceRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'CRM sequence enrollment requires BullMQ workers — Phase 1.3b',
    });
  });
}
