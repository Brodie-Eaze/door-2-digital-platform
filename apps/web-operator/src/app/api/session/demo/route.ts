/**
 * POST /api/session/demo — synthetic-demo session issuer (DEV/PREVIEW ONLY).
 *
 * Phase-0 demo accommodation: when `NEXT_PUBLIC_API_URL` is unset (typical
 * for a preview web service that ships without the API), the /login page
 * falls back to issuing a synthetic d2d_at cookie via this route.
 *
 * SECURITY (SEC / D5): this route mints a super_admin/org_admin session from
 * credentials HARDCODED in source. It is therefore HARD-DISABLED in
 * production: when NODE_ENV === 'production' it returns 404 (we 404, not 403,
 * so the endpoint's existence is never advertised) BEFORE any work. It is
 * additionally gated on DEMO_MODE_ENABLED, which defaults OFF — set it to
 * 'true' explicitly in a dev/preview env to enable the demo chips.
 *
 * SECURITY (SEC / D1): the synthetic token is now signed with the platform's
 * JWT_ACCESS_SECRET (the same HS256 secret real tokens use) via the shared
 * `signAccessToken`, so it cryptographically verifies in getSession. Without
 * a configured secret (or in prod) the route is dead and no cookie is minted.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { isDemoLoginEnabled, sessionSigningSecret } from '@/lib/session-verify';

// Prisma-free, but node:crypto is used → force Node runtime (not Edge).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DemoAccount {
  sub: string;
  email: string;
  orgId: string;
  role: 'super_admin' | 'org_admin';
  givenName: string;
  password: string;
}

const DEMO_TABLE: DemoAccount[] = [
  {
    sub: 'usr_demo_brodie',
    email: 'brodie@door2digital.com',
    orgId: 'org_demo_platform',
    role: 'super_admin',
    givenName: 'Brodie',
    password: 'D2D-Demo-2026!',
  },
  {
    sub: 'usr_demo_hf_manager',
    email: 'manager@hope-forward.com',
    orgId: 'org_demo_hope_forward',
    role: 'org_admin',
    givenName: 'Hope',
    password: 'Hope-Demo-2026!',
  },
  {
    sub: 'usr_demo_wv_manager',
    email: 'manager@world-vision.org.au',
    orgId: 'org_demo_world_vision',
    role: 'org_admin',
    givenName: 'World',
    password: 'WV-Demo-2026!',
  },
  {
    sub: 'usr_demo_pestmax_manager',
    email: 'manager@pestmax.com',
    orgId: 'org_demo_pestmax',
    role: 'org_admin',
    givenName: 'Pest',
    password: 'Pest-Demo-2026!',
  },
  {
    sub: 'usr_demo_gch_manager',
    email: 'manager@goldcoasthospital.org.au',
    orgId: 'org_demo_gch',
    role: 'org_admin',
    givenName: 'Gold',
    password: 'GCH-Demo-2026!',
  },
];

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Build a synthetic d2d_at token: a real HS256 JWT signed with the platform
 * JWT_ACCESS_SECRET so getSession's HMAC verify accepts it in dev/preview.
 * Returns null when no signing secret is configured (fail-closed — no cookie).
 *
 * Carries a `demo: true` claim so downstream surfaces can distinguish a
 * synthetic session from a real API-issued one.
 */
function buildSyntheticAt(acct: DemoAccount): string | null {
  const secret = sessionSigningSecret();
  if (!secret) return null;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    JSON.stringify({
      sub: acct.sub,
      orgId: acct.orgId,
      role: acct.role,
      email: acct.email,
      givenName: acct.givenName,
      regionCode: 'US',
      brandCode: 'd2d',
      demo: true,
      iat: now,
      // 12-hour expiry — dev demo sessions are short-lived; getSession
      // enforces exp, so a stale synthetic cookie cleanly expires.
      exp: now + 12 * 60 * 60,
    }),
  );
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // D5: dead in production — refuse BEFORE any work, with 404 so we don't
  // advertise the route exists. Also requires DEMO_MODE_ENABLED=true (default
  // OFF). Decision is centralised in isDemoLoginEnabled (unit-tested).
  const isProd = process.env.NODE_ENV === 'production';
  if (!isDemoLoginEnabled()) {
    return new NextResponse(
      JSON.stringify({
        type: 'https://docs.d2d.io/problems/not-found',
        title: 'Not Found',
        status: 404,
      }),
      { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }

  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty
  }
  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json(
      {
        type: 'https://docs.d2d.io/problems/validation',
        title: 'Validation failed',
        status: 400,
        detail: 'email and password required',
      },
      { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }
  const acct = DEMO_TABLE.find((a) => a.email === body.email);
  if (!acct || acct.password !== body.password) {
    return NextResponse.json(
      {
        type: 'https://docs.d2d.io/problems/unauthorized',
        title: 'Invalid email or password',
        status: 401,
        detail: 'Invalid email or password',
      },
      { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }

  const token = buildSyntheticAt(acct);
  if (!token) {
    // No signing secret configured → cannot mint a verifiable cookie. Fail
    // closed rather than emitting a token getSession would reject anyway.
    return new NextResponse(
      JSON.stringify({
        type: 'https://docs.d2d.io/problems/internal-error',
        title: 'Demo login unavailable',
        status: 503,
        detail: 'Demo session signing is not configured.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }
  const res = NextResponse.json({
    user: {
      id: acct.sub,
      email: acct.email,
      role: acct.role,
      orgId: acct.orgId,
      givenName: acct.givenName,
    },
    demo: true,
  });
  res.cookies.set('d2d_at', token, {
    httpOnly: true,
    // Not reachable in prod (404 above), but keep the secure flag honest.
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
  return res;
}
