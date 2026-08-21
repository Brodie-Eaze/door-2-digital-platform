/**
 * Health probes — /v1/healthz (liveness) and /v1/readyz (readiness).
 *
 * Liveness: process is alive (no DB / Redis check).
 * Readiness: DB connected, Redis reachable.
 *
 * Both are unauthenticated and excluded from rate limiting.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../config/db';
import { redis } from '../config/redis';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/healthz', { config: { rateLimit: false } }, async (req) => {
    // xffCount: how many entries the edge put in X-Forwarded-For — used once
    // to calibrate TRUST_PROXY_HOPS for this deployment, then ignorable.
    const xff = req.headers['x-forwarded-for'];
    const xffCount =
      typeof xff === 'string' ? xff.split(',').length : Array.isArray(xff) ? xff.length : 0;
    return {
      status: 'ok',
      service: 'd2d-api',
      version: process.env.npm_package_version ?? '0.1.0',
      observedIp: req.ip,
      xffCount,
    };
  });

  app.get('/v1/readyz', { config: { rateLimit: false } }, async (_req, reply) => {
    const checks: Record<string, 'ok' | string> = {};
    try {
      await prisma().$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch (err) {
      checks.db = err instanceof Error ? err.message : 'fail';
    }
    try {
      await redis().ping();
      checks.redis = 'ok';
    } catch (err) {
      checks.redis = err instanceof Error ? err.message : 'fail';
    }
    const ok = Object.values(checks).every((v) => v === 'ok');
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ready' : 'degraded', checks });
  });
}
