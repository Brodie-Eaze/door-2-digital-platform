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

/**
 * Seed an active user in `orgId` with a known password and return a logged-in
 * Bearer token whose JWT carries the given role. Used to exercise the role
 * guards from the perspective of a low-priv (knocker) and a manager.
 */
async function seedActiveAndLogin(
  id: string,
  email: string,
  role: 'knocker' | 'manager' | 'org_admin',
): Promise<string> {
  const password = 'LowPrivPassword_9!';
  await prisma().user.create({
    data: {
      id,
      orgId,
      email,
      emailDigest: emailDigest(email, process.env.PII_SEARCH_KEY!),
      givenName: 'Low',
      familyName: 'Priv',
      role,
      regionCode: 'US',
      status: 'active',
    },
  });
  await setUserPassword(id, password);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
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

  it('PATCH /v1/users/:id updates profile fields + writes audit', async () => {
    const token = await getAdminToken();
    const id = await inviteOne(token, 'invite-patch-1', 'patch@user.test');
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { givenName: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    // PII-first: the read boundary returns the MASKED name (first char + dots),
    // not the plaintext. 'Renamed' (7 chars) → 'R' + 6 dots. The real value is
    // encrypted in givenNameVault — assert that to keep the test's teeth.
    expect(res.json().user.givenName).toBe('R••••••');
    const row = await prisma().user.findUniqueOrThrow({ where: { id } });
    expect(row.givenName).toBe('R••••••');
    expect(row.givenNameVault).not.toBeNull();
  });

  // D3 — PATCH must NEVER carry a privilege/access field. `role`, `orgId` and
  // `status` are stripped/rejected by the .strict() schema, so even an admin
  // cannot escalate via PATCH and a forged field never reaches the DB write.
  it('PATCH /v1/users/:id IGNORES role (schema strips it — no escalation via PATCH)', async () => {
    const token = await getAdminToken();
    const id = await inviteOne(token, 'invite-patch-role', 'patchrole@user.test');
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'super_admin', givenName: 'StillKnocker' },
    });
    // .strict() rejects the unknown `role` key with a 400 — the write never runs.
    expect(res.statusCode).toBe(400);
    const after = await prisma().user.findUniqueOrThrow({ where: { id } });
    expect(after.role).toBe('knocker'); // unchanged
  });

  it('PATCH /v1/users/:id rejects mass-assigned orgId / status (cross-tenant + un-archive)', async () => {
    const token = await getAdminToken();
    const id = await inviteOne(token, 'invite-patch-mass', 'patchmass@user.test');
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { orgId: 'org_ATTACKER', status: 'active' },
    });
    expect(res.statusCode).toBe(400);
    const after = await prisma().user.findUniqueOrThrow({ where: { id } });
    expect(after.orgId).toBe(orgId); // still our org
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

describe('POST /v1/users/:id/role — guarded role change (D3 / CC6-002)', () => {
  async function inviteKnocker(token: string, idem: string, email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': idem },
      payload: { email, givenName: 'X', familyName: 'Y', role: 'knocker' },
    });
    return res.json().user.id;
  }

  // THE attack chain: a knocker PATCHes/POSTs their own role to super_admin.
  it('a knocker CANNOT self-promote to super_admin via the role endpoint (403)', async () => {
    const knockerToken = await seedActiveAndLogin('usr_KNOCKER_SELF', 'knk@user.test', 'knocker');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/usr_KNOCKER_SELF/role`,
      headers: { authorization: `Bearer ${knockerToken}`, 'idempotency-key': 'role-self-1' },
      payload: { role: 'super_admin' },
    });
    expect(res.statusCode).toBe(403); // role-grant role required
    const after = await prisma().user.findUniqueOrThrow({ where: { id: 'usr_KNOCKER_SELF' } });
    expect(after.role).toBe('knocker');
  });

  it('an org_admin CANNOT grant super_admin (only a super_admin may) (403)', async () => {
    const adminToken = await getAdminToken();
    const targetId = await inviteKnocker(adminToken, 'role-grant-sa', 'tgt-sa@user.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/role`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'role-sa-1' },
      payload: { role: 'super_admin' },
    });
    expect(res.statusCode).toBe(403);
    const after = await prisma().user.findUniqueOrThrow({ where: { id: targetId } });
    expect(after.role).toBe('knocker');
  });

  it('an org_admin CANNOT change their OWN role (no self-escalation) (403)', async () => {
    const adminToken = await getAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${adminId}/role`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'role-selfadmin-1' },
      payload: { role: 'manager' },
    });
    expect(res.statusCode).toBe(403);
    const after = await prisma().user.findUniqueOrThrow({ where: { id: adminId } });
    expect(after.role).toBe('org_admin');
  });

  it('an org_admin CAN re-grade another user to a non-super role (happy path, 200)', async () => {
    const adminToken = await getAdminToken();
    const targetId = await inviteKnocker(adminToken, 'role-ok-invite', 'tgt-ok@user.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/role`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'role-ok-1' },
      payload: { role: 'inside_sales' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe('inside_sales');
  });

  it('rejects a cross-tenant role change (target in another org) (404)', async () => {
    const adminToken = await getAdminToken();
    // Foreign org + user.
    await prisma().org.create({
      data: {
        id: 'org_OTHER_ROLE',
        legalName: 'Other',
        tradingName: 'Other',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    });
    await prisma().user.create({
      data: {
        id: 'usr_FOREIGN_ROLE',
        orgId: 'org_OTHER_ROLE',
        email: 'foreign@other.test',
        emailDigest: emailDigest('foreign@other.test', process.env.PII_SEARCH_KEY!),
        givenName: 'For',
        familyName: 'Eign',
        role: 'knocker',
        regionCode: 'US',
        status: 'active',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/usr_FOREIGN_ROLE/role`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'role-xtenant-1' },
      payload: { role: 'manager' },
    });
    // cross-tenant target → 404 (Problems.tenantMismatch), NOT 403: a foreign user
    // id is indistinguishable from a non-existent one. The role must stay unchanged.
    expect(res.statusCode).toBe(404);
    const after = await prisma().user.findUniqueOrThrow({ where: { id: 'usr_FOREIGN_ROLE' } });
    expect(after.role).toBe('knocker');
  });
});

describe('POST /v1/users/:id/archive — role guard (CC6-003)', () => {
  it('a knocker CANNOT archive another same-org user (403)', async () => {
    const adminToken = await getAdminToken();
    // Victim invited by admin.
    const victim = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'arch-victim-1' },
      payload: { email: 'victim@user.test', givenName: 'V', familyName: 'Ictim', role: 'knocker' },
    });
    const victimId = victim.json().user.id;
    const knockerToken = await seedActiveAndLogin('usr_KNOCKER_ARCH', 'ark@user.test', 'knocker');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${victimId}/archive`,
      headers: { authorization: `Bearer ${knockerToken}`, 'idempotency-key': 'arch-attempt-1' },
    });
    expect(res.statusCode).toBe(403);
    const after = await prisma().user.findUniqueOrThrow({ where: { id: victimId } });
    expect(after.status).toBe('invited'); // not archived
  });

  it('a manager CAN archive a same-org user (200)', async () => {
    const adminToken = await getAdminToken();
    const victim = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'arch-victim-2' },
      payload: { email: 'victim2@user.test', givenName: 'V', familyName: 'Two', role: 'knocker' },
    });
    const victimId = victim.json().user.id;
    const mgrToken = await seedActiveAndLogin('usr_MANAGER_ARCH', 'mgr@user.test', 'manager');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${victimId}/archive`,
      headers: { authorization: `Bearer ${mgrToken}`, 'idempotency-key': 'arch-ok-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.status).toBe('archived');
  });
});
