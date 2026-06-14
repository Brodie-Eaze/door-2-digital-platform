/**
 * PII Vault routes — Phase 1.1 real.
 *
 *   POST  /v1/pii/unmask-request                  request unmask (justification + fields)
 *   POST  /v1/pii/unmask-approve/:requestId       approve (must be != requester); mints grant
 *   POST  /v1/pii/unmask/:requestId/reveal        reveal plaintext (grant required)
 *   GET   /v1/pii/unmask-grants/:requestId        status + audit metadata
 *   POST  /v1/pii/decrypt                         501 — direct decryption (operator-tier only)
 *
 * All paths require JWT. Role gates:
 *   - request: super_admin | org_admin | inside_sales
 *   - approve: super_admin | org_admin (and must differ from requester)
 *   - reveal: super_admin | org_admin | inside_sales (the requester)
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';
import { writeAudit } from '../../shared/audit/write';
import { PiiVaultService, type EncryptedField } from './service';
import {
  unmaskRequestInputSchema,
  unmaskApproveInputSchema,
  unmaskRevealInputSchema,
  directDecryptInputSchema,
} from './schemas';
import type { RegionCode } from '@prisma/client';

const REQUEST_ROLES = new Set(['super_admin', 'org_admin', 'inside_sales']);
const APPROVE_ROLES = new Set(['super_admin', 'org_admin']);
const DECRYPT_ROLES = new Set(['super_admin']);

interface IdParams {
  requestId: string;
}

function requireRole(actorRole: string, allowed: Set<string>): void {
  if (!allowed.has(actorRole)) {
    throw new ProblemError(Problems.forbidden('Role not permitted for this PII action'));
  }
}

export async function registerPiiVault(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'pii-vault',
    status: 'live',
    phase: '1.1',
  }));

  // POST /v1/pii/unmask-request
  app.post('/unmask-request', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, REQUEST_ROLES);
    const body = unmaskRequestInputSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await PiiVaultService.requestUnmask(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: result };
      },
    });
  });

  // POST /v1/pii/unmask-approve/:requestId
  app.post<{ Params: IdParams }>(
    '/unmask-approve/:requestId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireRole(ctx.role, APPROVE_ROLES);
      const body = unmaskApproveInputSchema.parse(req.body ?? {});
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await PiiVaultService.approveUnmask(req.params.requestId, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: result };
        },
      });
    },
  );

  // POST /v1/pii/unmask/:requestId/reveal
  app.post<{ Params: IdParams }>(
    '/unmask/:requestId/reveal',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireRole(ctx.role, REQUEST_ROLES);
      const body = unmaskRevealInputSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await PiiVaultService.revealUnmask(req.params.requestId, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: result };
        },
      });
    },
  );

  // GET /v1/pii/unmask-grants/:requestId — status (no plaintext)
  app.get<{ Params: IdParams }>(
    '/unmask-grants/:requestId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const result = await PiiVaultService.getUnmaskRequest(req.params.requestId, {
        orgId: ctx.orgId,
      });
      return reply.code(200).send(result);
    },
  );

  // POST /v1/pii/decrypt — operator-tier direct decrypt (super_admin only, every call audited)
  app.post('/decrypt', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, DECRYPT_ROLES);
    const body = directDecryptInputSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        // Tenant assertion — 404 on mismatch (never leak existence across tenants)
        let tenantOk = false;
        if (body.rowType === 'Lead') {
          const row = await prisma().lead.findUnique({ where: { id: body.rowId } });
          tenantOk = row?.orgId === ctx.orgId;
        } else if (body.rowType === 'Donation') {
          const row = await prisma().donation.findUnique({
            where: { id: body.rowId },
            include: { conversion: { select: { orgId: true } } },
          });
          tenantOk = row?.conversion?.orgId === ctx.orgId;
        } else if (body.rowType === 'Sale') {
          const row = await prisma().sale.findUnique({
            where: { id: body.rowId },
            include: { conversion: { select: { orgId: true } } },
          });
          tenantOk = row?.conversion?.orgId === ctx.orgId;
        } else if (body.rowType === 'Conversion') {
          const row = await prisma().conversion.findUnique({ where: { id: body.rowId } });
          tenantOk = row?.orgId === ctx.orgId;
        }
        if (!tenantOk) {
          throw new ProblemError(Problems.notFound(body.rowType, body.rowId));
        }

        const plaintext = PiiVaultService.decrypt(
          body.vaultBlob as EncryptedField,
          body.rowType,
          body.rowId,
        );

        await writeAudit(prisma(), {
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as RegionCode,
          actorUserId: ctx.userId,
          action: 'pii.direct_decrypt',
          resourceType: body.rowType,
          resourceId: body.rowId,
          afterJson: { rowType: body.rowType, rowId: body.rowId, reason: body.reason },
        });

        return { status: 200, body: { plaintext } };
      },
    });
  });
}
