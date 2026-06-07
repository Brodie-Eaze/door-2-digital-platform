/**
 * Server-side session helper for App Router server components + BFF route
 * handlers.
 *
 * SECURITY (SEC / D1): `getSession` now cryptographically verifies the
 * `d2d_at` cookie (HMAC-SHA256, constant-time) BEFORE trusting any claim — a
 * prior version trusted the decoded `role`/`orgId` with no signature check, so
 * any client could forge a super_admin cookie and read every tenant's PII via
 * the BFF. The pure verifier lives in ./session-verify (no next/headers import
 * so it is unit-testable); this module only binds it to the request cookie.
 *
 * This module is Node-runtime only (uses node:crypto via session-verify).
 * Every route/handler that imports it runs with `export const runtime =
 * 'nodejs'`.
 */
import { cookies } from 'next/headers';
import { verifySessionToken, sessionSigningSecret, type AccessClaims } from '@/lib/session-verify';

// Re-export the pure verifier surface so existing importers
// (`@/lib/session`) keep working unchanged.
export { verifySessionToken, sessionSigningSecret } from '@/lib/session-verify';
export type { AccessClaims } from '@/lib/session-verify';

export interface Session {
  userId: string;
  orgId: string | null;
  email: string;
  role: string;
  initials: string;
  givenName: string;
  /** True when the session is a dev/preview synthetic-demo token. */
  demo: boolean;
}

function initialsFor(email: string, givenName?: string): string {
  if (givenName && givenName.length >= 2) return givenName.slice(0, 2).toUpperCase();
  const local = email.split('@')[0] ?? '';
  if (local.includes('.')) {
    const [a, b] = local.split('.');
    return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || '??';
  }
  return (local.slice(0, 2) || '??').toUpperCase();
}

/**
 * Map verified claims onto the Session view-model used by the topbar + BFF.
 */
function sessionFromClaims(claims: AccessClaims): Session {
  const email = typeof claims.email === 'string' ? claims.email : '';
  const givenName = typeof claims.givenName === 'string' ? claims.givenName : '';
  return {
    userId: claims.sub,
    orgId: typeof claims.orgId === 'string' && claims.orgId.length > 0 ? claims.orgId : null,
    email,
    role: claims.role,
    givenName: givenName || email.split('@')[0] || 'User',
    initials: initialsFor(email, givenName),
    demo: claims.demo === true,
  };
}

/**
 * Resolve the current request's session from the `d2d_at` cookie. Returns the
 * Session ONLY when the cookie cryptographically verifies; otherwise null.
 */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get('d2d_at')?.value;
  const claims = verifySessionToken(token, sessionSigningSecret());
  if (!claims) return null;
  return sessionFromClaims(claims);
}
