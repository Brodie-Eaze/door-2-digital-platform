/**
 * CRM (sequences + activities + outbound integrations) routes — Phase 1.4 real.
 *
 *   GET  /v1/crm/activities              cross-lead activity feed
 *   POST /v1/crm/sequences               create sequence template (audit-trailed)
 *   POST /v1/crm/sequences/:id/enroll    enroll leads into sequence (audit-trailed)
 *
 *   GET    /v1/crm/integrations             list configured CRM integrations for this org
 *   POST   /v1/crm/integrations             save/update a CRM integration config
 *   DELETE /v1/crm/integrations/:kind       remove a CRM integration config
 *   POST   /v1/crm/integrations/:kind/test  ping the adapter to verify credentials work
 *
 * CRM integration configs are stored as ProviderConnection rows (kind = crm_*).
 * Credentials are sealed in the PII vault — same pattern as marketing providers.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createSequenceRequestSchema, enrollSequenceRequestSchema } from '@d2d/shared-types';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';
import { PiiVaultService, type EncryptedField } from '../pii-vault/service';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { buildDefaultRegistry, hasRealCredentials } from '@d2d/integrations';
import { createSequence, enrollLeadsInSequence } from './service';

const CRM_KINDS = new Set(['crm_salesforce', 'crm_hubspot', 'crm_zapier'] as const);
type CrmKind = 'crm_salesforce' | 'crm_hubspot' | 'crm_zapier';

const crmKindSchema = z.enum(['crm_salesforce', 'crm_hubspot', 'crm_zapier']);

/**
 * Per-kind credential fields the operator MUST supply for production. Used to
 * surface exactly which fields are still missing — never the values, only the
 * names + whether each is present. (Optional fields like Zapier signingSecret
 * are excluded.)
 */
const REQUIRED_CRED_FIELDS: Record<CrmKind, string[]> = {
  crm_salesforce: ['instanceUrl', 'accessToken'],
  crm_hubspot: ['accessToken', 'portalId'],
  crm_zapier: ['webhookUrl'],
};

/**
 * Operator-facing readiness verdict for a CRM integration. Computed without
 * exposing any secret — only the NAMES of missing fields are returned.
 *
 *   - `ready`           production mode + all required creds present → live
 *   - `sandbox`         sandbox/dev mode → serving stub data by design
 *   - `needs_credentials` production mode but creds missing/blank → FAIL CLOSED
 *   - `unconfigured`    no connection row at all
 */
type CrmReadiness = 'ready' | 'sandbox' | 'needs_credentials' | 'unconfigured';

function computeReadiness(
  kind: CrmKind,
  mode: string,
  credentials: Record<string, string>,
): { readiness: CrmReadiness; missingFields: string[]; usingRealCredentials: boolean } {
  const required = REQUIRED_CRED_FIELDS[kind];
  const missingFields = required.filter((f) => {
    const v = credentials[f];
    return typeof v !== 'string' || v.trim().length === 0;
  });
  // `hasRealCredentials` is the SAME predicate the adapters fail-closed on, so
  // the surfaced verdict can never disagree with runtime behavior.
  const usingRealCredentials = hasRealCredentials({ credentials, mode: 'production' });

  if (mode !== 'production') {
    return { readiness: 'sandbox', missingFields, usingRealCredentials };
  }
  if (missingFields.length > 0 || !usingRealCredentials) {
    return { readiness: 'needs_credentials', missingFields, usingRealCredentials };
  }
  return { readiness: 'ready', missingFields, usingRealCredentials };
}

const saveCrmIntegrationSchema = z
  .object({
    kind: crmKindSchema,
    mode: z.enum(['sandbox', 'production']).default('production'),
    credentials: z.record(z.string()),
  })
  .strict();

const ADMIN_ROLES = new Set(['super_admin', 'org_admin']);
function requireAdmin(role: string): void {
  if (!ADMIN_ROLES.has(role)) {
    throw new ProblemError(Problems.forbidden('org_admin role required'));
  }
}

function sealCrmCredentials(rowId: string, credentials: Record<string, string>): EncryptedField {
  return PiiVaultService.encryptForRow(
    'ProviderConnection',
    rowId,
    JSON.stringify({ credentials }),
  );
}

function unsealCrmCredentials(rowId: string, vault: EncryptedField): Record<string, string> {
  const plain = PiiVaultService.decrypt(vault, 'ProviderConnection', rowId);
  const bundle = JSON.parse(plain) as { credentials: Record<string, string> };
  return bundle.credentials;
}

interface ActivitiesQuery {
  userId?: string;
  type?: string;
  cursor?: string;
  limit?: string;
}

interface IdParams {
  id: string;
}

interface KindParams {
  kind: string;
}

export async function registerCrm(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'crm', status: 'live', phase: '1.4' }));

  // ── CRM outbound integration config ──────────────────────────────────────

  // GET /v1/crm/integrations — list all configured CRM integrations for this org.
  // Each row carries a `readiness` verdict (ready | sandbox | needs_credentials)
  // and the NAMES of any still-missing required credential fields, so the
  // operator can see at a glance which integrations need real prod creds.
  // Secret VALUES are never returned.
  app.get('/integrations', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const rows = await prisma().providerConnection.findMany({
      where: { orgId: ctx.orgId, kind: { in: Array.from(CRM_KINDS) } },
      select: {
        id: true,
        kind: true,
        displayName: true,
        mode: true,
        status: true,
        accountLabel: true,
        accountId: true,
        lastPingAt: true,
        lastPingStatus: true,
        lastPingError: true,
        connectedAt: true,
        credentialsVault: true,
      },
      orderBy: { connectedAt: 'asc' },
    });

    const integrations = rows.map((r) => {
      let credentials: Record<string, string> = {};
      if (r.credentialsVault) {
        try {
          credentials = unsealCrmCredentials(r.id, r.credentialsVault as unknown as EncryptedField);
        } catch {
          // Vault decrypt failure — treat as no usable creds (fail closed, not crash).
          credentials = {};
        }
      }
      const verdict = computeReadiness(r.kind as CrmKind, r.mode, credentials);
      // Strip the vault blob — never leak ciphertext or values to the client.
      const { credentialsVault: _omit, ...safe } = r;
      void _omit;
      return {
        ...safe,
        lastPingAt: r.lastPingAt?.toISOString() ?? null,
        connectedAt: r.connectedAt.toISOString(),
        readiness: verdict.readiness,
        usingRealCredentials: verdict.usingRealCredentials,
        missingCredentialFields: verdict.missingFields,
        requiredCredentialFields: REQUIRED_CRED_FIELDS[r.kind as CrmKind],
      };
    });

    // Also report which configurable CRM kinds have NO connection row yet, so
    // the operator sees the full surface of what still needs setup.
    const configured = new Set(rows.map((r) => r.kind));
    const unconfigured = Array.from(CRM_KINDS)
      .filter((k) => !configured.has(k))
      .map((k) => ({
        kind: k,
        readiness: 'unconfigured' as const,
        requiredCredentialFields: REQUIRED_CRED_FIELDS[k],
      }));

    return reply.code(200).send({ integrations, unconfigured });
  });

  // POST /v1/crm/integrations — save or update a CRM integration config
  app.post('/integrations', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireAdmin(ctx.role);
    const body = saveCrmIntegrationSchema.parse(req.body);

    const existing = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId: ctx.orgId, kind: body.kind } },
    });

    if (existing) {
      const sealed = sealCrmCredentials(existing.id, body.credentials);
      const updated = await prisma().providerConnection.update({
        where: { id: existing.id },
        data: {
          mode: body.mode,
          status: 'connected',
          credentialsVault: sealed as unknown as Prisma.InputJsonValue,
          connectedAt: new Date(),
          disconnectedAt: null,
        },
      });
      return reply
        .code(200)
        .send({ integration: { id: updated.id, kind: updated.kind, status: updated.status } });
    }

    const id = newId('prc');
    const sealed = sealCrmCredentials(id, body.credentials);
    const created = await prisma().providerConnection.create({
      data: {
        id,
        orgId: ctx.orgId,
        kind: body.kind,
        displayName:
          body.kind === 'crm_salesforce'
            ? 'Salesforce CRM'
            : body.kind === 'crm_hubspot'
              ? 'HubSpot CRM'
              : 'Zapier Webhook',
        mode: body.mode,
        status: 'connected',
        credentialsVault: sealed as unknown as Prisma.InputJsonValue,
      },
    });
    return reply
      .code(201)
      .send({ integration: { id: created.id, kind: created.kind, status: created.status } });
  });

  // DELETE /v1/crm/integrations/:kind — remove a CRM integration config
  app.delete<{ Params: KindParams }>(
    '/integrations/:kind',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireAdmin(ctx.role);
      const kind = crmKindSchema.parse(req.params.kind);

      const existing = await prisma().providerConnection.findUnique({
        where: { orgId_kind: { orgId: ctx.orgId, kind } },
      });
      // Return 404 for missing org-scoped resources per project convention.
      if (!existing) throw new ProblemError(Problems.notFound('CrmIntegration', kind));

      await prisma().providerConnection.update({
        where: { id: existing.id },
        data: { status: 'disconnected', disconnectedAt: new Date() },
      });
      return reply.code(204).send();
    },
  );

  // POST /v1/crm/integrations/:kind/test — ping the adapter to verify credentials
  app.post<{ Params: KindParams }>(
    '/integrations/:kind/test',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireAdmin(ctx.role);
      const kind = crmKindSchema.parse(req.params.kind) as CrmKind;

      const conn = await prisma().providerConnection.findUnique({
        where: { orgId_kind: { orgId: ctx.orgId, kind } },
      });
      if (!conn) throw new ProblemError(Problems.notFound('CrmIntegration', kind));

      let credentials: Record<string, string> = {};
      if (conn.credentialsVault) {
        credentials = unsealCrmCredentials(
          conn.id,
          conn.credentialsVault as unknown as EncryptedField,
        );
      }

      const registry = buildDefaultRegistry();
      const adapter = registry.tryGet(kind);
      if (!adapter) throw new ProblemError(Problems.notFound('CrmAdapter', kind));

      const config = {
        credentials,
        mode: conn.mode === 'production' ? ('production' as const) : ('sandbox' as const),
      };

      // Readiness verdict, surfaced regardless of ping outcome so the operator
      // can distinguish "creds work" from "no production creds supplied yet".
      const verdict = computeReadiness(kind, conn.mode, credentials);

      const result = await adapter.ping(config);

      // Persist ping result
      await prisma().providerConnection.update({
        where: { id: conn.id },
        data: {
          lastPingAt: new Date(),
          lastPingStatus: result.ok ? 'ok' : 'fail',
          lastPingError: result.ok ? null : result.error.message,
          ...(result.ok && {
            accountLabel: result.data.accountLabel,
            accountId: result.data.accountId,
            status: 'connected',
          }),
        },
      });

      const readinessBlock = {
        readiness: verdict.readiness,
        usingRealCredentials: verdict.usingRealCredentials,
        missingCredentialFields: verdict.missingFields,
        requiredCredentialFields: REQUIRED_CRED_FIELDS[kind],
      };

      if (!result.ok) {
        return reply.code(422).send({
          ok: false,
          error: { code: result.error.code, message: result.error.message },
          ...readinessBlock,
        });
      }
      return reply.code(200).send({ ok: true, account: result.data, ...readinessBlock });
    },
  );

  // GET /v1/crm/activities — paginated cross-lead activity feed scoped to caller's org
  app.get('/activities', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const q = req.query as ActivitiesQuery;
    const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);

    const rows = await prisma().leadActivity.findMany({
      where: {
        lead: { orgId: ctx.orgId },
        ...(q.userId && { userId: q.userId }),
        ...(q.type && { type: q.type }),
        ...(q.cursor && { id: { lt: q.cursor } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        leadId: true,
        userId: true,
        type: true,
        outcome: true,
        payload: true,
        createdAt: true,
        lead: { select: { id: true, givenName: true, familyName: true, status: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return reply.code(200).send({
      data: page.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    });
  });

  // POST /v1/crm/sequences — create a sequence template
  app.post('/sequences', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createSequenceRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const sequence = await createSequence(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { sequence } };
      },
    });
  });

  // POST /v1/crm/sequences/:id/enroll — enroll leads into a sequence
  app.post<{ Params: IdParams }>(
    '/sequences/:id/enroll',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = enrollSequenceRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const enrollment = await enrollLeadsInSequence(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: { enrollment } };
        },
      });
    },
  );
}
