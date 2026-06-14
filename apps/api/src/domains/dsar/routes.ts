/**
 * DSAR (Data Subject Access Request) routes — Phase 1.4 real.
 *
 *   POST /v1/dsar/requests                file a DSAR
 *   GET  /v1/dsar/requests                list (admin/auditor; cursor-paginated)
 *   GET  /v1/dsar/requests/:id            get one with full status timeline
 *   POST /v1/dsar/requests/:id/fulfil     mark fulfilled + attach response package URL
 *   POST /v1/dsar/requests/:id/reject     reject with reason (e.g. identity unverified)
 *
 * Cross-cutting:
 *   - Per-jurisdiction SLAs: AU 30d, CCPA/CPRA 45d, GDPR 30d, PDPA 30d.
 *   - Deletion path anonymises lead/conversion/donation PII; audit rows are
 *     never deleted (append-only requirement).
 *   - Every action writes an audit row.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dsarRequestSchema } from '@d2d/shared-types';
import type { RegionCode } from '@prisma/client';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import {
  fileDsar,
  listDsarRequests,
  getDsarRequest,
  fulfilDsarRequest,
  rejectDsarRequest,
} from './service';

interface IdParams {
  id: string;
}

const listQuerySchema = z
  .object({
    status: z.enum(['pending', 'in_progress', 'fulfilled', 'rejected']).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
  })
  .strict();

const fulfilSchema = z.object({ responsePackageKey: z.string().optional() }).strict();

const rejectSchema = z.object({ reason: z.string().min(1).max(2000) }).strict();

export async function registerDsar(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'dsar', status: 'live', phase: '1.4' }));

  // POST /v1/dsar/requests — file a new DSAR
  app.post('/requests', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = dsarRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const request = await fileDsar(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as RegionCode,
          role: ctx.role,
        });
        return { status: 201, body: { request } };
      },
    });
  });

  // GET /v1/dsar/requests — list (admin/auditor only)
  app.get('/requests', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listQuerySchema.parse(req.query);
    const result = await listDsarRequests(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as RegionCode,
      role: ctx.role,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/dsar/requests/:id
  app.get<{ Params: IdParams }>(
    '/requests/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const request = await getDsarRequest(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as RegionCode,
        role: ctx.role,
      });
      return reply.code(200).send({ request });
    },
  );

  // POST /v1/dsar/requests/:id/fulfil
  app.post<{ Params: IdParams }>(
    '/requests/:id/fulfil',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = fulfilSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const request = await fulfilDsarRequest(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as RegionCode,
            role: ctx.role,
          });
          return { status: 200, body: { request } };
        },
      });
    },
  );

  // POST /v1/dsar/requests/:id/reject
  app.post<{ Params: IdParams }>(
    '/requests/:id/reject',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = rejectSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const request = await rejectDsarRequest(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as RegionCode,
            role: ctx.role,
          });
          return { status: 200, body: { request } };
        },
      });
    },
  );
}
