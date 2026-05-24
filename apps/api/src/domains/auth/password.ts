/**
 * Password hashing using node:crypto scrypt.
 *
 * Format: `${saltHex}:${hashHex}` (32-byte salt, 64-byte derived key).
 * No new dependencies — built-in node:crypto only.
 *
 * Cost parameters chosen per OWASP 2023 guidance for scrypt:
 *   N (cost)    = 2^15 (32_768)  → ~100ms on modern hardware
 *   r (blkSize) = 8
 *   p (parallel)= 1
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const COST = 1 << 15; // 32_768
const BLOCK_SIZE = 8;
const PARALLEL = 1;
// scrypt requires maxmem >= 128 * N * r ≈ 33 MB at our params. Give it headroom.
const MAX_MEM = 64 * 1024 * 1024;

function scryptP(password: string | Buffer, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keylen,
      { N: COST, r: BLOCK_SIZE, p: PARALLEL, maxmem: MAX_MEM },
      (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      },
    );
  });
}

/**
 * Hash a plaintext password. Returns `${saltHex}:${derivedKeyHex}`.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptP(plaintext, salt, KEY_BYTES);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored `salt:hash` digest.
 * Constant-time comparison to prevent timing-attack disclosure.
 */
export async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = await scryptP(plaintext, salt, expected.length);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
