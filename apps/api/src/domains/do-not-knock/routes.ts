/**
 * Do-Not-Knock (DNK) routes — Phase 1.4 real.
 *
 *   POST /v1/do-not-knock/check    precheck one address before a knock is recorded
 *   POST /v1/do-not-knock/ingest   bulk upsert hashed addresses from registry or manager flag
 *   GET  /v1/do-not-knock          cursor-paginated list (admin/auditor only)
 *
 * Cross-cutting:
 *   - DNK is region-scoped; orgId is not stored on DoNotKnock rows.
 *   - check: if addressId provided, direct lookup; if hashedAddress provided, resolve
 *     Address by hashKey first.
 *   - ingest: resolve Address rows by hashKey, upsert DoNotKnock by (regionCode, addressId).
 *     Rows whose hashKey resolves to no Address are skipped.
 */
import type { FastifyInstance } from 'fastify';
import { dnkCheckRequestSchema, dnkIngestRequestSchema } from '@d2d/shared-types';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import type { RegionCode } from '@prisma/client';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';

const ADMIN_ROLES = new Set(['super_admin', 'org_admin', 'auditor']);

export async function registerDoNotKnock(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'do-not-knock', status: 'live', phase: '1.4' }));

  // POST /v1/do-not-knock/check — returns { blocked: boolean }
  app.post('/check', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const input = dnkCheckRequestSchema.parse(req.body);
    const regionCode = ctx.regionCode as RegionCode;

    let addressId: string | null = null;

    if (input.addressId) {
      addressId = input.addressId;
    } else if (input.hashedAddress) {
      const addr = await prisma().address.findFirst({
        where: { regionCode, hashKey: input.hashedAddress },
        select: { id: true },
      });
      addressId = addr?.id ?? null;
    }

    if (!addressId) {
      return reply.code(200).send({ blocked: false });
    }

    const hit = await prisma().doNotKnock.findUnique({
      where: { regionCode_addressId: { regionCode, addressId } },
      select: { id: true, source: true, loadedAt: true },
    });

    return reply
      .code(200)
      .send({ blocked: !!hit, ...(hit && { source: hit.source, loadedAt: hit.loadedAt }) });
  });

  // POST /v1/do-not-knock/ingest — bulk upsert; resolves hashedAddress → Address rows
  app.post('/ingest', { preHandler: requireAuth }, async (req, reply) => {
    requireIdempotencyKey(req);
    const ctx = requireTenant(req);

    if (!ADMIN_ROLES.has(ctx.role)) {
      throw new ProblemError(Problems.forbidden('org_admin or auditor role required'));
    }

    const { source, rows } = dnkIngestRequestSchema.parse(req.body);
    const regionCode = ctx.regionCode as RegionCode;

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const addr = await prisma().address.findFirst({
        where: { regionCode, hashKey: row.hashedAddress },
        select: { id: true },
      });

      if (!addr) {
        skipped++;
        continue;
      }

      await prisma().doNotKnock.upsert({
        where: { regionCode_addressId: { regionCode, addressId: addr.id } },
        create: {
          id: newId('dnk'),
          regionCode,
          addressId: addr.id,
          source,
          loadedAt: row.capturedAt ? new Date(row.capturedAt) : new Date(),
        },
        update: { source, loadedAt: row.capturedAt ? new Date(row.capturedAt) : new Date() },
      });
      inserted++;
    }

    return reply.code(200).send({ inserted, skipped, source, regionCode });
  });

  // GET /v1/do-not-knock — cursor-paginated list (admin/auditor only)
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);

    if (!ADMIN_ROLES.has(ctx.role)) {
      throw new ProblemError(Problems.forbidden('org_admin or auditor role required'));
    }

    const query = req.query as { cursor?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 100), 500);
    const regionCode = ctx.regionCode as RegionCode;

    const rows = await prisma().doNotKnock.findMany({
      where: { regionCode },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    return reply.code(200).send({ data, nextCursor });
  });
}
