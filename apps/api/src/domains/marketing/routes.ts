/**
 * Marketing routes — Agent 16 real.
 *
 * Mount: `app.register(registerMarketing, { prefix: '/v1/marketing' })`.
 *
 *   GET    /providers                       list (all 11 adapters + connection status)
 *   POST   /providers/:kind/connect         body: { credentials, mode, accountIdentifiers? }
 *                                           returns plaintext webhookSecret ONCE.
 *   DELETE /providers/:kind                 soft-disconnect (status='disconnected')
 *   GET    /providers/:kind/status          ping + persist + return
 *
 *   POST   /creatives/generate              body: { capability, providerKind, input }
 *                                           Persists ContentGenerationJob.
 *   GET    /creatives/jobs                  cursor-paginated, filter status|kind|capability
 *   GET    /creatives/jobs/:id              poll status (calls adapter.pollJob if async)
 *
 *   POST   /audiences/build                 body: { providerKind, input }
 *   POST   /campaigns/deliver               body: { providerKind, input }
 *
 *   POST   /webhooks/:kind                  inbound (no JWT) — HMAC verified by adapter.
 *                                           Tenant resolved via `x-d2d-org` header for
 *                                           Phase 3.1 (orgId-in-path lands later).
 *   GET    /webhooks/:kind/recent           paginated, last 50 events
 *
 * Permissions:
 *   - org_admin or super_admin for connect/disconnect/status
 *   - Any authenticated user for generate/list/get/build/deliver
 *   - No JWT for inbound webhook (HMAC is the auth)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { MarketingService } from './service';
import {
  buildAudienceRequestSchema,
  connectProviderRequestSchema,
  deliverCampaignRequestSchema,
  generateCreativeRequestSchema,
  listJobsQuerySchema,
  listWebhookEventsQuerySchema,
  providerKindSchema,
} from './schemas';

interface KindParams {
  kind: string;
}
interface IdParams {
  id: string;
}

const queueCreativesSchema = z
  .object({
    variantIds: z.array(z.string().min(1).max(120)).min(1).max(50),
    // The BFF forwards orgId + requestedByUserId; orgId is authoritatively
    // taken from the tenant guard, requestedByUserId stamps Creative.approvedBy.
    orgId: z.string().min(1).optional(),
    requestedByUserId: z.string().min(1).optional(),
  })
  .strict();

const listCampaignsQuerySchema = z
  .object({
    status: z.string().min(1).max(40).optional(),
  })
  .strict();

const ADMIN_ROLES = new Set(['super_admin', 'org_admin']);

function requireAdmin(role: string): void {
  if (!ADMIN_ROLES.has(role)) {
    throw new ProblemError(Problems.forbidden('org_admin role required'));
  }
}

export async function registerMarketing(app: FastifyInstance): Promise<void> {
  const service = new MarketingService(app.integrations);

  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'marketing',
    status: 'live',
    phase: '3.1',
  }));

  // ── Providers ──────────────────────────────────────────────────────────

  app.get('/providers', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const data = await service.listProviders(ctx.orgId);
    return reply.code(200).send({ providers: data });
  });

  app.get<{ Params: KindParams }>(
    '/providers/:kind/status',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const kind = providerKindSchema.parse(req.params.kind);
      const connection = await service.getProviderStatus(kind, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ connection });
    },
  );

  app.post<{ Params: KindParams }>(
    '/providers/:kind/connect',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireAdmin(ctx.role);
      const kind = providerKindSchema.parse(req.params.kind);
      const body = connectProviderRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await service.connectProvider(kind, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return {
            status: 201,
            body: {
              connection: result.connection,
              webhookSecret: result.webhookSecret,
            },
          };
        },
      });
    },
  );

  app.delete<{ Params: KindParams }>(
    '/providers/:kind',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      requireAdmin(ctx.role);
      const kind = providerKindSchema.parse(req.params.kind);
      const connection = await service.disconnectProvider(kind, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ connection });
    },
  );

  // ── Creative generation ────────────────────────────────────────────────

  app.post('/creatives/generate', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = generateCreativeRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.generateCreative(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { job } };
      },
    });
  });

  app.get('/creatives/jobs', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listJobsQuerySchema.parse(req.query);
    const result = await service.listJobs(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  app.get<{ Params: IdParams }>(
    '/creatives/jobs/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const job = await service.getJob(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send({ job });
    },
  );

  // ── Audience build / campaign deliver ──────────────────────────────────

  app.post('/audiences/build', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = buildAudienceRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.buildAudience(body.providerKind, body.input, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { job } };
      },
    });
  });

  app.post('/campaigns/deliver', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = deliverCampaignRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.deliverCampaign(body.providerKind, body.input, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { job } };
      },
    });
  });

  // ── Review queue (approve → draft AdCampaign) ──────────────────────────

  // Approve a batch of generated variants into a NEW draft AdCampaign. The
  // BFF /api/marketing/queue forwards { variantIds, orgId, requestedByUserId }.
  app.post('/creatives/queue', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = queueCreativesSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await service.queueCreatives(
          body.variantIds,
          body.requestedByUserId ?? ctx.userId,
          {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          },
        );
        return { status: 201, body: result };
      },
    });
  });

  // List draft AdCampaigns (the review queue) with their creatives.
  app.get('/campaigns', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listCampaignsQuerySchema.parse(req.query);
    const campaigns = await service.listDraftCampaigns(ctx.orgId, query.status ?? 'draft');
    return reply.code(200).send({ campaigns });
  });

  // ── CAPI attribution ───────────────────────────────────────────────────

  // Recently-attributed retargeting conversions (last 50, tenant-scoped).
  app.get('/attribution/recent', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const conversions = await service.recentAttributedConversions(ctx.orgId);
    return reply.code(200).send({ conversions });
  });

  // ── Inbound webhooks (no JWT — HMAC is the auth) ───────────────────────
  // Tenant resolution is by `x-d2d-org` header for Phase 3.1; orgId-in-path
  // lands later as `/v1/marketing/webhooks/:kind/:orgId`. We require the
  // header so the route can scope the connection lookup.
  //
  // SEC-007 fix: HMAC must operate on the EXACT bytes the provider sent.
  // Fastify's default JSON parser re-canonicalises the JSON (whitespace,
  // key order, Unicode escapes), which breaks signature verification for
  // strict providers (Meta/TikTok/Higgsfield etc). We register a scoped
  // child app whose content-type parser preserves the raw Buffer on
  // `req.rawBody` BEFORE JSON-parsing. Only the webhook routes get this
  // behaviour — sibling routes keep Fastify's default JSON parsing.
  await app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      // `body` is the raw Buffer thanks to parseAs:'buffer'. Stash for
      // the handler, then JSON-parse so the handler still gets a JS
      // object on `req.body`.
      (req as unknown as { rawBody?: Buffer }).rawBody = body as Buffer;
      if ((body as Buffer).length === 0) {
        done(null, {});
        return;
      }
      try {
        const parsed = JSON.parse((body as Buffer).toString('utf-8'));
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    scope.post<{ Params: KindParams }>('/webhooks/:kind', async (req, reply) => {
      const kind = providerKindSchema.parse(req.params.kind);
      const orgId = req.headers['x-d2d-org'];
      if (typeof orgId !== 'string' || orgId.length === 0) {
        throw new ProblemError(
          Problems.validation('x-d2d-org header required for inbound webhook'),
        );
      }
      // Use the raw bytes captured by the scoped parser. Fall back to a
      // canonical re-serialise only if the parser wasn't engaged (e.g.
      // non-JSON content type) — this is mostly defensive; webhook
      // providers always send application/json.
      const stashed = (req as unknown as { rawBody?: Buffer }).rawBody;
      const raw =
        stashed instanceof Buffer
          ? stashed
          : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
      const event = await service.recordInboundWebhook(kind, orgId, raw, req.headers);
      return reply.code(202).send({ event });
    });
  });

  app.get<{ Params: KindParams }>(
    '/webhooks/:kind/recent',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const kind = providerKindSchema.parse(req.params.kind);
      const query = listWebhookEventsQuerySchema.parse(req.query);
      const result = await service.listWebhookEvents(kind, query, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply.code(200).send(result);
    },
  );
}
