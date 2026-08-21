import { defineConfig } from 'vitest/config';

/**
 * Without an explicit exclude, vitest's default include glob crawls
 * .next/standalone — a build artifact containing a stale full copy of
 * apps/api INCLUDING its test files, which then run (and fail) against the
 * wrong environment. Only src/ tests are ours.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    environment: 'node',
  },
});
