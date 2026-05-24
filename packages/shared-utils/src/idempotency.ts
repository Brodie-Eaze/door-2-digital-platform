/**
 * Idempotency — per ADR-0010, every POST mutation MUST accept an
 * `Idempotency-Key` header. The key is hashed with the request body
 * and persisted; replays return the original response.
 *
 * Storage: `IdempotencyRecord` row in Postgres with 24h TTL.
 *
 * This module ships the helpers; the Fastify hook lives in
 * `apps/api/src/shared/middleware/idempotency.middleware.ts`.
 */
import { createHash } from 'node:crypto';

export interface IdempotencyRecord {
  key: string;
  orgId: string;
  method: string;
  path: string;
  bodyHash: string;
  responseStatus: number;
  responseBodyKey: string; // S3 key (large payloads not in PG)
  expiresAt: Date;
}

/** Hash the request body for idempotency-key matching. */
export function hashRequestBody(body: unknown): string {
  const canonical = canonicalize(body);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Canonical JSON — stable key ordering so equivalent bodies hash to the
 * same value even if serialization differs.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * Validate format of an Idempotency-Key header. Accepts opaque strings
 * 8–64 chars. Clients commonly send ULIDs or UUIDs.
 */
export function isValidIdempotencyKey(key: string): boolean {
  return typeof key === 'string' && key.length >= 8 && key.length <= 64 && /^[\w.-]+$/.test(key);
}

/**
 * Default TTL for stored idempotency records: 24 hours.
 * Long enough to cover client retries; short enough to bound storage.
 */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function computeExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
}
