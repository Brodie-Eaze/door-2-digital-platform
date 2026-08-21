/**
 * Test helpers — build a Fastify app with the same wiring as production,
 * just without the listen() call. Tests use app.inject() to issue
 * requests without binding a port.
 *
 * Also exposes `truncateAll()` to wipe mutable rows between suites.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { errorHandler } from '../../src/shared/errors/handler';
import { registerCorrelationId } from '../../src/shared/middleware/correlation';
import { registerAuth } from '../../src/domains/auth/routes';
import { registerOrg } from '../../src/domains/org/routes';
import { registerUser } from '../../src/domains/user/routes';
import { registerTerritory } from '../../src/domains/territory/routes';
import { registerKnock, registerKnockSessions } from '../../src/domains/knock/routes';
import { registerLead } from '../../src/domains/lead/routes';
import { registerAudit } from '../../src/domains/audit/routes';
import { registerPiiVault } from '../../src/domains/pii-vault/routes';
import { registerConversion } from '../../src/domains/conversion/routes';
import { registerDonation } from '../../src/domains/donation/routes';
import { registerSale } from '../../src/domains/sale/routes';
import { registerWebhook } from '../../src/domains/webhook/routes';
import { registerNotification } from '../../src/domains/notification/routes';
import { registerMarketing } from '../../src/domains/marketing/routes';
import { registerContentStudio } from '../../src/domains/content-studio/routes';
import { registerVoice } from '../../src/domains/voice/routes';
import { registerDsar } from '../../src/domains/dsar/routes';
import { registerIntegrations } from '../../src/integrations';
import { prisma, shutdownDb } from '../../src/config/db';
import { redis } from '../../src/config/redis';
import { newId } from '@d2d/shared-utils';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    genReqId: () => newId('req'),
  });
  await app.register(cookie, {
    secret: process.env.CSRF_SIGNING_SECRET ?? 'test-csrf-secret-must-be-at-least-32-chars-long',
  });
  await app.register(sensible);
  await app.register(registerCorrelationId);
  app.setErrorHandler(errorHandler);
  await app.register(registerAuth, { prefix: '/v1/auth' });
  await app.register(registerOrg, { prefix: '/v1/orgs' });
  await app.register(registerUser, { prefix: '/v1/users' });
  await app.register(registerTerritory, { prefix: '/v1/territories' });
  await app.register(registerKnock, { prefix: '/v1/knocks' });
  await app.register(registerKnockSessions, { prefix: '/v1/sessions' });
  await app.register(registerLead, { prefix: '/v1/leads' });
  await app.register(registerAudit, { prefix: '/v1/audit/events' });
  await app.register(registerPiiVault, { prefix: '/v1/pii' });
  await app.register(registerConversion, { prefix: '/v1/conversions' });
  await app.register(registerDonation, { prefix: '/v1/donations' });
  await app.register(registerSale, { prefix: '/v1/sales' });
  await app.register(registerWebhook, { prefix: '/v1/webhooks' });
  await app.register(registerNotification, { prefix: '/v1/notifications' });
  await registerIntegrations(app);
  await app.register(registerMarketing, { prefix: '/v1/marketing' });
  await app.register(registerContentStudio, { prefix: '/v1/content-studio' });
  await app.register(registerVoice, { prefix: '/v1/voice' });
  await app.register(registerDsar, { prefix: '/v1/dsar' });
  await app.ready();
  return app;
}

/**
 * Wipe rows from every domain table — order honours FK constraints. We
 * truncate so the next test starts from a known empty state.
 */
export async function truncateAll(): Promise<void> {
  const tables = [
    'AuditEvent',
    'IdempotencyRecord',
    'RefreshToken',
    'UserCredential',
    'TerritoryAssignment',
    'territory_claims', // mapped name (TerritoryClaim @@map); no FK, order-free
    'Knock',
    'KnockSession',
    'LeadActivity',
    'ConsentRecord',
    'Donation',
    'Sale',
    'Commission',
    'PayoutBatch',
    'CommissionPlan',
    'Conversion',
    'Lead',
    'Territory',
    'CampaignStateClearance',
    'PaidSolicitorRegistration',
    'Campaign',
    'Creative',
    'AdCampaign',
    'AdAccount',
    'WebhookDelivery',
    'WebhookEndpoint',
    'ApiKey',
    'SsoConfiguration',
    'OrgBilling',
    'BrandKit',
    // Marketing studio — must drop jobs + events before connections (FK).
    'ContentGenerationJob',
    'ProviderWebhookEvent',
    'ProviderConnection',
    'User',
    'Org',
    'Address',
    'DoNotKnock',
    'DoNotCall',
    'PiiUnmaskRequest',
    'NotificationLog',
  ];
  const list = tables.map((t) => `"${t}"`).join(', ');
  await prisma().$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);

  // Redis carries per-test ephemeral state that TRUNCATE does not touch. The
  // SAML single-use assertion-replay cache (`saml:used-assertion:<id>`) keys on
  // a hash of the SAMLResponse; tests that reuse the same fixture string ('seam')
  // would otherwise see a replay-rejection from a prior test in the same run.
  // Clear those keys so each test's first ACS consume is genuinely "first use".
  await flushTestRedisKeys('saml:used-assertion:*');
}

/** Delete keys matching a glob via SCAN (non-blocking, never KEYS in a shared DB). */
async function flushTestRedisKeys(pattern: string): Promise<void> {
  const client = redis();
  let cursor = '0';
  do {
    const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = next;
    if (keys.length > 0) await client.del(...keys);
  } while (cursor !== '0');
}

export async function teardown(): Promise<void> {
  await shutdownDb();
  // NOTE: do NOT shutdownRedis() here. Under the integration runner (forks,
  // singleFork) every test file shares one process, so the Redis singleton is
  // shared across files. ioredis does not auto-reconnect after quit(), so
  // quitting in one file's afterAll would dead-connection every later file.
  // The connection is reclaimed when the process exits at end of run.
}
