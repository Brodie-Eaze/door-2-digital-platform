/**
 * Audit routes — Phase 1.1 real.
 *
 *   GET   /v1/audit/events                    list (cursor-paginated, filters)
 *   POST  /v1/audit/events/verify             replay chain → ok | brokenAt
 *   GET   /v1/audit/events/export             501 — S3 instruction file landed Phase 1.4
 *
 * Cross-cutting:
 *   - Hash-chain: each row's `prevHash` = HMAC-SHA256(prevRow.rowHash, …).
 *     Verify walks all rows in (orgId, regionCode) and reports first mismatch.
 *   - AuditEvent rows are append-only; no updates, no deletes — DB role enforces.
 *   - Org-admin OR auditor role required to read.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { AuditService } from './service';
import { listAuditEventsQuerySchema, verifyChainRequestSchema } from './schemas';

const READ_ROLES = new Set(['super_admin', 'org_admin', 'auditor']);

function requireAuditRole(role: string): void {
  if (!READ_ROLES.has(role)) {
    throw new ProblemError(Problems.forbidden('Auditor or org_admin role required'));
  }
}

export async function registerAudit(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'audit',
    status: 'live',
    phase: '1.1',
  }));

  // GET /v1/audit/events — list scoped to actor's org
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireAuditRole(ctx.role);
    const query = listAuditEventsQuerySchema.parse(req.query);
    const result = await AuditService.listEvents({
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      ...(query.actorUserId && { actorUserId: query.actorUserId }),
      ...(query.resourceType && { resourceType: query.resourceType }),
      ...(query.resourceId && { resourceId: query.resourceId }),
      ...(query.action && { action: query.action }),
      ...(query.from && { from: new Date(query.from) }),
      ...(query.to && { to: new Date(query.to) }),
      ...(query.cursor && { cursor: query.cursor }),
      limit: query.limit,
    });
    return reply.code(200).send(result);
  });

  // POST /v1/audit/events/verify — chain replay (capped + paginated)
  app.post('/verify', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireAuditRole(ctx.role);
    const body = verifyChainRequestSchema.parse(req.body ?? {});
    const result = await AuditService.verifyChain({
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      ...(body.fromUlid && { fromUlid: body.fromUlid }),
      ...(body.toUlid && { toUlid: body.toUlid }),
      ...(body.limit !== undefined && { limit: body.limit }),
      ...(body.afterId !== undefined && { afterId: BigInt(body.afterId) }),
    });
    // BigInt is not JSON-serialisable — surface nextAfterId as a string cursor.
    const response = {
      ...result,
      nextAfterId: result.nextAfterId !== null ? result.nextAfterId.toString() : null,
    };
    return reply.code(200).send(response);
  });

  // GET /v1/audit/events/export — 501 (S3 export deferred to Phase 1.4)
  app.get('/export', { preHandler: requireAuth }, async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Audit export to S3 lands in Phase 1.4',
    }),
  );
}
