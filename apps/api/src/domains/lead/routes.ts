/**
 * Lead routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST  /v1/leads                          create (typically from knock or inbound form)
 *   - GET   /v1/leads                          list (filter status, owner, source, vertical, date)
 *   - GET   /v1/leads/:id                      read (PII masked unless `lead:unmask` scope)
 *   - PATCH /v1/leads/:id                      update status / fields (XState transition guarded)
 *   - POST  /v1/leads/:id/assign               assign to inside-sales / manager
 *   - POST  /v1/leads/:id/activities           log call, sms, email, note, status_change
 *   - GET   /v1/leads/:id/activities           timeline (cursor-paginated)
 *   - POST  /v1/leads/:id/do-not-contact       mark DNC + propagate to DNK/DNC lists
 *
 * Cross-cutting:
 *   - Lead lifecycle = XState v5 machine (`libs/state-machines/lead.machine.ts`).
 *     Invalid transitions return 409 PROBLEM_INVALID_STATE_TRANSITION.
 *   - PII vault: email/phone deterministically encrypted; givenName/familyName
 *     envelope-encrypted; address linked via `Address`.
 *   - On `lead.status=converted`, emits `lead.converted` webhook +
 *     creates Conversion via service call (NOT exposed as REST).
 */
import type { FastifyInstance } from 'fastify';
import {
  createLeadRequestSchema,
  assignLeadRequestSchema,
  leadActivityRequestSchema,
} from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerLead(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'lead', status: 'scaffold', phase: '1.2' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createLeadRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Lead create lands in Phase 1.2',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Lead list lands in Phase 1.2',
    }),
  );

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Lead read lands in Phase 1.2',
    }),
  );

  app.post('/:id/assign', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = assignLeadRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Lead assign lands in Phase 1.2',
    });
  });

  app.post('/:id/activities', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = leadActivityRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Lead activity create lands in Phase 1.2',
    });
  });
}
