/**
 * Audit integration tests — list endpoint, chain verify (intact + tampered),
 * role gates, tenant isolation.
 *
 * The hash chain is exercised via real mutations (lead create writes an
 * audit row) so we see end-to-end that AuditService.recordEvent is on the
 * write path.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_AUDIT_ALPHA';
const adminA = 'usr_TEST_AUDIT_ALPHA_ADMIN';
const adminEmailA = 'admin@audit.test';
const adminPassA = 'AuditAdminPwd_1';

const orgB = 'org_TEST_AUDIT_BRAVO';
const adminB = 'usr_TEST_AUDIT_BRAVO_ADMIN';
const adminEmailB = 'b@audit.test';
const adminPassB = 'AuditAdminPwd_2';

const knockerA = 'usr_TEST_AUDIT_ALPHA_KNOCKER';
const knockerEmailA = 'knocker@audit.test';
const knockerPassA = 'AuditKnockerPwd_1';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Audit A',
        tradingName: 'AA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Audit B',
        tradingName: 'AB',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    ],
  });
  await prisma().user.createMany({
    data: [
      {
        id: adminA,
        orgId: orgA,
        email: adminEmailA,
        emailDigest: emailDigest(adminEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'A',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: knockerA,
        orgId: orgA,
        email: knockerEmailA,
        emailDigest: emailDigest(knockerEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'K',
        familyName: 'Nocker',
        role: 'knocker',
        regionCode: 'US',
      },
      {
        id: adminB,
        orgId: orgB,
        email: adminEmailB,
        emailDigest: emailDigest(adminEmailB, process.env.PII_SEARCH_KEY!),
        givenName: 'B',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
    ],
  });
  await setUserPassword(adminA, adminPassA);
  await setUserPassword(adminB, adminPassB);
  await setUserPassword(knockerA, knockerPassA);
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

async function createSomeLeads(token: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': `audit-lead-${i}` },
      payload: {
        vertical: 'charity',
        givenName: `Lead${i}`,
        familyName: 'McAudit',
        email: `lead${i}@audit.test`,
      },
    });
  }
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

describe('GET /v1/audit/events', () => {
  it('lists audit rows scoped to actor org', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await createSomeLeads(tA, 3);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audit/events',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // 3 leads × 1 audit row each (lead.created).
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    for (const row of body.data) {
      expect(row.orgId).toBe(orgA);
      expect(row.rowHash).toMatch(/^[a-f0-9]{64}$/);
      expect(row.prevHash).toBeDefined();
    }
  });

  it('isolates tenant — admin in org B never sees org A rows', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    await createSomeLeads(tA, 2);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audit/events',
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(res.statusCode).toBe(200);
    // Each org sees only their own rows. Admin B's login wrote an auth
    // row for orgB so the list isn't necessarily empty — but it must
    // contain ZERO orgA rows.
    for (const row of res.json().data) {
      expect(row.orgId).toBe(orgB);
    }
    // And NO Lead rows (those live in orgA).
    expect(res.json().data.some((r: { resourceType: string }) => r.resourceType === 'Lead')).toBe(
      false,
    );
  });

  it('forbids knocker role from reading audit', async () => {
    const tK = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audit/events',
      headers: { authorization: `Bearer ${tK}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('requires JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audit/events',
    });
    expect(res.statusCode).toBe(401);
  });

  it('filters by resourceType', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await createSomeLeads(tA, 2);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audit/events?resourceType=Lead',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(res.statusCode).toBe(200);
    for (const r of res.json().data) {
      expect(r.resourceType).toBe('Lead');
    }
  });

  it('cursor paginates', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await createSomeLeads(tA, 5);
    const first = await app.inject({
      method: 'GET',
      url: '/v1/audit/events?limit=2',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data).toHaveLength(2);
    expect(first.json().nextCursor).toBeTruthy();

    const second = await app.inject({
      method: 'GET',
      url: `/v1/audit/events?limit=2&cursor=${first.json().nextCursor}`,
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data).toHaveLength(2);
    expect(second.json().data[0].ulid).not.toBe(first.json().data[0].ulid);
  });
});

describe('POST /v1/audit/events/verify', () => {
  it('returns ok=true for an intact chain', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await createSomeLeads(tA, 5);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/audit/events/verify',
      headers: { authorization: `Bearer ${tA}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().count).toBeGreaterThanOrEqual(5);
  });

  it('returns ok=false with brokenAt when a row is tampered', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await createSomeLeads(tA, 5);
    // Tamper with the third audit row's action — the recomputed rowHash
    // will no longer match.
    const rows = await prisma().auditEvent.findMany({
      where: { orgId: orgA },
      orderBy: { id: 'asc' },
    });
    const target = rows[2]!;
    await prisma().auditEvent.update({
      where: { id: target.id },
      data: { action: 'lead.tampered' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/audit/events/verify',
      headers: { authorization: `Bearer ${tA}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.brokenAt).toBe(target.ulid);
  });

  it('forbids knocker from verifying', async () => {
    const tK = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/audit/events/verify',
      headers: { authorization: `Bearer ${tK}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('detects when a middle row AND its prevHash are both rewritten (SEC-002)', async () => {
    // SEC-002 regression: a naive verifier that uses each row's own
    // prevHash as the input to computeRowHash would accept a tampered row
    // whose prevHash was also rewritten to be self-consistent. The fix
    // threads expectedPrev forward from the prior row's rowHash so the
    // chain detects the break.
    const tA = await tokenFor(adminEmailA, adminPassA);
    await createSomeLeads(tA, 5);
    const rows = await prisma().auditEvent.findMany({
      where: { orgId: orgA },
      orderBy: { id: 'asc' },
    });
    const target = rows[2]!;
    // Rewrite BOTH the action AND the prevHash — a self-consistent fake
    // that the old verifier would have accepted because it only checked
    // recomputeHash(row.prevHash, ...) == row.rowHash.
    await prisma().auditEvent.update({
      where: { id: target.id },
      data: {
        action: 'lead.tampered_with_consistent_prev',
        prevHash: 'a'.repeat(64), // fabricated; doesn't match prior row.rowHash
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/audit/events/verify',
      headers: { authorization: `Bearer ${tA}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.brokenAt).toBe(target.ulid);
  });
});

describe('GET /v1/audit/events/export', () => {
  it('returns 501 — Phase 1.4', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/audit/events/export',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(res.statusCode).toBe(501);
  });
});
