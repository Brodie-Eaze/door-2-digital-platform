/**
 * POST /api/session/demo — synthetic-demo session issuer.
 *
 * Phase-0 demo accommodation: when `NEXT_PUBLIC_API_URL` is unset (typical
 * for the Railway prod web service that ships without the API), the /login
 * page falls back to issuing a SYNTHETIC d2d_at cookie via this route. The
 * cookie has the 3-part shape the middleware shape-check accepts:
 *
 *   header (base64url JSON) . payload (base64url JSON) . signature ("demo")
 *
 * The signature segment is the literal string "demo" — it can NEVER pass
 * the API's HMAC verify (`verifyAccessToken` throws). So a synthetic
 * cookie ONLY unlocks the static UI; any /proxy/api/* call still 401s.
 *
 * SECURITY: this endpoint accepts a known short-list of demo emails. It
 * does NOT trust arbitrary input — if someone POSTs `email: foo@bar.com`
 * we 400. The demo passwords are checked against a hardcoded table.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

function b64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Build a synthetic d2d_at token with a JWT-shaped 3-part structure. The
 * signature ("demo") cannot HMAC-verify, so the API still rejects it.
 */
function buildSyntheticAt(acct: DemoAccount): string {
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub: acct.sub,
      orgId: acct.orgId,
      role: acct.role,
      email: acct.email,
      givenName: acct.givenName,
      regionCode: 'US',
      brandCode: 'd2d',
      iat: now,
      // Long expiry — demo cookies persist 30 days. Middleware doesn't check
      // exp; the synthetic flow is meant for offline-API demos.
      exp: now + 30 * 24 * 60 * 60,
    }),
  );
  return `${header}.${payload}.demo`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const isProd = process.env.NODE_ENV === 'production';
  const token = buildSyntheticAt(acct);
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
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
