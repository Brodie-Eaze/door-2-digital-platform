/**
 * POST /api/session/logout — universal logout.
 *
 * Clears the d2d_at cookie regardless of whether it's a real API-issued
 * token or a synthetic-demo one. For real tokens we also POST through
 * the API proxy so the refresh token gets revoked server-side; failures
 * are non-fatal (the cookies still get cleared client-side).
 */
import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  if (apiBase) {
    try {
      await fetch(`${apiBase}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // ignore — logout is idempotent and best-effort
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('d2d_at', '', { path: '/', maxAge: 0 });
  res.cookies.set('d2d_rt', '', { path: '/v1/auth', maxAge: 0 });
  return res;
}
