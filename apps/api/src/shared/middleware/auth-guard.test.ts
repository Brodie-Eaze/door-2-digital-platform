/**
 * Unit tests for the AuthGuard preHandlers.
 *
 * Focus: D12 — when the revocation store is unavailable the guard must:
 *   - requireAuth  => FAIL CLOSED (reject 401), and log the outage, so a
 *     possibly-revoked (compromised) session cannot ride out its TTL.
 *   - optionalAuth => FAIL OPEN safely (proceed WITHOUT a principal), so public
 *     routes keep working but never grant the optional principal on an outage.
 *
 * `env` is mocked to supply a known signing secret; the revocation module is
 * mocked so we can force both the "unavailable" and "revoked"/"ok" branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProblemError } from '@d2d/shared-utils';

const ACCESS_SECRET = 'unit-test-access-secret-needs-min-32-chars!!';

vi.mock('../../config/env', () => ({
  env: () => ({ JWT_ACCESS_SECRET: ACCESS_SECRET }),
}));

// `vi.mock` is hoisted above imports, so anything its factory closes over must
// be created via `vi.hoisted` (also hoisted) — not a normal top-level binding.
const { isRevokedMock, TokenRevocationUnavailableError } = vi.hoisted(() => {
  class TokenRevocationUnavailableError extends Error {
    constructor(public override readonly cause: unknown) {
      super('Token revocation store unavailable');
      this.name = 'TokenRevocationUnavailableError';
    }
  }
  return { isRevokedMock: vi.fn(), TokenRevocationUnavailableError };
});

vi.mock('../../domains/auth/token-revocation', () => ({
  isAccessTokenRevoked: (...args: unknown[]) => isRevokedMock(...args),
  TokenRevocationUnavailableError,
}));

import {
  requireAuth as requireAuthHandler,
  optionalAuth as optionalAuthHandler,
} from './auth-guard';
import { signAccessToken } from '../../domains/auth/tokens';

// The exported handlers are typed as Fastify preHandler hooks (which declare a
// `this: FastifyInstance`). In these unit tests we invoke them directly, so we
// call them as plain (req, reply) async functions.
type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
const requireAuth = requireAuthHandler as unknown as Handler;
const optionalAuth = optionalAuthHandler as unknown as Handler;

function makeReq(token: string | null): { req: FastifyRequest; logs: { level: string }[] } {
  const logs: { level: string }[] = [];
  const log = {
    error: () => logs.push({ level: 'error' }),
    warn: () => logs.push({ level: 'warn' }),
    info: () => logs.push({ level: 'info' }),
  };
  const req = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    log,
  } as unknown as FastifyRequest;
  return { req, logs };
}

const reply = {} as FastifyReply;

function validToken(): string {
  return signAccessToken(
    { sub: 'usr_1', orgId: 'org_1', role: 'rep', regionCode: 'US', brandCode: 'd2d' },
    ACCESS_SECRET,
  ).token;
}

beforeEach(() => {
  isRevokedMock.mockReset();
});

describe('requireAuth — happy path', () => {
  it('sets req.principal for a valid, non-revoked token', async () => {
    isRevokedMock.mockResolvedValue(false);
    const { req } = makeReq(validToken());
    await requireAuth(req, reply);
    expect(req.principal).toMatchObject({ userId: 'usr_1', orgId: 'org_1', role: 'rep' });
  });

  it('rejects a revoked token with 401', async () => {
    isRevokedMock.mockResolvedValue(true);
    const { req } = makeReq(validToken());
    await expect(requireAuth(req, reply)).rejects.toSatisfy(
      (e: unknown) => e instanceof ProblemError && e.problem.status === 401,
    );
  });
});

describe('requireAuth — D12 fail CLOSED on revocation-store outage', () => {
  it('rejects with 401 (does NOT let the request through) when the store is unavailable', async () => {
    isRevokedMock.mockRejectedValue(new TokenRevocationUnavailableError(new Error('ECONNREFUSED')));
    const { req } = makeReq(validToken());
    await expect(requireAuth(req, reply)).rejects.toSatisfy(
      (e: unknown) => e instanceof ProblemError && e.problem.status === 401,
    );
    // Principal must NOT be populated on a fail-closed rejection.
    expect(req.principal).toBeUndefined();
  });

  it('logs the outage at error level so it is observable', async () => {
    isRevokedMock.mockRejectedValue(new TokenRevocationUnavailableError(new Error('down')));
    const { req, logs } = makeReq(validToken());
    await expect(requireAuth(req, reply)).rejects.toBeInstanceOf(ProblemError);
    expect(logs.some((l) => l.level === 'error')).toBe(true);
  });
});

describe('optionalAuth — D12 fail OPEN safely on revocation-store outage', () => {
  it('proceeds WITHOUT a principal (no throw) when the store is unavailable', async () => {
    isRevokedMock.mockRejectedValue(new TokenRevocationUnavailableError(new Error('down')));
    const { req, logs } = makeReq(validToken());
    await expect(optionalAuth(req, reply)).resolves.toBeUndefined();
    expect(req.principal).toBeUndefined(); // degraded to anonymous, never granted
    expect(logs.some((l) => l.level === 'warn')).toBe(true);
  });

  it('still populates the principal for a valid, non-revoked token', async () => {
    isRevokedMock.mockResolvedValue(false);
    const { req } = makeReq(validToken());
    await optionalAuth(req, reply);
    expect(req.principal).toMatchObject({ userId: 'usr_1' });
  });

  it('withholds the principal for a revoked token', async () => {
    isRevokedMock.mockResolvedValue(true);
    const { req } = makeReq(validToken());
    await optionalAuth(req, reply);
    expect(req.principal).toBeUndefined();
  });
});
