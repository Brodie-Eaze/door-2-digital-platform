/**
 * Notification routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST /v1/notifications/sms                  send transactional SMS via Twilio
 *                                                 (admin-only direct send; sequence sends go through
 *                                                 the CRM workflow path, not this API)
 *   - POST /v1/notifications/email                send transactional email via Resend
 *   - POST /v1/notifications/push                 send Apple/Firebase push to a user
 *   - GET  /v1/notifications/deliveries           cross-channel delivery log (cursor-paginated)
 *   - GET  /v1/notifications/templates            list templates (per-region, per-channel)
 *   - POST /v1/notifications/templates            create new template
 *
 * Cross-cutting:
 *   - Consent + quiet-hours guard applied to every send. Outside the window =
 *     queued for next allowable slot rather than rejected.
 *   - Provider per region: Twilio (US, AU), MessageMedia or local SG provider.
 *   - Failures land on `notification.dlq`; DLQ inspector lives in operator console.
 */
import type { FastifyInstance } from 'fastify';
import {
  sendSmsRequestSchema,
  sendEmailRequestSchema,
  sendPushRequestSchema,
} from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerNotification(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'notification', status: 'scaffold', phase: '1.2' }));

  app.post('/sms', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = sendSmsRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Notification SMS send lands in Phase 1.2',
    });
  });

  app.post('/email', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = sendEmailRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Notification email send lands in Phase 1.2',
    });
  });

  app.post('/push', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = sendPushRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Notification push send lands in Phase 1.2',
    });
  });
}
