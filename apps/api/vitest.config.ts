import { defineConfig } from 'vitest/config';

/**
 * Vitest config — runs unit + integration tests.
 *
 * The integration tests boot an in-process Fastify app via inject() so we
 * never bind a port. They use a separate Postgres DB (`d2d_test`) seeded
 * with the migrated schema; teardown wipes mutable rows between suites.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
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
      '@d2d/shared-types': '/Users/Brodie/D2D/d2d-platform/packages/shared-types/src/index.ts',
      '@d2d/shared-utils': '/Users/Brodie/D2D/d2d-platform/packages/shared-utils/src/index.ts',
      '@d2d/integrations': '/Users/Brodie/D2D/d2d-platform/packages/integrations/src/index.ts',
    },
  },
});
