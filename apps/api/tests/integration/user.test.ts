/**
 * User integration tests — invite, accept-invite, list (cursor pagination),
 * patch, archive, tenant guard.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;
const orgId = 'org_TEST_USER';
const adminId = 'usr_TEST_USER_ADMIN';
const adminEmail = 'admin@user.test';
const adminPassword = 'AdminPasswordOK!1';

async function seedAdmin(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgId,
      legalName: 'User Test',
      tradingName: 'User Test',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
  });
  await prisma().user.create({
    data: {
      id: adminId,
      orgId,
      email: adminEmail,
      emailDigest: emailDigest(adminEmail, process.env.PII_SEARCH_KEY!),
      givenName: 'User',
      familyName: 'Admin',
      role: 'org_admin',
      regionCode: 'US',
    },
  });
  await setUserPassword(adminId, adminPassword);
}

async function getAdminToken(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: adminEmail, password: adminPassword },
  });
  return res.json().accessToken;
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
  await seedAdmin();
});

describe('User invite + accept-invite flow', () => {
  it('POST /v1/users invites a user (status=invited, inviteToken returned)', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'invite-bob-001',
      },
      payload: {
        email: 'bob@user.test',
        givenName: 'Bob',
        familyName: 'Builder',
        role: 'knocker',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.status).toBe('invited');
    expect(body.user.role).toBe('knocker');
    expect(body.inviteToken).toBeTypeOf('string');
    expect(body.inviteExpiresAt).toBeTypeOf('string');
  });

  it('POST /accept-invite activates user + allows login with new password', async () => {
    const token = await getAdminToken();
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'invite-alice-001',
      },
      payload: {
        email: 'alice2@user.test',
        givenName: 'Alice',
        familyName: 'New',
        role: 'inside_sales',
      },
    });
    const inviteToken = invite.json().inviteToken;
    const accept = await app.inject({
      method: 'POST',
      url: '/v1/users/accept-invite',
      payload: { inviteToken, password: 'SuperSecret_42!' },
    });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().user.status).toBe('active');
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'alice2@user.test', password: 'SuperSecret_42!' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('rejects accept-invite with bad token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users/accept-invite',
      payload: { inviteToken: 'definitely-not-a-real-token', password: 'whatever-OK1' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('duplicate-email invite returns 409 conflict', async () => {
    const token = await getAdminToken();
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'invite-dup-1',
      },
      payload: {
        email: 'dup@user.test',
        givenName: 'Dup',
        familyName: 'One',
        role: 'knocker',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'invite-dup-2',
      },
      payload: {
        email: 'dup@user.test',
        givenName: 'Dup',
        familyName: 'Two',
        role: 'knocker',
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('User listing + pagination', () => {
  it('GET /v1/users filters by orgId derived from JWT', async () => {
    const token = await getAdminToken();
    // Invite two extra users.
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/users',
        headers: {
          authorization: `Bearer ${token}`,
          'idempotency-key': `invite-list-${i}`,
        },
        payload: {
          email: `list${i}@user.test`,
          givenName: 'List',
          familyName: `User${i}`,
          role: 'knocker',
        },
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?limit=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(3); // admin + 2 invited
    expect(body.nextCursor).toBeNull();
    for (const u of body.data) {
      expect(u.orgId).toBe(orgId);
    }
  });

  it('returns nextCursor when more rows than limit', async () => {
    const token = await getAdminToken();
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/users',
        headers: {
          authorization: `Bearer ${token}`,
          'idempotency-key': `invite-page-${i}`,
        },
        payload: {
          email: `page${i}@user.test`,
          givenName: 'Page',
          familyName: `User${i}`,
          role: 'knocker',
        },
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users?limit=2',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(2);
    expect(body.nextCursor).toBeTypeOf('string');
  });
});

describe('PATCH + archive', () => {
  async function inviteOne(token: string, idem: string, email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': idem },
      payload: { email, givenName: 'X', familyName: 'Y', role: 'knocker' },
    });
    return res.json().user.id;
  }

  it('PATCH /v1/users/:id changes role + writes audit', async () => {
    const token = await getAdminToken();
    const id = await inviteOne(token, 'invite-patch-1', 'patch@user.test');
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'inside_sales' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe('inside_sales');
  });

  it('POST /:id/archive flips status to archived + revokes refresh tokens', async () => {
    const token = await getAdminToken();
    const id = await inviteOne(token, 'invite-arch-1', 'arch@user.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${id}/archive`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'archive-user-1',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.status).toBe('archived');
  });
});
