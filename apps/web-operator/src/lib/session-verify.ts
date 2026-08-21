/**
 * Pure (framework-free) cryptographic verification for the `d2d_at` session
 * cookie. Kept separate from session.ts so it imports NO Next.js runtime
 * modules (next/headers) and can be unit-tested directly under the Node test
 * pool.
 *
 * SECURITY (SEC / D1): the `d2d_at` cookie is a hand-rolled HS256 JWT issued
 * by the API (`signAccessToken`, JWT_ACCESS_SECRET) — or, in dev/preview, by
 * the synthetic /api/session/demo route signed with the SAME secret. We MUST
 * cryptographically verify the HMAC signature with a constant-time compare
 * BEFORE trusting a single claim. A prior version decoded the payload and
 * trusted `role`/`orgId` with NO signature check, so any client could forge a
 * super_admin cookie and read every tenant's PII via the BFF.
 *
 * Verification mirrors apps/api/src/domains/auth/tokens.ts#verifyAccessToken
 * byte-for-byte so a token minted by the API verifies here identically.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Raw verified JWT claims. `email`/`givenName` are vanity-only and never used
 * for authorization — authz keys off `role` + `orgId`.
 */
export interface AccessClaims {
  sub: string;
  orgId?: string | null;
  role: string;
  email?: string;
  givenName?: string;
  iat?: number;
  exp: number;
  /** Set only by the dev synthetic-demo issuer. */
  demo?: boolean;
}

/**
 * Resolve the signing secret. Reuses the platform's JWT access secret so a
 * real API-issued token verifies without any new key material. Returns null
 * (fail-closed) when unset/too-short so getSession refuses every cookie rather
 * than verifying against a weak/empty key.
 *
 * Read inside a function (not a module const) so secret rotation + per-request
 * env injection in tests work without reload.
 */
export function sessionSigningSecret(): string | null {
  const secret = process.env.JWT_ACCESS_SECRET ?? process.env.SESSION_COOKIE_SECRET;
  // Mirror apps/api env validation (z.string().min(32)). A short/empty secret
  // is treated as "no secret" → every cookie is rejected.
  if (!secret || secret.length < 32) return null;
  return secret;
}

/**
 * SECURITY (SEC / D5): is the synthetic-demo login route allowed to run?
 *
 * Dead in production (NODE_ENV === 'production') — the route returns 404 so
 * its existence is never advertised. Additionally requires an explicit
 * DEMO_MODE_ENABLED=true opt-in (defaults OFF) so a misconfigured non-prod
 * preview can't accidentally expose hardcoded super-admin credentials.
 *
 * Also disabled when NEXT_PUBLIC_API_URL is set: that env var means a real
 * API is wired to this web-operator instance, so issuing synthetic demo tokens
 * makes no sense and could confuse the auth flow (F-010 defense-in-depth).
 *
 * Pure + env-driven so it is unit-testable without importing next/server.
 */
export function isDemoLoginEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  // If a real API is wired, never enable the synthetic-demo path regardless
  // of the DEMO_MODE_ENABLED flag — a real API won't accept demo tokens.
  if (process.env.NEXT_PUBLIC_API_URL) return false;
  return process.env.DEMO_MODE_ENABLED === 'true';
}

/**
 * Base64url decode (URL-safe alphabet + padding restored).
 */
function b64urlDecode(s: string): Buffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

/**
 * Cryptographically verify a `d2d_at` token and return its claims, or null if
 * the token is malformed, unsigned, tampered, expired, or signed with a
 * different secret. Pure + deterministic — unit-tested directly.
 *
 * @param token  the raw cookie value
 * @param secret the HMAC-SHA256 signing secret (>= 32 chars; see
 *               sessionSigningSecret). When null, ALL tokens are rejected.
 */
export function verifySessionToken(
  token: string | undefined | null,
  secret: string | null,
): AccessClaims | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts as [string, string, string];

  // 1) Constant-time HMAC signature check. Any forged/unsigned cookie (e.g.
  //    the legacy synthetic signature literal "demo") fails here.
  const expectedSig = createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest();
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (expectedSig.length !== providedSig.length) return null;
  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  // 2) Parse + shape-validate the body (only after the signature passed).
  let claims: AccessClaims;
  try {
    claims = JSON.parse(b64urlDecode(bodyB64).toString('utf-8')) as AccessClaims;
  } catch {
    return null;
  }
  if (typeof claims.sub !== 'string' || typeof claims.role !== 'string') return null;
  if (typeof claims.exp !== 'number') return null;

  // 3) Reject expired tokens.
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return null;

  return claims;
}
