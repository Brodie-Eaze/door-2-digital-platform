/**
 * SEC / D1 — proves the forgeable-cookie BFF chain is closed.
 *
 * The exploit: an attacker set `d2d_at` to a hand-crafted token whose payload
 * claimed `{"role":"super_admin", ...}` and the BFF trusted it with NO
 * signature check, unlocking cross-tenant org + lead PII.
 *
 * verifySessionToken now HMAC-verifies (constant-time) with JWT_ACCESS_SECRET
 * before any claim is trusted. These tests exercise the pure verifier so the
 * attack vectors are pinned independently of next/headers.
 */
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySessionToken, sessionSigningSecret } from './session-verify';

const SECRET = 'test-secret-at-least-32-chars-long-xxxxx';
const OTHER_SECRET = 'a-different-secret-also-32-chars-min-yyyyy';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Mint a token the way the API's signAccessToken does. */
function mint(
  payload: Record<string, unknown>,
  secret = SECRET,
  alg: 'HS256' | 'none' = 'HS256',
): string {
  const header = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  if (alg === 'none') return `${header}.${body}.`;
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

const future = () => Math.floor(Date.now() / 1000) + 600;
const past = () => Math.floor(Date.now() / 1000) - 60;

describe('verifySessionToken — happy path', () => {
  it('accepts a correctly-signed, unexpired token and returns claims', () => {
    const token = mint({ sub: 'usr_1', orgId: 'org_1', role: 'org_admin', exp: future() });
    const claims = verifySessionToken(token, SECRET);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe('usr_1');
    expect(claims?.orgId).toBe('org_1');
    expect(claims?.role).toBe('org_admin');
  });

  it('accepts a correctly-signed super_admin token (real operator)', () => {
    const token = mint({
      sub: 'usr_op',
      orgId: 'org_platform',
      role: 'super_admin',
      exp: future(),
    });
    expect(verifySessionToken(token, SECRET)?.role).toBe('super_admin');
  });
});

describe('verifySessionToken — D1 attack vectors are rejected', () => {
  it('rejects a forged super_admin payload with an "alg:none" signature', () => {
    // The exact legacy exploit shape: 3-part token, no real HMAC.
    const forged = mint(
      { sub: 'attacker', orgId: 'org_victim', role: 'super_admin', exp: future() },
      SECRET,
      'none',
    );
    expect(verifySessionToken(forged, SECRET)).toBeNull();
  });

  it('rejects the legacy synthetic signature literal "demo"', () => {
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const body = b64url(
      JSON.stringify({ sub: 'x', orgId: 'y', role: 'super_admin', exp: future() }),
    );
    const legacyDemo = `${header}.${body}.demo`;
    expect(verifySessionToken(legacyDemo, SECRET)).toBeNull();
  });

  it('rejects a token signed with a DIFFERENT secret', () => {
    const token = mint({ sub: 'a', orgId: 'b', role: 'super_admin', exp: future() }, OTHER_SECRET);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it('rejects a tampered payload (re-encoded body, original signature)', () => {
    const good = mint({ sub: 'a', orgId: 'org_mine', role: 'org_admin', exp: future() });
    const [h, , s] = good.split('.');
    // Attacker escalates role + swaps org without re-signing.
    const evilBody = b64url(
      JSON.stringify({ sub: 'a', orgId: 'org_other', role: 'super_admin', exp: future() }),
    );
    expect(verifySessionToken(`${h}.${evilBody}.${s}`, SECRET)).toBeNull();
  });

  it('rejects an expired (but correctly-signed) token', () => {
    const token = mint({ sub: 'a', orgId: 'b', role: 'org_admin', exp: past() });
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it('rejects when no secret is configured (fail-closed)', () => {
    const token = mint({ sub: 'a', orgId: 'b', role: 'super_admin', exp: future() });
    expect(verifySessionToken(token, null)).toBeNull();
  });

  it('rejects malformed / missing tokens', () => {
    expect(verifySessionToken(undefined, SECRET)).toBeNull();
    expect(verifySessionToken('', SECRET)).toBeNull();
    expect(verifySessionToken('not-a-jwt', SECRET)).toBeNull();
    expect(verifySessionToken('only.two', SECRET)).toBeNull();
  });

  it('rejects a token missing required claims even when signed', () => {
    const noRole = mint({ sub: 'a', orgId: 'b', exp: future() });
    const noExp = mint({ sub: 'a', orgId: 'b', role: 'org_admin' });
    expect(verifySessionToken(noRole, SECRET)).toBeNull();
    expect(verifySessionToken(noExp, SECRET)).toBeNull();
  });
});

describe('sessionSigningSecret — fail-closed on weak/absent key', () => {
  const save = { ...process.env };
  afterEach(() => {
    process.env = { ...save };
  });

  it('returns null when JWT_ACCESS_SECRET is unset', () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.SESSION_COOKIE_SECRET;
    expect(sessionSigningSecret()).toBeNull();
  });

  it('returns null when the secret is shorter than 32 chars', () => {
    process.env.JWT_ACCESS_SECRET = 'too-short';
    expect(sessionSigningSecret()).toBeNull();
  });

  it('returns the secret when >= 32 chars', () => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    expect(sessionSigningSecret()).toBe(SECRET);
  });
});
