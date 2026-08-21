/**
 * Audit routes — Phase 1.4 real.
 *
 *   GET   /v1/audit/events                    list (cursor-paginated, filters)
 *   POST  /v1/audit/events/verify             replay chain → ok | brokenAt
 *   GET   /v1/audit/events/export             NDJSON stream of all org audit events
 *
 * Cross-cutting:
 *   - Hash-chain: each row's `prevHash` = HMAC-SHA256(prevRow.rowHash, …).
 *     Verify walks all rows in (orgId, regionCode) and reports first mismatch.
 *   - AuditEvent rows are append-only; no updates, no deletes — DB role enforces.
 *   - Org-admin OR auditor role required to read.
 */
import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import type { RegionCode } from '@prisma/client';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { AuditService } from './service';
import {
  exportAuditEventsQuerySchema,
  listAuditEventsQuerySchema,
  verifyChainRequestSchema,
} from './schemas';

const READ_ROLES = new Set(['super_admin', 'org_admin', 'auditor']);

function requireAuditRole(role: string): void {
  if (!READ_ROLES.has(role)) {
    throw new ProblemError(Problems.forbidden('Auditor or org_admin role required'));
  }
}

export async function registerAudit(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'audit', status: 'live', phase: '1.4' }));

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

  // POST /v1/audit/events/verify — chain replay
  app.post('/verify', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireAuditRole(ctx.role);
    const body = verifyChainRequestSchema.parse(req.body ?? {});
    const result = await AuditService.verifyChain({
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
      ...(body.fromUlid && { fromUlid: body.fromUlid }),
      ...(body.toUlid && { toUlid: body.toUlid }),
    });
    return reply.code(200).send(result);
  });

  // GET /v1/audit/events/export — NDJSON stream (Phase 1.4).
  // Streams all org audit events as newline-delimited JSON. S3 sink is Phase 2;
  // for now the caller downloads directly from this HTTP response.
  app.get('/export', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireAuditRole(ctx.role);
    const query = exportAuditEventsQuerySchema.parse(req.query);

    const orgId = ctx.orgId;
    const regionCode = ctx.regionCode as RegionCode;
    const BATCH = 500;

    async function* rowGenerator() {
      let cursor: string | undefined;
      while (true) {
        const result = await AuditService.listEvents({
          orgId,
          regionCode,
          ...(query.resourceType && { resourceType: query.resourceType }),
          ...(query.resourceId && { resourceId: query.resourceId }),
          ...(query.action && { action: query.action }),
          ...(query.from && { from: new Date(query.from) }),
          ...(query.to && { to: new Date(query.to) }),
          ...(cursor && { cursor }),
          limit: BATCH,
        });
        for (const ev of result.data) {
          yield JSON.stringify(ev) + '\n';
        }
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
    }

    reply.raw.setHeader('Content-Type', 'application/x-ndjson');
    reply.raw.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-events-${orgId}.ndjson"`,
    );
    return reply.send(Readable.from(rowGenerator()));
  });
}
