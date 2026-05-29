import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Integration test config — CI "Integration tests" gate
 * (`pnpm --filter api test:integration`).
 *
 * Runs the DB-backed suite under tests/ against the `d2d_test` Postgres
 * service after migrations are applied (`prisma migrate deploy`). Mirrors the
 * base vitest config (forks pool so module-level singletons reset per file,
 * shared tests/setup.ts that pins DATABASE_URL to d2d_test). Kept standalone
 * and explicit rather than merged so the include glob is unambiguous — this
 * gate is the floor that the SEC-005 RLS isolation test runs under in CI.
 */

const pkg = (name: string): string =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks', // each file gets a fresh process — avoids module-level singletons
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@d2d/shared-types': pkg('shared-types'),
      '@d2d/shared-utils': pkg('shared-utils'),
      '@d2d/integrations': pkg('integrations'),
    },
  },
});
