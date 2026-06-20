/**
 * Door 2 Digital API — Fastify entry point.
 *
 * Lifecycle:
 *   1. Validate env (fail-fast)
 *   2. Initialise OTel + Pino + Prisma + Redis
 *   3. Register Fastify plugins (helmet, cors, rate-limit, sensible)
 *   4. Mount middlewares (idempotency, tenant guard, region guard, auth)
 *   5. Mount routes (auth, org, user, territory, knock, lead, ...)
 *   6. Register graceful shutdown
 *   7. Listen
 */
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma, shutdownDb } from './config/db';
import { redis, shutdownRedis } from './config/redis';
import { errorHandler } from './shared/errors/handler';
import { registerHealthRoutes } from './shared/health';
import { registerCorrelationId } from './shared/middleware/correlation';
import { newId } from '@d2d/shared-utils';
import { registerAuth } from './domains/auth/routes';
import { registerOrg } from './domains/org/routes';
import { registerUser } from './domains/user/routes';
import { registerTerritory } from './domains/territory/routes';
import { registerKnock, registerKnockSessions } from './domains/knock/routes';
import { registerLead } from './domains/lead/routes';
import { registerCrm } from './domains/crm/routes';
import { registerConversion } from './domains/conversion/routes';
import { registerFieldSignup } from './domains/field-signup/routes';
import { registerCatalog } from './domains/catalog/routes';
import { registerRoster } from './domains/roster/routes';
import { registerPhoto } from './domains/photo/routes';
import { registerPropensity } from './domains/propensity/routes';
import { registerVoice } from './domains/voice/routes';
import { registerAnalytics } from './domains/analytics/routes';
import { registerDonation } from './domains/donation/routes';
import { registerPayment } from './domains/payment/routes';
import { registerSale } from './domains/sale/routes';
import { registerCommission } from './domains/commission/routes';
import { registerPayout } from './domains/payout/routes';
import { registerBilling } from './domains/billing/routes';
import { registerCompliance } from './domains/compliance/routes';
import { registerDoNotKnock } from './domains/do-not-knock/routes';
import { registerDoNotCall } from './domains/do-not-call/routes';
import { registerConsent } from './domains/consent/routes';
import { registerPiiVault } from './domains/pii-vault/routes';
import { registerAudit } from './domains/audit/routes';
import { registerNotification } from './domains/notification/routes';
import { registerWebhook } from './domains/webhook/routes';
import { registerDsar } from './domains/dsar/routes';
import { registerMarketing } from './domains/marketing/routes';
import { registerContentStudio } from './domains/content-studio/routes';
import { registerRealtime } from './domains/realtime/routes';
import { registerIntegrations } from './integrations';
import { registerMcpServer } from './mcp/server';
import { startAuditShipper } from './workers/audit-shipper.worker';
import { startDnkSync } from './workers/dnk-sync.worker';
import { startLeadSequenceWorker } from './workers/lead-sequence.worker';
import { startNotificationSendWorker } from './workers/notification-send.worker';
import { startWebhookDeliverWorker } from './workers/webhook-deliver.worker';
import { startCommissionCalcWorker } from './workers/commission-calc.worker';
import { startPayoutPrepareWorker } from './workers/payout-prepare.worker';
import { startKnockSyncWorker } from './workers/knock-sync.worker';
import { startLeadRoutingWorker } from './workers/lead-routing.worker';
import { startConversionFinaliseWorker } from './workers/conversion-finalise.worker';
import { startContentGenerateWorker } from './workers/content-generate.worker';
import { startAdDeliverWorker } from './workers/ad-deliver.worker';
import { startGeoRefreshWorker } from './workers/geo-refresh.worker';
import { startAddressEnrichWorker } from './workers/address-enrich.worker';
import { startPlanetIntelWorker } from './workers/planet-intel.worker';
import { registerPlanetInbound } from './inbound/planet';

async function buildServer() {
  const e = env();
  const log = logger();

  // Cold-start dependencies so we fail fast if misconfigured.
  prisma();
  redis();

  const app = Fastify({
    logger: log,
    // SEC-006: trust exactly 1 upstream hop (the load balancer). `true` would
    // trust the entire X-Forwarded-For chain, allowing an attacker to prepend a
    // spoofed IP and bypass the per-IP rate limit bucket. With hop count = 1,
    // Fastify takes the rightmost client IP added by our LB — which the caller
    // cannot control.
    trustProxy: 1,
    bodyLimit: 1024 * 1024, // 1 MB default; knock-batch route bumps to 10 MB
    genReqId: () => newId('req'),
  });

  // Cookie parser (required by auth routes to set httpOnly d2d_at / d2d_rt
  // session cookies). Must register BEFORE routes.
  await app.register(cookie, {
    secret: e.CSRF_SIGNING_SECRET, // signed cookies use this
    hook: 'onRequest',
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
      },
    },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // CORS — strict origin allowlist from env
  await app.register(cors, {
    origin: e.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });

  // Rate limiter — bucket per client IP.
  //
  // SEC-010 / PEN-011: the bucket key MUST derive from a TRUSTED identifier.
  // It previously preferred the caller-supplied `x-api-key` header, so an
  // attacker could rotate that header to a fresh value on every request and
  // mint an unlimited number of empty buckets — fully bypassing the limit.
  //
  // This global limiter runs on the `onRequest` hook (before any auth
  // preHandler), so no verified principal / API-key id exists yet, and this
  // service has no API-key auth layer to derive one from. We therefore key on
  // `req.ip` — Fastify-derived from the connection (with `trustProxy` honouring
  // the validated X-Forwarded-For), which the caller cannot freely forge — and
  // never read the attacker-controlled header for keying.
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    redis: redis(),
    keyGenerator: (req) => `ip:${req.ip}`,
  });

  await app.register(sensible);

  // Correlation ID echoed on every response
  await app.register(registerCorrelationId);

  // Unified RFC 7807 error handler
  app.setErrorHandler(errorHandler);

  // Health checks (unauthenticated)
  await app.register(registerHealthRoutes);

  // Domain routes — auth first, then identity, then field-capture, CRM,
  // money, compliance / privacy, infrastructure, marketing. All return
  // RFC 7807 501 stubs until their Phase 1.X owner lands implementation.

  // Identity / tenancy (Phase 1.1)
  await app.register(registerAuth, { prefix: '/v1/auth' });
  await app.register(registerOrg, { prefix: '/v1/orgs' });
  await app.register(registerUser, { prefix: '/v1/users' });
  await app.register(registerPiiVault, { prefix: '/v1/pii' });
  await app.register(registerAudit, { prefix: '/v1/audit/events' });

  // Field capture + CRM (Phase 1.2)
  await app.register(registerTerritory, { prefix: '/v1/territories' });
  await app.register(registerKnock, { prefix: '/v1/knocks' });
  await app.register(registerKnockSessions, { prefix: '/v1/sessions' });
  await app.register(registerLead, { prefix: '/v1/leads' });
  await app.register(registerConsent, { prefix: '/v1/consent' });
  await app.register(registerDoNotKnock, { prefix: '/v1/do-not-knock' });
  await app.register(registerDoNotCall, { prefix: '/v1/do-not-call' });
  await app.register(registerCompliance, { prefix: '/v1/compliance' });
  await app.register(registerNotification, { prefix: '/v1/notifications' });

  // CRM + money (Phase 1.3)
  await app.register(registerCrm, { prefix: '/v1/crm' });
  await app.register(registerConversion, { prefix: '/v1/conversions' });
  await app.register(registerFieldSignup, { prefix: '/v1/field' });
  await app.register(registerCatalog, { prefix: '/v1/catalog' });
  await app.register(registerRoster, { prefix: '/v1/roster' });
  await app.register(registerPhoto, { prefix: '/v1/photos' });
  await app.register(registerPropensity, { prefix: '/v1/propensity' });
  await app.register(registerVoice, { prefix: '/v1/voice' });
  await app.register(registerAnalytics, { prefix: '/v1/analytics' });
  await app.register(registerDonation, { prefix: '/v1/donations' });
  await app.register(registerPayment, { prefix: '/v1/payments' });
  await app.register(registerSale, { prefix: '/v1/sales' });
  await app.register(registerCommission, { prefix: '/v1/commissions' });
  await app.register(registerPayout, { prefix: '/v1/payout-batches' });
  await app.register(registerBilling, { prefix: '/v1/billing' });
  await app.register(registerWebhook, { prefix: '/v1/webhooks' });
  await app.register(registerRealtime, { prefix: '/v1/realtime' });

  // Privacy ops (Phase 1.4)
  await app.register(registerDsar, { prefix: '/v1/dsar/requests' });

  // Data intelligence inbound webhook (Planet Labs push delivery)
  await app.register(registerPlanetInbound, { prefix: '/v1/inbound' });

  // GET /v1/addresses/:id/intel — Snowflake enrichment score + features for an address.
  // Read-only: queries the PropensityScore table written by the address-enrich worker.
  await app.register(
    async (intelApp) => {
      const { requireAuth } = await import('./shared/middleware/auth-guard');
      const { requireTenant } = await import('./shared/middleware/tenant-guard');
      intelApp.get<{ Params: { id: string } }>(
        '/:id/intel',
        { preHandler: requireAuth },
        async (req, reply) => {
          const ctx = requireTenant(req);
          const { prisma: db } = await import('./config/db');
          const row = await db().propensityScore.findFirst({
            where: {
              geoType: 'address',
              geoKey: req.params.id,
              OR: [{ orgId: ctx.orgId }, { orgId: null }],
            },
            orderBy: { computedAt: 'desc' },
          });
          if (!row) return reply.code(404).send({ error: 'not_found' });
          const features = (row.features ?? {}) as Record<string, unknown>;
          return reply.code(200).send({
            intel: {
              score: row.score,
              prizmName: features.prizmName ?? null,
              prizmCode: features.prizmCode ?? null,
              medianHhIncomeUsd: features.medianHhIncomeUsd ?? null,
              charitablePropensity: features.charitablePropensity ?? null,
              estimatedHomeValueUsd: features.estimatedHomeValueUsd ?? null,
              ownerOccupancyRate: features.ownerOccupancyRate ?? null,
              modelName: row.modelName,
              computedAt: row.computedAt.toISOString(),
            },
          });
        },
      );
    },
    { prefix: '/v1/addresses' },
  );

  // Marketing + AI content (Phase 3) — registry first so route handlers can dispatch.
  await app.register(registerIntegrations);
  await app.register(registerMarketing, { prefix: '/v1/marketing' });
  await app.register(registerContentStudio, { prefix: '/v1/content-studio' });
  await app.register(registerMcpServer, { prefix: '/v1/mcp' });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'graceful shutdown begin');
    await app.close();
    await shutdownDb();
    await shutdownRedis();
    log.info('graceful shutdown complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return app;
}

async function main(): Promise<void> {
  const e = env();
  const app = await buildServer();
  await app.listen({ port: e.PORT, host: e.HOST });

  if (e.CRON_LEADER) {
    startAuditShipper();
    startDnkSync();
    startLeadSequenceWorker();
    startNotificationSendWorker();
    startWebhookDeliverWorker();
    startCommissionCalcWorker();
    startPayoutPrepareWorker();
    startKnockSyncWorker();
    startLeadRoutingWorker();
    startConversionFinaliseWorker();
    startContentGenerateWorker();
    startAdDeliverWorker();
    startGeoRefreshWorker();
    startAddressEnrichWorker();
    startPlanetIntelWorker();
    logger().info(
      'CRON_LEADER=true — all 15 workers started: audit-shipper, dnk-sync, lead-sequence, notification-send, webhook-deliver, commission-calc, payout-prepare, knock-sync, lead-routing, conversion-finalise, content-generate, ad-deliver, geo-refresh, address-enrich, planet-intel',
    );
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
