/**
 * Unit tests for the access-token revocation epoch.
 *
 * Focus: D12 — on a Redis ERROR the check must NOT silently report
 * "not revoked" (fail open). It now throws TokenRevocationUnavailableError so
 * authenticated callers can fail CLOSED.
 *
 * Redis is mocked so no server is required and we can force the error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const setMock = vi.fn();

vi.mock('../../config/redis', () => ({
  redis: () => ({ get: getMock, set: setMock }),
}));

import {
  isAccessTokenRevoked,
  revokeUserAccessTokens,
  TokenRevocationUnavailableError,
} from './token-revocation';

beforeEach(() => {
  getMock.mockReset();
  setMock.mockReset();
});

describe('isAccessTokenRevoked — normal operation', () => {
  it('returns false when no epoch is set', async () => {
    getMock.mockResolvedValue(null);
    expect(await isAccessTokenRevoked('usr_1', 1_000)).toBe(false);
  });

  it('returns true for a token minted at or before the epoch', async () => {
    getMock.mockResolvedValue('1500');
    expect(await isAccessTokenRevoked('usr_1', 1_500)).toBe(true); // inclusive
    expect(await isAccessTokenRevoked('usr_1', 1_499)).toBe(true);
  });

  it('returns false for a token minted after the epoch', async () => {
    getMock.mockResolvedValue('1500');
    expect(await isAccessTokenRevoked('usr_1', 1_501)).toBe(false);
  });

  it('treats an unparseable epoch value as not-revoked', async () => {
    getMock.mockResolvedValue('not-a-number');
    expect(await isAccessTokenRevoked('usr_1', 1_500)).toBe(false);
  });
});

describe('isAccessTokenRevoked — D12 Redis error => fail-closed signal', () => {
  it('THROWS TokenRevocationUnavailableError on a Redis GET error (never returns false)', async () => {
    getMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(isAccessTokenRevoked('usr_1', 1_500)).rejects.toBeInstanceOf(
      TokenRevocationUnavailableError,
    );
  });

  it('carries the underlying Redis error as `cause` for logging', async () => {
    const boom = new Error('READONLY You can not write against a read only replica');
    getMock.mockRejectedValue(boom);
    await expect(isAccessTokenRevoked('usr_1', 1_500)).rejects.toMatchObject({ cause: boom });
  });
});

describe('revokeUserAccessTokens — best-effort write', () => {
  it('swallows a Redis SET error (must not turn a 401 into a 500)', async () => {
    setMock.mockRejectedValue(new Error('down'));
    await expect(revokeUserAccessTokens('usr_1')).resolves.toBeUndefined();
  });

  it('stamps the epoch with a TTL on success', async () => {
    setMock.mockResolvedValue('OK');
    await revokeUserAccessTokens('usr_1');
    expect(setMock).toHaveBeenCalledTimes(1);
    const args = setMock.mock.calls[0]!;
    expect(args[0]).toBe('auth:revoked-before:usr_1');
    expect(args[2]).toBe('EX');
  });
});
