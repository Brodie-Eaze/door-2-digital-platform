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
import { registerAuth } from './domains/auth/routes';
import { registerOrg } from './domains/org/routes';

async function buildServer() {
  const e = env();
  const log = logger();

  // Cold-start dependencies so we fail fast if misconfigured.
  prisma();
  redis();

  const app = Fastify({
    logger: log,
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1 MB default; knock-batch route bumps to 10 MB
    genReqId: () => {
      // Use ULID for correlation ID — sortable + 26 chars
      // ULID generator imported from shared-utils on first use
      // (lazy import to keep build chain happy when Prisma generates)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { newId } = require('@d2d/shared-utils/ulid');
      return newId('req');
    },
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
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

  // Rate limiter — tiered buckets per (IP, API key, user)
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    redis: redis(),
    keyGenerator: (req) => {
      // Prefer per-API-key bucket if present
      const apiKey = req.headers['x-api-key'];
      if (typeof apiKey === 'string') return `key:${apiKey}`;
      return `ip:${req.ip}`;
    },
  });

  await app.register(sensible);

  // Correlation ID echoed on every response
  await app.register(registerCorrelationId);

  // Unified RFC 7807 error handler
  app.setErrorHandler(errorHandler);

  // Health checks (unauthenticated)
  await registerHealthRoutes(app);

  // Domain routes — auth first, then everything else
  await app.register(registerAuth, { prefix: '/v1/auth' });
  await app.register(registerOrg, { prefix: '/v1/orgs' });
  // TODO Phase 1.1+: user, territory, knock, lead, conversion, donation,
  // sale, commission, payout, marketing, compliance, audit, webhook,
  // api-key, dsar routes here as each domain module lands.

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
  // Fastify logger reports the bound address.
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
