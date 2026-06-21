/**
 * Security regression tests — prove the hardened user-domain controls stay
 * closed across branches.
 *
 * F-001  Non-super-admin cannot invite a super_admin.
 * SEC-002 Non-admin cannot PATCH another user; self-update succeeds.
 * lockout  Ten failed logins → account locked; admin unlock clears it.
 *
 * Requires a live Postgres + Redis (same as the rest of the integration suite).
 * Run with: pnpm vitest run --reporter=verbose tests/integration/user-security.test.ts
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

// ── Fixed org / actor IDs ────────────────────────────────────────────────────
const orgId = 'org_SEC_REGRESS';
const adminId = 'usr_SEC_ADMIN';
const adminEmail = 'admin@secregress.test';
const adminPassword = 'AdminRegress_9!';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedOrg(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgId,
      legalName: 'Sec Regress',
      tradingName: 'Sec Regress',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
  });
}

async function seedAdmin(): Promise<void> {
  await prisma().user.create({
    data: {
      id: adminId,
      orgId,
      email: adminEmail,
      emailDigest: emailDigest(adminEmail, process.env.PII_SEARCH_KEY!),
      givenName: 'Admin',
      familyName: 'Regress',
      role: 'org_admin',
      regionCode: 'US',
      status: 'active',
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
 * Seed an active same-org user with the given role and return a logged-in
 * Bearer token.
 */
async function seedActiveAndLogin(
  id: string,
  email: string,
  role: 'knocker' | 'viewer' | 'manager' | 'org_admin',
): Promise<string> {
  const password = 'LowPriv_Regress9!';
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

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await teardown();
});

beforeEach(async () => {
  await truncateAll();
  await seedOrg();
  await seedAdmin();
});

// ── F-001: non-super-admin cannot invite a super_admin ───────────────────────

describe('F-001 — invite role guard: non-super-admin cannot mint a super_admin', () => {
  it('a knocker calling POST /v1/users with role:super_admin → 403', async () => {
    const knockerToken = await seedActiveAndLogin(
      'usr_F001_KNOCKER',
      'knocker-f001@secregress.test',
      'knocker',
    );
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${knockerToken}`,
        'idempotency-key': 'f001-knocker-sa-invite', // gitleaks:allow
      },
      payload: {
        email: 'victim-sa@secregress.test',
        givenName: 'Bad',
        familyName: 'Actor',
        role: 'super_admin',
      },
    });
    // knocker is not in USER_ADMIN_ROLES → 403 before the super_admin check.
    expect(res.statusCode).toBe(403);
  });

  it('an org_admin calling POST /v1/users with role:super_admin → 403', async () => {
    // org_admin is in USER_ADMIN_ROLES but NOT in the super_admin-minting guard.
    const adminToken = await getAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': 'f001-admin-sa-invite', // gitleaks:allow
      },
      payload: {
        email: 'victim-sa2@secregress.test',
        givenName: 'Bad',
        familyName: 'Actor',
        role: 'super_admin',
      },
    });
    expect(res.statusCode).toBe(403);
    // Confirm no user was created.
    const created = await prisma().user.findFirst({
      where: { orgId, role: 'super_admin' },
    });
    expect(created).toBeNull();
  });

  it('a viewer calling POST /v1/users with role:super_admin → 403', async () => {
    const viewerToken = await seedActiveAndLogin(
      'usr_F001_VIEWER',
      'viewer-f001@secregress.test',
      'viewer',
    );
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'idempotency-key': 'f001-viewer-sa-invite', // gitleaks:allow
      },
      payload: {
        email: 'victim-sa3@secregress.test',
        givenName: 'Bad',
        familyName: 'Actor',
        role: 'super_admin',
      },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── SEC-002: non-admin PATCH on another user is 403; self-update succeeds ────

describe('SEC-002 — PATCH /v1/users/:id update guard', () => {
  it('a knocker PATCHing ANOTHER user → 403', async () => {
    const adminToken = await getAdminToken();
    // Admin invites a victim.
    const victimRes = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'sec002-victim' }, // gitleaks:allow
      payload: {
        email: 'victim@secregress.test',
        givenName: 'Vic',
        familyName: 'Tim',
        role: 'knocker',
      },
    });
    const victimId: string = victimRes.json().user.id;

    const knockerToken = await seedActiveAndLogin(
      'usr_SEC002_KNOCKER',
      'knocker-sec002@secregress.test',
      'knocker',
    );
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${victimId}`,
      headers: { authorization: `Bearer ${knockerToken}` },
      payload: { givenName: 'Hacked' },
    });
    expect(res.statusCode).toBe(403);

    // Victim's name must be unchanged. PII-first: the stored value is masked at
    // create ('Vic' → 'V••'); asserting it stays 'V••' still proves the attacker's
    // PATCH ('Hacked') never landed.
    const after = await prisma().user.findUniqueOrThrow({ where: { id: victimId } });
    expect(after.givenName).toBe('V••');
  });

  it('a viewer PATCHing ANOTHER user → 403', async () => {
    const adminToken = await getAdminToken();
    const victimRes = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': 'sec002-victim2' }, // gitleaks:allow
      payload: {
        email: 'victim2@secregress.test',
        givenName: 'Vic',
        familyName: 'Two',
        role: 'knocker',
      },
    });
    const victimId: string = victimRes.json().user.id;

    const viewerToken = await seedActiveAndLogin(
      'usr_SEC002_VIEWER',
      'viewer-sec002@secregress.test',
      'viewer',
    );
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${victimId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { givenName: 'Hacked' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a knocker PATCHing their OWN profile → 200 (self-update allowed)', async () => {
    const knockerToken = await seedActiveAndLogin(
      'usr_SEC002_SELF',
      'self-sec002@secregress.test',
      'knocker',
    );
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/users/usr_SEC002_SELF',
      headers: { authorization: `Bearer ${knockerToken}` },
      payload: { givenName: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    // PII-first: the read boundary returns the MASKED name. 'Renamed' (7 chars) →
    // 'R' + 6 dots. Real value is encrypted in givenNameVault.
    expect(res.json().user.givenName).toBe('R••••••');
    const row = await prisma().user.findUniqueOrThrow({ where: { id: 'usr_SEC002_SELF' } });
    expect(row.givenNameVault).not.toBeNull();
  });
});

// ── lockout: 10 failed logins → locked; admin unlock clears it ───────────────

describe('lockout + admin unlock', () => {
  const targetEmail = 'lockout-target@secregress.test';
  const targetId = 'usr_LOCKOUT_TARGET';

  beforeEach(async () => {
    await prisma().user.create({
      data: {
        id: targetId,
        orgId,
        email: targetEmail,
        emailDigest: emailDigest(targetEmail, process.env.PII_SEARCH_KEY!),
        givenName: 'Lock',
        familyName: 'Out',
        role: 'knocker',
        regionCode: 'US',
        status: 'active',
      },
    });
    await setUserPassword(targetId, 'CorrectPass_99!');
  });

  it('10 failed logins lock the account (11th attempt → 429)', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: targetEmail, password: 'WrongPassword_!' },
      });
    }
    // 11th attempt — even with the correct password — must be rejected because
    // the account is now locked (lockedUntil is set after the 10th failure).
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: targetEmail, password: 'CorrectPass_99!' },
    });
    expect(res.statusCode).toBe(429);

    const cred = await prisma().userCredential.findUniqueOrThrow({ where: { userId: targetId } });
    expect(cred.lockedUntil).not.toBeNull();
    // SEC-007: the cumulative failure counter is NOT reset on lock — resetting it
    // would hand an attacker a fresh 10 attempts each window. The count only
    // resets on a SUCCESSFUL login. After the 10th failure it therefore reads 10.
    expect(cred.failedLoginCount).toBe(10);
  });

  it('admin POST /:id/unlock clears lockedUntil + failedLoginCount and the user can log in again', async () => {
    // Lock the account first.
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: targetEmail, password: 'WrongPassword_!' },
      });
    }
    const locked = await prisma().userCredential.findUniqueOrThrow({
      where: { userId: targetId },
    });
    expect(locked.lockedUntil).not.toBeNull();

    // Admin clears the lockout.
    const adminToken = await getAdminToken();
    const unlockRes = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/unlock`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': 'unlock-target-001', // gitleaks:allow
      },
    });
    expect(unlockRes.statusCode).toBe(200);
    expect(unlockRes.json().user.id).toBe(targetId);

    // Credential fields cleared.
    const cred = await prisma().userCredential.findUniqueOrThrow({ where: { userId: targetId } });
    expect(cred.lockedUntil).toBeNull();
    expect(cred.failedLoginCount).toBe(0);

    // Login succeeds after unlock.
    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: targetEmail, password: 'CorrectPass_99!' },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().accessToken).toBeTypeOf('string');

    // Audit row written in same TX.
    const audit = await prisma().auditEvent.findFirst({
      where: { action: 'user.lockout_cleared', resourceId: targetId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(adminId);
  });

  it('unlock is idempotent — calling twice with the same idempotency key → 200 both times', async () => {
    const adminToken = await getAdminToken();
    const first = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/unlock`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': 'unlock-idem-001', // gitleaks:allow
      },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/unlock`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'idempotency-key': 'unlock-idem-001', // gitleaks:allow
      },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  });

  it('a knocker calling POST /:id/unlock → 403 (role guard enforced)', async () => {
    const knockerToken = await seedActiveAndLogin(
      'usr_UNLOCK_KNOCKER',
      'knocker-unlock@secregress.test',
      'knocker',
    );
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/unlock`,
      headers: {
        authorization: `Bearer ${knockerToken}`,
        'idempotency-key': 'unlock-403-001', // gitleaks:allow
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a manager calling POST /:id/unlock → 403 (only org_admin/super_admin allowed)', async () => {
    // The unlock gate uses ROLE_GRANT_ROLES (org_admin + super_admin), not
    // USER_ADMIN_ROLES (which includes manager). Verify the tighter boundary.
    const managerToken = await seedActiveAndLogin(
      'usr_UNLOCK_MGR',
      'manager-unlock@secregress.test',
      'manager',
    );
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/unlock`,
      headers: {
        authorization: `Bearer ${managerToken}`,
        'idempotency-key': 'unlock-mgr-403', // gitleaks:allow
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('cross-tenant unlock attempt → 404 (same-org guard)', async () => {
    // A second org with its own admin cannot unlock a user in orgId.
    const foreignOrgId = 'org_SEC_FOREIGN';
    const foreignAdminId = 'usr_SEC_FOREIGN_ADMIN';
    const foreignEmail = 'admin@foreign.secregress.test';
    const foreignPassword = 'ForeignAdmin_9!';

    await prisma().org.create({
      data: {
        id: foreignOrgId,
        legalName: 'Foreign',
        tradingName: 'Foreign',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    });
    await prisma().user.create({
      data: {
        id: foreignAdminId,
        orgId: foreignOrgId,
        email: foreignEmail,
        emailDigest: emailDigest(foreignEmail, process.env.PII_SEARCH_KEY!),
        givenName: 'Frn',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
        status: 'active',
      },
    });
    await setUserPassword(foreignAdminId, foreignPassword);

    const foreignToken = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: foreignEmail, password: foreignPassword },
      })
    ).json().accessToken;

    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetId}/unlock`,
      headers: {
        authorization: `Bearer ${foreignToken}`,
        'idempotency-key': 'unlock-xtenant-001', // gitleaks:allow
      },
    });
    // The foreign admin passes the role gate but the target lives in another org →
    // 404 (Problems.tenantMismatch), NOT 403: no cross-tenant existence leak.
    expect(res.statusCode).toBe(404);
  });
});
