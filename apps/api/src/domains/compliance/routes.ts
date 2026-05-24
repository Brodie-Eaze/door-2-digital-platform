/**
 * Compliance routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - GET  /v1/compliance/state-clearance                          matrix of (campaignId, state, status)
 *   - GET  /v1/compliance/state-clearance/:campaignId/:state       single clearance status + evidence
 *   - POST /v1/compliance/paid-solicitor-registrations             file new registration (or upload evidence)
 *   - PATCH /v1/compliance/paid-solicitor-registrations/:id        transition status (approved | rejected)
 *   - GET  /v1/compliance/cooling-off-windows                      current per-jurisdiction cooling-off
 *                                                                  windows applied to conversions
 *   - GET  /v1/compliance/quiet-hours                              quiet-hour matrix (per region/state)
 *   - GET  /v1/compliance/scripts                                  required scripts per jurisdiction
 *
 * Cross-cutting:
 *   - Conversion creation calls `assertStateCleared(orgId, campaignId, donorState)`
 *     which 409s with PROBLEM_STATE_NOT_CLEARED if not approved.
 *   - Evidence files stored in S3 with Object Lock (7yr retention).
 *   - Compliance changes emit `compliance.state_clearance_changed` webhook.
 */
import type { FastifyInstance } from 'fastify';
import { paidSolicitorRegistrationRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerCompliance(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'compliance', status: 'scaffold', phase: '1.2' }));

  app.get('/state-clearance', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'State-clearance matrix lands in Phase 1.2',
    }),
  );

  app.post('/paid-solicitor-registrations', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = paidSolicitorRegistrationRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Paid-solicitor registration filing lands in Phase 1.2',
    });
  });

  app.get('/cooling-off-windows', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Cooling-off windows lands in Phase 1.2',
    }),
  );
}
