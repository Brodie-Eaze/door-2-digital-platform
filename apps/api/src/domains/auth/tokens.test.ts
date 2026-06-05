/**
 * Unit tests for the hand-rolled HS256 JWT verify path.
 *
 * Focus: SEC-009 / CC8-009 — the verifier must PIN the algorithm (HS256) and
 * assert the `typ` header, so an `alg:none` / alg-confusion forgery is rejected
 * at the header before (and independently of) the signature check.
 */
import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from './tokens';

const SECRET = 'unit-test-access-secret';

function basePayload() {
  return {
    sub: 'usr_1',
    orgId: 'org_1',
    role: 'rep',
    regionCode: 'US',
    brandCode: 'd2d',
  };
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('verifyAccessToken — happy path', () => {
  it('verifies a token we just signed (HS256)', () => {
    const { token } = signAccessToken(basePayload(), SECRET);
    const payload = verifyAccessToken(token, SECRET);
    expect(payload.sub).toBe('usr_1');
    expect(payload.orgId).toBe('org_1');
    expect(typeof payload.iat).toBe('number');
  });
});

describe('verifyAccessToken — SEC-009 algorithm pinning', () => {
  it('rejects a token whose header advertises alg:none (with empty signature)', () => {
    const header = b64url({ alg: 'none', typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const body = b64url({ ...basePayload(), iat: now, exp: now + 300 });
    // alg:none classic forgery: empty signature segment.
    const forged = `${header}.${body}.`;
    expect(() => verifyAccessToken(forged, SECRET)).toThrow(/algorithm/i);
  });

  it('rejects an alg-confusion header (e.g. RS256) even if the body is well-formed', () => {
    const header = b64url({ alg: 'RS256', typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const body = b64url({ ...basePayload(), iat: now, exp: now + 300 });
    const forged = `${header}.${body}.AAAA`;
    expect(() => verifyAccessToken(forged, SECRET)).toThrow(/algorithm/i);
  });

  it('rejects a wrong typ header', () => {
    const header = b64url({ alg: 'HS256', typ: 'NOTJWT' });
    const now = Math.floor(Date.now() / 1000);
    const body = b64url({ ...basePayload(), iat: now, exp: now + 300 });
    const forged = `${header}.${body}.AAAA`;
    expect(() => verifyAccessToken(forged, SECRET)).toThrow(/type/i);
  });

  it('still rejects a forged HS256 token signed with the WRONG secret', () => {
    const { token } = signAccessToken(basePayload(), 'attacker-secret');
    expect(() => verifyAccessToken(token, SECRET)).toThrow(/Invalid token/);
  });
});

describe('verifyAccessToken — claim assertions', () => {
  it('rejects a token with a non-numeric iat (revocation epoch depends on iat)', () => {
    const header = b64url({ alg: 'HS256', typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const body = b64url({ ...basePayload(), iat: 'soon', exp: now + 300 });
    // Sign it correctly so we get past the signature check and reach payload validation.
    const { createHmac } = require('node:crypto') as typeof import('node:crypto');
    const sig = createHmac('sha256', SECRET)
      .update(`${header}.${body}`)
      .digest()
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(() => verifyAccessToken(`${header}.${body}.${sig}`, SECRET)).toThrow(/payload/i);
  });

  it('rejects an expired token', () => {
    const { token } = signAccessToken(basePayload(), SECRET, -10);
    expect(() => verifyAccessToken(token, SECRET)).toThrow(/expired/i);
  });
});
