/**
 * Idempotency middleware — every POST mutation MUST provide an
 * Idempotency-Key header. Replays return the stored response.
 *
 * Per ADR-0010. Storage in IdempotencyRecord table with 24h TTL.
 *
 * Phase 0 stub — full implementation in Phase 1.1 once auth lands.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Problems, ProblemError, isValidIdempotencyKey } from '@d2d/shared-utils';

/**
 * Validate Idempotency-Key header presence + format. To be called from
 * controllers handling POST mutations. Storage + replay-handling lives
 * in idempotency-store.ts (Phase 1.1).
 */
export function requireIdempotencyKey(req: FastifyRequest): string {
  const k = req.headers['idempotency-key'];
  if (typeof k !== 'string' || !isValidIdempotencyKey(k)) {
    throw new ProblemError(
      Problems.validation('Idempotency-Key header required (8–64 chars, [a-zA-Z0-9._-])'),
    );
  }
  return k;
}

// Phase 1.1 TODO:
// - loadIdempotencyRecord(orgId, key) → IdempotencyRecord | null
// - storeIdempotencyRecord(orgId, key, request, response)
// - on replay: assert bodyHash matches; return stored response
