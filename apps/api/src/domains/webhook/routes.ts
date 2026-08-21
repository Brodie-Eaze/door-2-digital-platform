/**
 * Webhook routes — Phase 1.3 real.
 *
 *   POST   /v1/webhooks/endpoints                    register endpoint (returns plaintext secret once)
 *   GET    /v1/webhooks/endpoints                    list (cursor-paginated, status filter)
 *   POST   /v1/webhooks/endpoints/:id/rotate-secret  mint new secret, return plaintext once
 *   DELETE /v1/webhooks/endpoints/:id                soft-delete (status='archived')
 *   GET    /v1/webhooks/endpoints/:id/deliveries     delivery log (cursor-paginated)
 *
 * Signature contract:
 *   D2D-Signature: t=<unix>,v1=<hex-hmac-sha256(secret, t + "." + body)>
 *   Receivers MUST be idempotent on event.id (ULID) and verify within ±5min.
 *
 * Routes are mounted at `/v1/webhooks` so the relative paths below read as
 * the full URL above.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { WebhookService } from './service';
import {
  createWebhookEndpointRequestSchema,
  listWebhookDeliveriesQuerySchema,
  listWebhookEndpointsQuerySchema,
} from './schemas';

interface IdParams {
  id: string;
}

const ADMIN_ROLES = new Set(['super_admin', 'org_admin']);

function requireAdmin(role: string): void {
  if (!ADMIN_ROLES.has(role)) {
    throw new ProblemError(Problems.forbidden('org_admin role required for webhook management'));
  }
}

export async function registerWebhook(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'webhook',
    status: 'live',
    phase: '1.3',
  }));

  // POST /v1/webhooks/endpoints
  app.post('/endpoints', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireAdmin(ctx.role);
    const body = createWebhookEndpointRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const endpoint = await WebhookService.registerEndpoint(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { endpoint } };
      },
    });
  });

  // GET /v1/webhooks/endpoints
  app.get('/endpoints', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listWebhookEndpointsQuerySchema.parse(req.query);
    const result = await WebhookService.listEndpoints(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // POST /v1/webhooks/endpoints/:id/rotate-secret
  app.post<{ Params: IdParams }>(
    '/endpoints/:id/rotate-secret',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireAdmin(ctx.role);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const endpoint = await WebhookService.rotateSecret(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { endpoint } };
        },
      });
    },
  );

  // DELETE /v1/webhooks/endpoints/:id
  app.delete<{ Params: IdParams }>(
    '/endpoints/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireAdmin(ctx.role);
      const endpoint = await WebhookService.softDeleteEndpoint(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ endpoint });
    },
  );

  // GET /v1/webhooks/endpoints/:id/deliveries
  app.get<{ Params: IdParams }>(
    '/endpoints/:id/deliveries',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const query = listWebhookDeliveriesQuerySchema.parse(req.query);
      const result = await WebhookService.listDeliveries(req.params.id, query, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send(result);
    },
  );
}
