/**
 * Signed SAML RelayState — CSRF / replay defence for the SP-initiated flow.
 *
 * We mint a RelayState at /sso/:slug/start and verify it at the ACS callback.
 * It binds the round-trip to the org slug and carries an issued-at timestamp
 * so a stale or forged RelayState is rejected. HMAC-signed with the existing
 * OAUTH_STATE_SECRET (ADR: no new secret for this).
 *
 * Note: this is a stateless signature, not server-side single-use. For full
 * replay protection on the SAMLResponse itself, production should add a Redis
 * InResponseTo cache (flagged as a follow-up).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { env } from '../../../config/env';

/** RelayState older than this is rejected at the ACS. */
export const RELAY_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface RelayStatePayload {
  slug: string;
  nonce: string;
  iat: number;
}

function sign(payloadB64: string): string {
  return createHmac('sha256', env().OAUTH_STATE_SECRET).update(payloadB64).digest('hex');
}

/** Produce an opaque, signed RelayState string for the given org slug. */
export function signRelayState(slug: string): string {
  const payload: RelayStatePayload = {
    slug,
    nonce: randomBytes(12).toString('hex'),
    iat: Date.now(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify a RelayState: signature must match (constant-time), structure must
 * parse, and it must be within the freshness window. Returns the bound slug.
 * Throws on any failure — the caller maps that to a 403.
 */
export function verifyRelayState(relayState: string): { slug: string } {
  const parts = relayState.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed RelayState');
  }
  const payloadB64 = parts[0];
  const providedSig = parts[1];
  if (!payloadB64 || !providedSig) {
    throw new Error('Malformed RelayState');
  }

  const expectedSig = sign(payloadB64);
  // SEC-009: decode both signatures from hex to raw binary Buffers BEFORE
  // comparing. Comparing UTF-8 hex strings with timingSafeEqual is correct
  // only if both strings are exactly the same byte-length, but a crafted
  // input that is NOT valid hex can produce a Buffer of different length
  // because Buffer.from(str) (default 'utf-8') does not validate hex pairs.
  // Decoding via 'hex' enforces canonical length (SHA-256 = 32 bytes) and
  // eliminates any character-encoding variation that could leak timing
  // information through the length guard.
  const SHA256_BYTE_LEN = 32;
  const aBuf = Buffer.from(providedSig, 'hex');
  const bBuf = Buffer.from(expectedSig, 'hex');
  if (aBuf.length !== SHA256_BYTE_LEN || bBuf.length !== SHA256_BYTE_LEN) {
    throw new Error('RelayState signature mismatch');
  }
  if (!timingSafeEqual(aBuf, bBuf)) {
    throw new Error('RelayState signature mismatch');
  }

  let payload: RelayStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as RelayStatePayload;
  } catch {
    throw new Error('RelayState payload corrupt');
  }

  if (typeof payload.slug !== 'string' || typeof payload.iat !== 'number') {
    throw new Error('RelayState payload invalid');
  }
  if (Date.now() - payload.iat > RELAY_STATE_MAX_AGE_MS) {
    throw new Error('RelayState expired');
  }

  return { slug: payload.slug };
}
