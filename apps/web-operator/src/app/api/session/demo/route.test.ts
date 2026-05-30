/**
 * SEC / D5 — proves the demo super-admin login gate is dead in production and
 * default-OFF elsewhere, and that the token the route mints (when enabled) is
 * a real HMAC-signed JWT — closing the D1 overlap where the synthetic
 * signature was the literal "demo" and trusted unverified.
 *
 * The route handler itself imports next/server, which doesn't resolve in the
 * Node test pool, so we test the centralised, framework-free gate
 * (isDemoLoginEnabled) the route calls, plus a sign→verify round-trip that
 * mirrors the route's buildSyntheticAt exactly.
 */
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { isDemoLoginEnabled, verifySessionToken } from '../../../../lib/session-verify';

const SECRET = 'test-secret-at-least-32-chars-long-xxxxx';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Identical to the route's buildSyntheticAt signing. */
function mintSynthetic(secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    JSON.stringify({
      sub: 'usr_demo_brodie',
      orgId: 'org_demo_platform',
      role: 'super_admin',
      email: 'brodie@door2digital.com',
      givenName: 'Brodie',
      regionCode: 'US',
      brandCode: 'd2d',
      demo: true,
      iat: now,
      exp: now + 12 * 60 * 60,
    }),
  );
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

describe('isDemoLoginEnabled — D5 prod gate', () => {
  const save = { ...process.env };
  afterEach(() => {
    process.env = { ...save };
  });

  it('is FALSE in production even when DEMO_MODE_ENABLED=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE_ENABLED = 'true';
    expect(isDemoLoginEnabled()).toBe(false);
  });

  it('is FALSE in dev when DEMO_MODE_ENABLED is unset (default OFF)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEMO_MODE_ENABLED;
    expect(isDemoLoginEnabled()).toBe(false);
  });

  it('is FALSE in dev when DEMO_MODE_ENABLED is any non-"true" value', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEMO_MODE_ENABLED = '1';
    expect(isDemoLoginEnabled()).toBe(false);
  });

  it('is TRUE only in non-prod with an explicit DEMO_MODE_ENABLED=true opt-in', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEMO_MODE_ENABLED = 'true';
    expect(isDemoLoginEnabled()).toBe(true);
  });
});

describe('synthetic demo token — D1 overlap closed', () => {
  it('the minted token cryptographically verifies (no more "demo" signature)', () => {
    const token = mintSynthetic(SECRET);
    const claims = verifySessionToken(token, SECRET);
    expect(claims).not.toBeNull();
    expect(claims?.role).toBe('super_admin');
    expect(claims?.demo).toBe(true);
  });

  it('the minted token does NOT verify under a different secret', () => {
    const token = mintSynthetic(SECRET);
    expect(verifySessionToken(token, 'a-totally-different-secret-32-chars-min!')).toBeNull();
  });
});
