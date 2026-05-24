/**
 * Consent routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST /v1/consent/capture                     capture consent at point of collection
 *                                                  (door, online form, phone)
 *   - GET  /v1/consent/lookup                      look up consent for a (subject, channel, scope)
 *                                                  tuple; used by send-time guard
 *   - POST /v1/consent/:id/withdraw                withdraw consent (audit-logged; cascades to
 *                                                  active sequences + recurring donations as
 *                                                  per scope)
 *   - GET  /v1/consent/audit/:subjectId            full consent audit trail for a subject
 *
 * Cross-cutting:
 *   - Consent is the source of truth for "may we contact this person"; lives outside
 *     of Lead so it survives lead deletion.
 *   - Signature + evidence stored in S3 with Object Lock (7yr).
 *   - Scope = marketing | recurring_payment | data_sharing — withdrawal cascades
 *     to the relevant downstream (e.g. recurring_payment withdrawal pauses Donation).
 */
import type { FastifyInstance } from 'fastify';
import { captureConsentRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerConsent(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'consent', status: 'scaffold', phase: '1.2' }));

  app.post('/capture', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = captureConsentRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Consent capture lands in Phase 1.2',
    });
  });

  app.get('/lookup', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Consent lookup lands in Phase 1.2',
    }),
  );
}
