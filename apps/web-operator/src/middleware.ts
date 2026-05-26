/**
 * Next.js Edge middleware — auth wall for every operator route.
 *
 * Runs on the Edge runtime, which means no Node crypto. We only check
 * cookie PRESENCE + 3-part JWT shape here; cryptographic verification
 * happens server-side in the API on every authenticated request. The
 * threat model is: a forged or missing cookie redirects to /login;
 * a real cookie with a stale or tampered signature still passes through,
 * but every API call dies at the auth-guard and the proxy returns 401,
 * which the api-client converts to a refresh attempt → logout.
 *
 * Public allowlist covers:
 *   - /login  (the unlock surface itself)
 *   - /public/*  (marketing previews)
 *   - /creative-bank/*  (CSP-allowed image bank)
 *   - /proxy/*  (API rewrite — passes through to /v1/* on the API host)
 *   - /_next/*, /favicon.ico, /.well-known/*  (Next + browser internals)
 *   - /api/session/*  (synthetic-demo issue endpoint, see prod fallback)
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_EXACT = new Set<string>([
  '/login',
  '/healthz',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
]);

const PUBLIC_PREFIXES = [
  '/login/',
  '/public/',
  '/creative-bank/',
  '/proxy/',
  '/_next/',
  '/.well-known/',
  '/api/session/', // synthetic demo issue endpoint
  // BFF route handlers: auth is enforced inside each handler via
  // requireSession() returning RFC 7807 problem+json 401, NOT via a 307
  // redirect to /login. Programmatic callers (curl, the api-client) need a
  // structured body, not an HTML login page.
  '/api/orgs',
  // Health summary feeds the sidebar's "All systems operational" pill
  // and the AppShell trust footer. Polled from EVERY page (incl. public
  // marketing surfaces + the login screen) and intentionally has no PII
  // in its response, so it stays public.
  '/api/health-summary',
];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('d2d_at')?.value;
  if (!token || token.split('.').length !== 3) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', pathname + (req.nextUrl.search || ''));
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Match every route except the static asset files. Anything in
  // PUBLIC_EXACT / PUBLIC_PREFIXES short-circuits inside the handler.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
