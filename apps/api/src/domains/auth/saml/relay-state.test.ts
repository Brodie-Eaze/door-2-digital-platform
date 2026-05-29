/**
 * Unit tests for the signed SAML RelayState — CSRF / replay defence for the
 * SP-initiated flow. Needs only env (OAUTH_STATE_SECRET), loaded by setup.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { signRelayState, verifyRelayState, RELAY_STATE_MAX_AGE_MS } from './relay-state';

afterEach(() => {
  vi.useRealTimers();
});

describe('RelayState round-trip', () => {
  it('signs and verifies, returning the bound slug', () => {
    const rs = signRelayState('pilot-charlie');
    expect(rs).toContain('.');
    expect(verifyRelayState(rs).slug).toBe('pilot-charlie');
  });

  it('produces a distinct token each time (nonce)', () => {
    expect(signRelayState('x')).not.toBe(signRelayState('x'));
  });
});

describe('RelayState tamper / forgery rejection', () => {
  it('rejects a flipped signature', () => {
    const rs = signRelayState('org');
    const [payload, sig] = rs.split('.');
    const tampered = `${payload}.${sig!.slice(0, -1)}${sig!.endsWith('a') ? 'b' : 'a'}`;
    expect(() => verifyRelayState(tampered)).toThrow();
  });

  it('rejects a swapped payload kept with the old signature', () => {
    const rs = signRelayState('org-a');
    const sig = rs.split('.')[1]!;
    const forgedPayload = Buffer.from(
      JSON.stringify({ slug: 'org-b', nonce: 'x', iat: Date.now() }),
    ).toString('base64url');
    expect(() => verifyRelayState(`${forgedPayload}.${sig}`)).toThrow();
  });

  it('rejects malformed structure', () => {
    expect(() => verifyRelayState('no-dot')).toThrow();
    expect(() => verifyRelayState('a.b.c')).toThrow();
    expect(() => verifyRelayState('.sig')).toThrow();
    expect(() => verifyRelayState('payload.')).toThrow();
  });
});

describe('RelayState freshness window', () => {
  it('rejects a stale RelayState beyond the max age', () => {
    const rs = signRelayState('org');
    // Advance virtual time past the window, then verify.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + RELAY_STATE_MAX_AGE_MS + 1000);
    expect(() => verifyRelayState(rs)).toThrow();
  });
});
