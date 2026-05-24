/**
 * Auth integration tests — login, refresh, logout, /me, audit chain.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;
const orgId = 'org_TEST_AUTH';
const userId = 'usr_TEST_AUTH';
const email = 'alice@auth.test';
const password = 'CorrectHorseBatteryStaple1!';

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
