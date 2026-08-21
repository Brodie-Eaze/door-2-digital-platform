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

    let skipped = 0;

    // DNK/DNC lists are large (thousands of suppressed addresses). The old path
    // did a sequential address.findFirst + doNotKnock.upsert PER ROW — 2N
    // round-trips that time out on a real ingest. Batch it: one findMany to
    // resolve every address, one createMany to insert. Addresses already on the
    // list are left untouched (skipDuplicates) — they stay suppressed.
    const hashKeys = [...new Set(rows.map((r) => r.hashedAddress))];
    const addrs = await prisma().address.findMany({
      where: { regionCode, hashKey: { in: hashKeys } },
      select: { id: true, hashKey: true },
    });
    const addrIdByHash = new Map(addrs.map((a) => [a.hashKey, a.id]));

    // Resolve rows → DNK payloads, deduped by addressId; a row whose address
    // isn't on file counts as skipped (same as before).
    const byAddr = new Map<
      string,
      {
        id: string;
        regionCode: RegionCode;
        addressId: string;
        source: typeof source;
        loadedAt: Date;
      }
    >();
    for (const row of rows) {
      const addressId = addrIdByHash.get(row.hashedAddress);
      if (!addressId) {
        skipped++;
        continue;
      }
      byAddr.set(addressId, {
        id: newId('dnk'),
        regionCode,
        addressId,
        source,
        loadedAt: row.capturedAt ? new Date(row.capturedAt) : new Date(),
      });
    }

    const result = await prisma().doNotKnock.createMany({
      data: [...byAddr.values()],
      skipDuplicates: true,
    });

    return reply.code(200).send({ inserted: result.count, skipped, source, regionCode });
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
