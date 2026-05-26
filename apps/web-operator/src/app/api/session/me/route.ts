/**
 * GET /api/session/me — same-origin session info for client components.
 *
 * Server components use `getSession()` directly. Client components
 * (`PlatformShell`, `AccountShell`) hit this route to populate the topbar
 * avatar/greeting without round-tripping through the API.
 *
 * Returns 401 if no cookie is present; the client treats that as "show
 * the login link" rather than redirecting (the middleware already handles
 * full redirects).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        type: 'https://docs.d2d.io/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
      },
      { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }
  return NextResponse.json({ session });
}
