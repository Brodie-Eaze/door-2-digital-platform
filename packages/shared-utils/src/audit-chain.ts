/**
 * Audit hash-chain — per ADR-0008, every audit row carries `prevHash` +
 * `rowHash` so the entire chain can be replayed to prove no row was
 * inserted, edited, or deleted out of band.
 *
 * Weekly Merkle root committed to docs/audits/merkle-roots/<region>/<year>-W<NN>.json
 * provides a public tamper-evident anchor.
 */
import { hmacSha256 } from './hash';

export interface AuditEventForHash {
  id: string;
  orgId?: string | null;
  regionCode: string;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: unknown;
  occurredAt: string; // ISO-8601 UTC
}

/**
 * Compute the canonical input string for a row's hash. Used by both the
 * writer (when inserting a new row) and the verifier (when replaying).
 *
 * Canonicalisation: stable JSON key order; ISO timestamps; null over undef.
 */
export function canonicalizeAuditRow(e: AuditEventForHash): string {
  const norm = {
    id: e.id,
    orgId: e.orgId ?? null,
    regionCode: e.regionCode,
    actorUserId: e.actorUserId ?? null,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    beforeJson: e.beforeJson ?? null,
    afterJson: e.afterJson ?? null,
    metadata: e.metadata ?? null,
    occurredAt: e.occurredAt,
  };
  return canonicalJson(norm);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

/**
 * Compute a row's hash given the prior row's hash and an HMAC secret
 * (rotated quarterly, stored in AWS Secrets Manager).
 *
 * Genesis row uses prevHash = 'GENESIS'.
 */
export function computeRowHash(
  prevHash: string,
  event: AuditEventForHash,
  hmacSecret: string,
): string {
  const message = `${prevHash}|${canonicalizeAuditRow(event)}`;
  return hmacSha256(hmacSecret, message);
}

export const GENESIS_PREV_HASH = 'GENESIS';

/**
 * Verify a contiguous chain segment.
 *
 * Returns the first row index where the computed hash does not match the
 * stored rowHash — or null if the chain is intact.
 */
export function verifyChain(
  rows: Array<AuditEventForHash & { prevHash: string; rowHash: string }>,
  hmacSecret: string,
): { ok: true } | { ok: false; firstBadIndex: number } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const expected = computeRowHash(row.prevHash, row, hmacSecret);
    if (expected !== row.rowHash) {
      return { ok: false, firstBadIndex: i };
    }
  }
  return { ok: true };
}
