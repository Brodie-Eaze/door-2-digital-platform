/**
 * Auth integration tests — login, refresh, logout, /me, audit chain.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { redis } from '../../src/config/redis';
import {
  isAccessTokenRevoked,
  revokeUserAccessTokens,
} from '../../src/domains/auth/token-revocation';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;
const orgId = 'org_TEST_AUTH';
const userId = 'usr_TEST_AUTH';
const email = 'alice@auth.test';
const password = 'CorrectHorseBatteryStaple1!';
const revocationKey = `auth:revoked-before:${userId}`;

async function seed(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgId,
      legalName: 'Auth Test',
      tradingName: 'Auth Test',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
  });
  await prisma().user.create({
    data: {
      id: userId,
      orgId,
      email,
      emailDigest: emailDigest(email, process.env.PII_SEARCH_KEY!),
      givenName: 'Alice',
      familyName: 'Tester',
      role: 'org_admin',
      regionCode: 'US',
      status: 'active',
    },
  });
  await setUserPassword(userId, password);
}

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await teardown();
});

beforeEach(async () => {
  await truncateAll();
  // SEC-004: truncateAll resets Postgres but not Redis; clear the per-user
  // revocation epoch so each test starts from a known (no-epoch) state.
  await redis().del(revocationKey);
  await seed();
});

describe('POST /v1/auth/login', () => {
  it('returns access + refresh tokens for correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.refreshToken).toBeTypeOf('string');
    expect(body.accessTokenExpiresIn).toBeGreaterThan(0);
    expect(body.user.id).toBe(userId);
    expect(body.user.role).toBe('org_admin');
    expect(body.user.orgId).toBe(orgId);
  });

  it('returns 401 for wrong password with RFC 7807 problem JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.type).toBe('https://docs.d2d.io/problems/unauthorized');
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'nobody@unknown.test', password },
    });
    expect(res.statusCode).toBe(401);
  });

  it('writes auth.login_success audit row in same TX', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    const audit = await prisma().auditEvent.findFirst({
      where: { action: 'auth.login_success', actorUserId: userId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.resourceId).toBe(userId);
  });
});

describe('POST /v1/auth/refresh', () => {
  async function getTokens(): Promise<{ access: string; refresh: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    return { access: res.json().accessToken, refresh: res.json().refreshToken };
  }

  it('rotates the refresh token + issues a new access token', async () => {
    const { refresh } = await getTokens();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refresh },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.refreshToken).not.toBe(refresh);
    expect(body.accessToken).toBeTypeOf('string');
  });

  it('rejects already-rotated refresh token (reuse detection)', async () => {
    const { refresh } = await getTokens();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refresh },
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refresh },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('returns 401 for unknown refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: 'unknown-token-1234567890' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /v1/auth/me', () => {
  it('requires a Bearer token (401 without)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns current user with valid token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    const access = login.json().accessToken;
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${access}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(userId);
  });

  it('rejects malformed tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: 'Bearer not.a.jwt' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /v1/auth/logout', () => {
  it('revokes the refresh token + returns 204', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    const access = login.json().accessToken;
    const refresh = login.json().refreshToken;
    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${access}` },
      payload: { refreshToken: refresh },
    });
    expect(logout.statusCode).toBe(204);
    // Refresh should now fail.
    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refresh },
    });
    expect(reuse.statusCode).toBe(401);
  });
});

describe('access-token revocation epoch (SEC-004)', () => {
  async function login(): Promise<{ access: string; refresh: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
    return { access: res.json().accessToken, refresh: res.json().refreshToken };
  }

  it('rejects an access token minted at/before the epoch with a distinct "revoked" 401', async () => {
    const { access } = await login();
    // Stamp an epoch a few seconds after the token's iat (token was minted
    // at/before now), so iat <= cutoff is unambiguously true.
    const cutoff = Math.floor(Date.now() / 1000) + 5;
    await redis().set(revocationKey, String(cutoff), 'EX', 60);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${access}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().detail).toMatch(/revoked/i);
  });

  it('accepts a fresh token when no epoch is set', async () => {
    const { access } = await login();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${access}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(userId);
  });

  it('refresh-token reuse revokes outstanding access tokens end-to-end', async () => {
    const { access, refresh } = await login();
    // The just-issued access token works before any compromise signal.
    const before = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${access}` },
    });
    expect(before.statusCode).toBe(200);

    // Rotate once, then replay the original refresh → reuse detected → epoch stamped.
    await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refresh },
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refresh },
    });
    expect(replay.statusCode).toBe(401);

    // The previously-valid access token is now rejected — the ≤5-min gap is closed.
    const after = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${access}` },
    });
    expect(after.statusCode).toBe(401);
    expect(after.json().detail).toMatch(/revoked/i);
  });

  it('isAccessTokenRevoked honours the inclusive cutoff boundary', async () => {
    await revokeUserAccessTokens(userId);
    const raw = await redis().get(revocationKey);
    expect(raw).not.toBeNull();
    const cutoff = Number(raw);
    // iat <= cutoff → revoked (inclusive); iat > cutoff → not revoked.
    expect(await isAccessTokenRevoked(userId, cutoff - 1)).toBe(true);
    expect(await isAccessTokenRevoked(userId, cutoff)).toBe(true);
    expect(await isAccessTokenRevoked(userId, cutoff + 1)).toBe(false);
    // No epoch at all → never revoked (fail-safe default).
    await redis().del(revocationKey);
    expect(await isAccessTokenRevoked(userId, cutoff)).toBe(false);
  });
});
