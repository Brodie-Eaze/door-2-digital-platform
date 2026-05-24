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
