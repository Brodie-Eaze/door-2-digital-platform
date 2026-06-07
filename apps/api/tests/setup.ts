/**
 * Vitest setup — loads .env then validates env vars.
 *
 * Forces DATABASE_URL to the local d2d_test DB. NODE_ENV is set to 'test'
 * and the logger is quieted so test output stays readable.
 *
 * We use a hand-rolled `.env` parser instead of pulling in `dotenv` —
 * no new dependencies per the agent's brief.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv(resolve(__dirname, '..', '.env'));
loadEnv(resolve(__dirname, '..', '.env.test'));

// Force test DB unless the caller already pointed us at one.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('d2d_test')) {
  process.env.DATABASE_URL = 'postgresql://d2d:d2d@localhost:5432/d2d_test?schema=public';
}
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

/**
 * CI fallbacks — satisfy the Zod env schema in the unit-test job where no
 * .env.test file exists and no real infrastructure is running. Only applied
 * when a variable is not already set by the environment or a real .env.test.
 * These are not real credentials and are never used outside of unit tests.
 */
const UNIT_TEST_FALLBACKS: Record<string, string> = {
  REDIS_URL: 'redis://localhost:6379',
  // PII vault — hex 64 chars (32 bytes)
  PII_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000001',
  PII_HASH_SECRET: 'unit-test-pii-hash-secret-min32xx',
  PII_SEARCH_KEY: 'unit-test-pii-search-key-min32xxx',
  AUDIT_CHAIN_SECRET: 'unit-test-audit-chain-secret-32xx',
  // base64-encoded 32 zero-bytes (44 chars, satisfies min(40))
  PII_KMS_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // gitleaks:allow
  PII_SIV_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // gitleaks:allow
  // Auth secrets — min 32 chars each
  JWT_ACCESS_SECRET: 'unit-test-jwt-access-secret-32xxx',
  JWT_REFRESH_SECRET: 'unit-test-jwt-refresh-secret-32xx',
  JWT_WS_TICKET_SECRET: 'unit-test-jwt-ws-ticket-secret-32',
  CSRF_SIGNING_SECRET: 'unit-test-csrf-signing-secret-32x',
  OAUTH_STATE_SECRET: 'unit-test-oauth-state-secret-32xx',
  MFA_STEP_UP_SECRET: 'unit-test-mfa-step-up-secret-32xx',
  API_TOKEN_HASH_SECRET: 'unit-test-api-token-hash-secret-x',
  // S3 bucket names (any non-empty string)
  S3_BUCKET_AUDIT: 'unit-test-audit',
  S3_BUCKET_ASSETS: 'unit-test-assets',
  S3_BUCKET_EXPORTS: 'unit-test-exports',
};

for (const [key, val] of Object.entries(UNIT_TEST_FALLBACKS)) {
  if (!process.env[key]) {
    process.env[key] = val;
  }
}
