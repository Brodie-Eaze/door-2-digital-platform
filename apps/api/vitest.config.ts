import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest config — runs unit + integration tests.
 *
 * The integration tests boot an in-process Fastify app via inject() so we
 * never bind a port. They use a separate Postgres DB (`d2d_test`) seeded
 * with the migrated schema; teardown wipes mutable rows between suites.
 */

/**
 * Resolve a workspace package's source entry RELATIVE to this config file so
 * the aliases work in any checkout (CI's `/home/runner/...`, a teammate's
 * machine), not just one absolute path. apps/api → ../../packages/<name>.
 */
const pkg = (name: string): string =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/integration/**'],
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
