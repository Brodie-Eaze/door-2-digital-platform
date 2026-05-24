/**
 * Hashing helpers — SHA-256 and HMAC-SHA-256 for audit chains, webhook
 * signatures, deterministic-SIV digests, address dedupe keys.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Constant-time HMAC verification for webhook signatures.
 * Prevents timing-attack disclosure of which byte differed.
 */
export function verifyHmac(secret: string, message: string, expectedHex: string): boolean {
  const computed = hmacSha256(secret, message);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Address dedupe hash — normalises an address tuple and produces a
 * stable SHA-256 hex. Used for `Address.hashKey` uniqueness.
 */
export function addressHash(input: {
  street: string;
  unit?: string;
  locality: string;
  region: string;
  postcode: string;
  countryCode: string;
}): string {
  const norm = [
    input.unit?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '',
    input.street.toLowerCase().replace(/\s+/g, ' ').trim(),
    input.locality.toLowerCase().trim(),
    input.region.toUpperCase().trim(),
    input.postcode.toLowerCase().replace(/\s+/g, '').trim(),
    input.countryCode.toUpperCase().trim(),
  ].join('|');
  return sha256(norm);
}

/**
 * Deterministic phone digest — strips formatting, returns SHA-256 of
 * E.164. Used for `User.phoneDigest`, `Lead.phoneDigest` unique lookups.
 *
 * Requires a per-region search key as salt — without it, phone hashes
 * across orgs would collide and leak presence-of-lead across tenants.
 */
export function phoneDigest(e164: string, searchKey: string): string {
  const norm = e164.replace(/[^\d+]/g, '');
  return hmacSha256(searchKey, norm);
}

export function emailDigest(email: string, searchKey: string): string {
  const norm = email.trim().toLowerCase();
  return hmacSha256(searchKey, norm);
}
