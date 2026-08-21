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
 *
 * LAZY: constructed on first property access, not at import. `next build`
 * imports every route module during page-data collection in an environment
 * with no DATABASE_URL (Docker image builds) — an import-time throw fails
 * the build even for force-dynamic routes. First real query still fails
 * fast with the same clear error.
 */
function getClient(): PrismaClient {
  if (!globalThis.__d2dPrisma) {
    globalThis.__d2dPrisma = makeClient();
  }
  return globalThis.__d2dPrisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// Re-export Prisma so consumers don't need to take a second dep on
// @prisma/client. (`Prisma.TransactionClient`, `Prisma.InputJsonValue`,
// the runtime errors, etc.)
export { Prisma, PrismaClient };
