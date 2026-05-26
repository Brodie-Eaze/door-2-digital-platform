/**
 * Server-side session helper for App Router server components.
 *
 * Reads the `d2d_at` cookie and decodes the JWT payload WITHOUT verifying
 * its signature — the actual cryptographic check happens server-side in
 * the API (`verifyAccessToken`) on every authenticated request.
 *
 * Why no verify here?
 *   - The Next.js middleware already redirects on missing cookie.
 *   - The API rejects forged tokens — `getSession` can't be used to
 *     authorize anything sensitive; it only feeds the topbar avatar /
 *     greeting. Even if a hostile user crafted a cookie, the API would
 *     500 their first real request.
 *
 * The session also supports the Phase-0 SYNTHETIC demo cookie issued by
 * the /api/session/demo route when NEXT_PUBLIC_API_URL is unset. Those
 * tokens have signature "demo" and a base64url-decoded payload — same
 * shape decoder works for both.
 */
import { cookies } from 'next/headers';

export interface Session {
  userId: string;
  orgId: string | null;
  email: string;
  role: string;
  initials: string;
  givenName: string;
  /** True when the session came from the synthetic demo bypass (NEXT_PUBLIC_API_URL unset). */
  demo: boolean;
}

/**
 * Base64url decode, handles the URL-safe alphabet + padding.
 */
function b64urlDecode(s: string): string {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf-8');
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

export async function getSession(): Promise<Session | null> {
  const token = cookies().get('d2d_at')?.value;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]!)) as {
      sub?: string;
      orgId?: string;
      email?: string;
      role?: string;
      givenName?: string;
    };
    const email = payload.email ?? '';
    const givenName = payload.givenName ?? '';
    return {
      userId: payload.sub ?? '',
      orgId: payload.orgId ?? null,
      email,
      role: payload.role ?? 'viewer',
      givenName: givenName || email.split('@')[0] || 'User',
      initials: initialsFor(email, givenName),
      demo: parts[2] === 'demo',
    };
  } catch {
    return null;
  }
}
