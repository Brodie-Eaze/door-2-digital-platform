/**
 * JWT (HS256) — hand-rolled with node:crypto. No new dependencies.
 *
 * Access token: 5-minute TTL, signed with JWT_ACCESS_SECRET.
 * Refresh token: 30-day opaque random string, hashed (SHA-256) in DB.
 *
 * Token payload:
 *   { sub: userId, orgId, role, regionCode, brandCode, iat, exp }
 */
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string; // userId
  orgId: string;
  role: string;
  regionCode: string;
  brandCode: string;
  /**
   * Optional vanity claim used by the browser topbar — NOT used for authz.
   * SEC-005: email was removed from this type; it is PII and must not be
   * embedded in tokens where it can appear in logs and reverse proxies.
   * The topbar fetches user data from /api/session/me on mount.
   */
  givenName?: string;
  iat: number;
  exp: number;
  /**
   * Set only by the synthetic-demo issuer (apps/web-operator/api/session/demo).
   * The API's requireAuth rejects any token carrying this claim so a demo-minted
   * cookie can never be used as a real session against the API.
   */
  demo?: boolean;
}

export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60; // 5 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str: string): Buffer {
  // Pad back to multiple of 4 if needed.
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

/**
 * Sign an access token. Payload `exp`/`iat` set automatically.
 */
export function signAccessToken(
  partial: Omit<AccessTokenPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds: number = ACCESS_TOKEN_TTL_SECONDS,
): { token: string; payload: AccessTokenPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    ...partial,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return { token: `${header}.${body}.${signature}`, payload };
}

/**
 * Verify an access token. Returns the payload, or throws Error.
 *
 * Errors are intentionally generic ('Invalid token' / 'Token expired') so
 * we don't leak whether the secret or signature is wrong vs the body shape.
 */
/** The ONLY algorithm we sign or accept. Pinned to defeat alg-confusion /
 * `alg:none` forgeries (SEC-009 / CC8-009). */
const ALLOWED_JWT_ALG = 'HS256' as const;
const EXPECTED_JWT_TYP = 'JWT' as const;

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [headerB64, bodyB64, sigB64] = parts as [string, string, string];

  // SEC-009: pin the algorithm BEFORE trusting the token. We hand-roll HMAC so
  // we never delegate `alg` to a library (no library-side alg-confusion), but
  // we still reject any token whose header advertises something other than the
  // exact `{ alg: HS256, typ: JWT }` we sign — defence-in-depth and an explicit,
  // auditable claim assertion rather than an implicit one.
  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(base64urlDecode(headerB64).toString('utf-8')) as typeof header;
  } catch {
    throw new Error('Invalid token header');
  }
  if (header.alg !== ALLOWED_JWT_ALG) throw new Error('Invalid token algorithm');
  if (header.typ !== EXPECTED_JWT_TYP) throw new Error('Invalid token type');

  // Verify signature.
  const expectedSig = createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest();
  const providedSig = base64urlDecode(sigB64);
  if (expectedSig.length !== providedSig.length) throw new Error('Invalid token');
  if (!timingSafeEqual(expectedSig, providedSig)) throw new Error('Invalid token');

  // Parse + validate body.
  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(base64urlDecode(bodyB64).toString('utf-8')) as AccessTokenPayload;
  } catch {
    throw new Error('Invalid token payload');
  }
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.orgId !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.iat !== 'number'
  ) {
    throw new Error('Invalid token payload');
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error('Token expired');
  return payload;
}

/**
 * Generate an opaque refresh token. 256 bits of entropy, base64url-encoded.
 * Caller stores only the SHA-256 hash; the plaintext is sent to the client.
 */
export function generateRefreshToken(): { plaintext: string; hash: string } {
  const buf = randomBytes(32);
  const plaintext = base64url(buf);
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

/**
 * Hash a refresh token presented by the client so we can look it up.
 */
export function hashRefreshToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Generate an opaque invite token (longer + URL-safe).
 */
export function generateInviteToken(): { plaintext: string; hash: string } {
  const buf = randomBytes(24);
  const plaintext = base64url(buf);
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

/**
 * Normalise a raw User-Agent string to a coarse browser-family label for
 * storage (SEC-012 — PII minimisation). The full UA string is a fingerprinting
 * vector; we retain only enough to be operationally useful (browser family +
 * major version) without persisting a device fingerprint.
 *
 * Examples:
 *   "Mozilla/5.0 … Chrome/124.0.0.0 …"  → "Chrome/124"
 *   "Mozilla/5.0 … Firefox/125.0 …"      → "Firefox/125"
 *   "Mozilla/5.0 … Safari/… Version/17…" → "Safari/17"
 *   "okhttp/4.12.0"                       → "okhttp/4"
 *   anything else / missing               → "other"
 */
export function normalizeUserAgent(ua: string | undefined | null): string {
  if (!ua) return 'other';
  // Edge — must match before Chrome (Chromium-based; reports both tokens).
  const edgeMatch = /\bEdg\/(\d+)/.exec(ua);
  if (edgeMatch) return `Edge/${edgeMatch[1]}`;
  // Chrome / Chromium.
  const chromeMatch = /\bChrome\/(\d+)/.exec(ua);
  if (chromeMatch) return `Chrome/${chromeMatch[1]}`;
  // Firefox.
  const ffMatch = /\bFirefox\/(\d+)/.exec(ua);
  if (ffMatch) return `Firefox/${ffMatch[1]}`;
  // Safari — Version/N is the human-readable version; present on WebKit browsers.
  const safariVersionMatch = /\bVersion\/(\d+).*Safari\//.exec(ua);
  if (safariVersionMatch) return `Safari/${safariVersionMatch[1]}`;
  const safariMatch = /\bSafari\/(\d+)/.exec(ua);
  if (safariMatch) return `Safari/${safariMatch[1]}`;
  // Generic HTTP clients / mobile SDKs — keep name + major version only.
  const genericMatch = /^([A-Za-z][A-Za-z0-9._-]{0,39})\/(\d+)/.exec(ua.trimStart());
  if (genericMatch) return `${genericMatch[1]}/${genericMatch[2]}`;
  return 'other';
}
