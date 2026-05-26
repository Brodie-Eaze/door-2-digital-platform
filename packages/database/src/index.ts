/**
 * @d2d/database — single shared Prisma client.
 *
 * Why this package exists: more than one app in the workspace (Next.js
 * web-operator BFF route handlers + Fastify api + workers) needs to talk
 * to Postgres via Prisma. Each app instantiating its own PrismaClient
 * would (a) leak connections in dev under Next.js HMR, (b) duplicate the
 * URL-reading + logging boilerplate, and (c) make it harder to swap to
 * a read-replica or pooled URL later. This module owns the singleton.
 *
 * The Prisma schema itself remains at `apps/api/prisma/schema.prisma`
 * (single source of truth, where migrations live). `pnpm prisma generate`
 * run from apps/api writes the client into node_modules/@prisma/client,
 * which pnpm hoists so this package and every consumer resolve the same
 * generated types.
 *
 * Usage from a Next.js route handler:
 *
 *   import { db, ProblemError } from '@d2d/database';
 *   const orgs = await db.org.findMany({ where: { status: 'active' } });
 *
 * In dev under Next.js, the module is re-evaluated on every hot reload —
 * we cache the client on `globalThis` so the connection pool survives
 * HMR. This is the documented Prisma + Next.js pattern.
 */
import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __d2dPrisma: PrismaClient | undefined;
}

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      '[@d2d/database] DATABASE_URL is not set. ' +
        'Web-operator route handlers cannot reach Postgres without it. ' +
        'For local dev, copy apps/api/.env DATABASE_URL into apps/web-operator/.env.local. ' +
        'For Railway, set DATABASE_URL on the web-operator service env vars.',
    );
  }
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Shared Prisma client. Reuses the same instance across HMR reloads in
 * dev (otherwise the connection pool would grow without bound).
 */
export const db: PrismaClient = globalThis.__d2dPrisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__d2dPrisma = db;
}

// Re-export Prisma so consumers don't need to take a second dep on
// @prisma/client. (`Prisma.TransactionClient`, `Prisma.InputJsonValue`,
// the runtime errors, etc.)
export { Prisma, PrismaClient };
