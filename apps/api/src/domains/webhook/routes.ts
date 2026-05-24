/**
 * Webhook routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - POST   /v1/webhooks/endpoints                 register endpoint (URL + event types + description)
 *   - GET    /v1/webhooks/endpoints                 list endpoints
 *   - GET    /v1/webhooks/endpoints/:id             read endpoint with current secret prefix + delivery KPIs
 *   - PATCH  /v1/webhooks/endpoints/:id             update URL / event types
 *   - DELETE /v1/webhooks/endpoints/:id             disable endpoint (preserves history)
 *   - POST   /v1/webhooks/endpoints/:id/rotate-secret rotate HMAC secret (returns new secret once)
 *   - GET    /v1/webhooks/endpoints/:id/deliveries  delivery log (cursor-paginated, last 30d)
 *   - POST   /v1/webhooks/deliveries/:id/replay     replay a delivery (idempotent at receiver)
 *
 * Cross-cutting:
 *   - Signature: `D2D-Signature: t=<unix>,v1=<HMAC-SHA256(secret, t + '.' + body)>`.
 *     ±5min replay window enforced at receiver; receiver MUST be idempotent on event.id (ULID).
 *   - Retry schedule: 30s → 2m → 10m → 1h → 6h → 24h → DLQ.
 *   - Secret rotation supports overlap window (both old + new sigs accepted for 24h).
 */
import type { FastifyInstance } from 'fastify';
import { createWebhookEndpointSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerWebhook(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'webhook', status: 'scaffold', phase: '1.3' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createWebhookEndpointSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Webhook endpoint register lands in Phase 1.3',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Webhook endpoint list lands in Phase 1.3',
    }),
  );

  app.post('/:id/rotate-secret', async (req, reply) => {
    requireIdempotencyKey(req);
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Webhook secret rotation lands in Phase 1.3',
    });
  });

  app.get('/:id/deliveries', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Webhook delivery log lands in Phase 1.3',
    }),
  );
}
