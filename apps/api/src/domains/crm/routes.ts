/**
 * CRM (sequences + activities) routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - POST  /v1/crm/sequences                       create multi-step nurture sequence
 *   - GET   /v1/crm/sequences                       list (filter active/archived, vertical)
 *   - GET   /v1/crm/sequences/:id                   read with steps + enrollment counts
 *   - PATCH /v1/crm/sequences/:id                   edit (versioned — running enrollments keep old version)
 *   - POST  /v1/crm/sequences/:id/enroll            enroll leads (bulk, max 500)
 *   - POST  /v1/crm/sequences/:id/pause             pause all running enrollments
 *   - DELETE /v1/crm/sequences/:id/enrollments/:eid stop one enrollment
 *   - GET   /v1/crm/activities                      cross-lead activity feed (filter user, date, type)
 *
 * Cross-cutting:
 *   - Sequence steps execute via `services/notification` (SMS/email/task) on BullMQ.
 *   - Send-window guard: respects per-jurisdiction quiet hours from `services/compliance`.
 *   - On lead status=converted | DNC, all active enrollments auto-stop.
 */
import type { FastifyInstance } from 'fastify';
import { createSequenceRequestSchema, enrollSequenceRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';

export async function registerCrm(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'crm',
    status: 'scaffold',
    phase: '1.3',
  }));

  app.post('/sequences', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createSequenceRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'CRM sequence create lands in Phase 1.3',
    });
  });

  app.post('/sequences/:id/enroll', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = enrollSequenceRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'CRM sequence enrollment lands in Phase 1.3',
    });
  });

  app.get('/activities', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'CRM activity feed lands in Phase 1.3',
    }),
  );
}
