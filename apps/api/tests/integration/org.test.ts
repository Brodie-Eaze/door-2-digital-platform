/**
 * Org integration tests — create (idempotency), region pinning, archive,
 * brand-kit, billing, tenant guard.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;
const adminOrgId = 'org_TEST_ORG_ADMIN';
const adminUserId = 'usr_TEST_ORG_ADMIN';
const adminEmail = 'admin@org.test';
const adminPassword = 'AdminPasswordOK!1';

// SEC-011: POST /v1/orgs now requires super_admin. We seed a separate
// super-admin so the existing org_admin paths (GET/PATCH/archive/brand-kit/
// billing) still exercise the role boundary they were written to assert.
const superAdminUserId = 'usr_TEST_ORG_SUPERADMIN';
const superAdminEmail = 'super@org.test';
const superAdminPassword = 'SuperAdminPwd_99';

async function getAdminToken(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: adminEmail, password: adminPassword },
  });
  return res.json().accessToken;
}

async function getSuperAdminToken(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: superAdminEmail, password: superAdminPassword },
  });
  return res.json().accessToken;
}

async function seedAdmin(): Promise<void> {
  await prisma().org.create({
    data: {
      id: adminOrgId,
      legalName: 'Admin Test',
      tradingName: 'Admin Test',
      vertical: 'commercial',
      type: 'operator',
      regionCode: 'US',
    },
  });
  await prisma().user.createMany({
    data: [
      {
        id: adminUserId,
        orgId: adminOrgId,
        email: adminEmail,
        emailDigest: emailDigest(adminEmail, process.env.PII_SEARCH_KEY!),
        givenName: 'Org',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: superAdminUserId,
        orgId: adminOrgId,
        email: superAdminEmail,
        emailDigest: emailDigest(superAdminEmail, process.env.PII_SEARCH_KEY!),
        givenName: 'Super',
        familyName: 'Admin',
        role: 'super_admin',
        regionCode: 'US',
      },
    ],
  });
  await setUserPassword(adminUserId, adminPassword);
  await setUserPassword(superAdminUserId, superAdminPassword);
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

describe('POST /v1/orgs', () => {
  const body = {
    legalName: 'New Org',
    tradingName: 'New Org',
    vertical: 'charity' as const,
    type: 'client' as const,
    regionCode: 'US' as const,
    currency: 'USD',
  };

  // SEC-011: anonymous + non-super_admin paths
  it('rejects with 401 when no auth header (SEC-011)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { 'idempotency-key': 'sec011-anon-001' },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects with 403 when authenticated as org_admin (SEC-011)', async () => {
    const t = await getAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'sec011-orgadm-001' },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe('https://docs.d2d.io/problems/forbidden');
  });

  it('rejects when Idempotency-Key header is missing', async () => {
    const t = await getSuperAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe('https://docs.d2d.io/problems/validation-failed');
  });

  it('creates org + brand kit + billing in same TX (201) when super_admin', async () => {
    const t = await getSuperAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'org-create-test-001' },
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.org.id).toMatch(/^org_/);
    expect(json.org.regionCode).toBe('US');
    expect(json.brandKit.orgId).toBe(json.org.id);
    expect(json.billing.orgId).toBe(json.org.id);
  });

  it('replays same response when same key + same body', async () => {
    const t = await getSuperAdminToken();
    const first = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'org-create-replay-001' },
      payload: body,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'org-create-replay-001' },
      payload: body,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().org.id).toBe(first.json().org.id);
  });

  it('returns 409 when same key replays with different body', async () => {
    const t = await getSuperAdminToken();
    await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'org-create-conflict-001' },
      payload: body,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'org-create-conflict-001' },
      payload: { ...body, legalName: 'Different' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('writes org.created audit row with hash chain', async () => {
    const t = await getSuperAdminToken();
    await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'org-create-audit-001' },
      payload: body,
    });
    const audit = await prisma().auditEvent.findFirst({
      where: { action: 'org.created' },
      orderBy: { id: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.rowHash).toBeTypeOf('string');
    expect(audit?.prevHash).toBeTypeOf('string');
  });
});

describe('GET / PATCH / POST .../archive', () => {
  it('GET /v1/orgs/:id returns the actor’s org', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${adminOrgId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().org.id).toBe(adminOrgId);
  });

  it('tenant guard blocks cross-org reads (403)', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/orgs/org_NOT_OURS',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe('https://docs.d2d.io/problems/tenant-mismatch');
  });

  it('PATCH rejects regionCode mutation with 400 (region pinned at create)', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/orgs/${adminOrgId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { regionCode: 'AU' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe('https://docs.d2d.io/problems/region-immutable');
  });

  it('PATCH updates legalName + writes audit row', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/orgs/${adminOrgId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { legalName: 'Updated Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().org.legalName).toBe('Updated Name');
    const audit = await prisma().auditEvent.findFirst({
      where: { action: 'org.updated', resourceId: adminOrgId },
    });
    expect(audit).not.toBeNull();
  });

  it('POST /:id/archive flips status to archived', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${adminOrgId}/archive`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'archive-admin-org-001',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().org.status).toBe('archived');
  });
});

describe('Brand kit + billing', () => {
  it('POST /:id/brand-kit upserts BrandKit + writes audit', async () => {
    const token = await getAdminToken();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${adminOrgId}/brand-kit`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'bk-upsert-001',
      },
      payload: { primaryColor: '#123456', accentColor: '#abcdef' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().brandKit.primaryColor).toBe('#123456');
  });

  it('PATCH /:id/billing updates rake percentages', async () => {
    const token = await getAdminToken();
    // The seed org doesn't have an OrgBilling row; service requires it.
    await prisma().orgBilling.create({
      data: { id: 'bil_seed', orgId: adminOrgId, currency: 'USD' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/orgs/${adminOrgId}/billing`,
      headers: { authorization: `Bearer ${token}` },
      payload: { doorRakePercent: 20, currency: 'USD' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().billing.doorRakePercent).toBe('20');
  });
});
