/**
 * Prisma client singleton + tenant-scoped extension.
 *
 * The tenant-scoped client injects `where: { orgId }` on every query so
 * that even a developer mistake can't read across tenants. Postgres RLS
 * provides the second belt; this is the suspenders.
 */
import { PrismaClient } from '@prisma/client';
import { env } from './env';

let _prisma: PrismaClient | undefined;

export function prisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url: env().DATABASE_URL } },
      log:
        env().NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }
  return _prisma;
}

/**
 * Tenant-scoped Prisma — wraps the global client so every query is forced
 * to include `where: { orgId }`. Use this in every domain service.
 *
 * Phase 0 stub — full implementation in Phase 1.1.
 */
export function tenantPrisma(orgId: string): PrismaClient {
  // TODO Phase 1.1: use Prisma `$extends` to inject orgId scoping.
  // For Phase 0 we return the raw client; service code must pass orgId
  // explicitly. Cross-tenant probe CI test will fail until we wire $extends.
  void orgId;
  return prisma();
}

export async function shutdownDb(): Promise<void> {
  await _prisma?.$disconnect();
}
