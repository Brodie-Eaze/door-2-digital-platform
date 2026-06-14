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

describe('RelayState — SEC-009 binary timing-safe comparison', () => {
  it('accepts a valid signature decoded from hex to binary', () => {
    const rs = signRelayState('sec009-org');
    // Must not throw — the binary comparison path must handle a genuine token.
    expect(() => verifyRelayState(rs)).not.toThrow();
    expect(verifyRelayState(rs).slug).toBe('sec009-org');
  });

  it('rejects a signature that is valid hex but wrong value', () => {
    const rs = signRelayState('sec009-org');
    const [payload, sig] = rs.split('.');
    // Flip the last byte — still valid hex, still 64 chars, still 32 bytes decoded.
    const lastTwo = sig!.slice(-2);
    const flipped = lastTwo === 'ff' ? '00' : String(parseInt(lastTwo, 16) + 1).padStart(2, '0');
    const tamperedSig = sig!.slice(0, -2) + flipped;
    expect(() => verifyRelayState(`${payload}.${tamperedSig}`)).toThrow('signature mismatch');
  });

  it('rejects a non-hex signature (would decode to wrong byte length)', () => {
    const rs = signRelayState('sec009-org');
    const [payload] = rs.split('.');
    // A UTF-8 string that is not 64 hex chars won't decode to 32 bytes.
    const notHex = 'not-valid-hex-at-all';
    expect(() => verifyRelayState(`${payload}.${notHex}`)).toThrow('signature mismatch');
  });

  it('rejects a hex signature padded to bypass a naive length guard', () => {
    // An all-zero signature of the right length (64 hex chars) is still wrong.
    const rs = signRelayState('sec009-org');
    const [payload] = rs.split('.');
    const zeroSig = '0'.repeat(64);
    expect(() => verifyRelayState(`${payload}.${zeroSig}`)).toThrow('signature mismatch');
  });
});
