/**
 * Analytics routes — the warehouse outbox read/export surface.
 *
 * Registered under /v1/analytics (prefix applied at registration — paths here
 * are prefix-free):
 *
 *   GET /v1/analytics/events    cursor-paginated flat event stream (filters)
 *   GET /v1/analytics/export    NDJSON drain of UNSHIPPED events (warehouse sink)
 *   GET /v1/analytics/_status   liveness
 *
 * This is a READ/EXPORT plane only — analytics events are append-only and are
 * written by other domains via `emitAnalyticsEvent` (service.ts), never via an
 * HTTP body, so there is no POST here. Both data endpoints are gated to the
 * roles that may see cross-rep org-wide data: super_admin, org_admin, manager,
 * auditor. The org is taken from the authenticated principal — NEVER the body.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { drainUnshipped, listEvents } from './service';
import { exportQuerySchema, listEventsQuerySchema } from './schemas';

// Only org-wide readers see the warehouse stream — a knocker cannot read other
// reps' events. Auditor is included (read-only oversight of the data plane).
const ANALYTICS_ROLES = new Set(['super_admin', 'org_admin', 'manager', 'auditor']);

function requireRole(role: string, allowed: Set<string>): void {
  if (!allowed.has(role)) {
    throw new ProblemError(Problems.forbidden('Role not permitted to read analytics'));
  }
}

export async function registerAnalytics(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'analytics', status: 'live' }));

  // GET /v1/analytics/events — tenant-scoped, cursor-paginated flat events.
  app.get('/events', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, ANALYTICS_ROLES);
    const query = listEventsQuerySchema.parse(req.query);
    const result = await listEvents(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/analytics/export — stream UNSHIPPED events as NDJSON (one JSON
  // object per line) and mark each returned row shippedAt=now (at-least-once
  // warehouse sink). The drain happens in the service inside a tenantTx; here we
  // only serialise the returned batch onto the wire.
  //
  // We write to the raw socket so the body is true NDJSON (not a JSON array) and
  // hijack the reply so Fastify does not try to also serialise a return value.
  // The sink polls this endpoint in a loop until it receives an empty body.
  app.get('/export', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, ANALYTICS_ROLES);
    const query = exportQuerySchema.parse(req.query);

    const batch = await drainUnshipped(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });

    // Tenant data — never let a shared cache hold one org's warehouse stream.
    reply.raw.writeHead(200, {
      'content-type': 'application/x-ndjson',
      'cache-control': 'private, no-store',
      'x-analytics-batch-size': String(batch.length),
    });
    for (const event of batch) {
      reply.raw.write(`${JSON.stringify(event)}\n`);
    }
    reply.raw.end();
    // We have written the response directly to the socket; tell Fastify we own
    // the reply lifecycle so it does not attempt to send again.
    return reply.hijack();
  });
}
