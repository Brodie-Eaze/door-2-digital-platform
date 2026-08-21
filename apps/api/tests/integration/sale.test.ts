/**
 * Sale integration tests — read + installer handoff.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_SAL_ALPHA';
const adminA = 'usr_TEST_SAL_ALPHA_ADMIN';
const adminEmailA = 'admin@sal.test';
const adminPassA = 'SalAdminPwd_1';

const orgB = 'org_TEST_SAL_BRAVO';
const adminB = 'usr_TEST_SAL_BRAVO_ADMIN';
const adminEmailB = 'b@sal.test';
const adminPassB = 'SalAdminPwd_2';

const installerOrg = 'org_TEST_SAL_INSTALLER';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Sal A',
        tradingName: 'SA',
        vertical: 'commercial',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Sal B',
        tradingName: 'SB',
        vertical: 'commercial',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: installerOrg,
        legalName: 'Installer',
        tradingName: 'Installer',
        vertical: 'commercial',
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
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

async function createSale(token: string, key: string): Promise<string> {
  const leadRes = await app.inject({
    method: 'POST',
    url: '/v1/leads',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `sal-lead-${key}` },
    payload: {
      vertical: 'commercial',
      givenName: 'Buyer',
      familyName: 'Bee',
    },
  });
  const leadId = leadRes.json().lead.id;
  const cnvRes = await app.inject({
    method: 'POST',
    url: '/v1/conversions',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `sal-cnv-${key}` },
    payload: {
      leadId,
      type: 'sale_commercial',
      attributionSource: 'door',
      amountCents: '250000',
      currency: 'USD',
      paymentProvider: 'stripe_au',
      saleDetails: { productSku: 'SKU-Z-001' },
    },
  });
  return cnvRes.json().conversion.sale.id;
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

describe('GET /v1/sales/:id', () => {
  it('reads a sale', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createSale(t, 'read-1');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/sales/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sale.id).toBe(id);
    expect(res.json().sale.productSku).toBe('SKU-Z-001');
    expect(res.json().sale.status).toBe('pending_install');
  });

  it('cross-tenant returns 404', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const id = await createSale(tA, 'iso-1');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/sales/${id}`,
      headers: { authorization: `Bearer ${tB}` },
    });
    // cross-tenant → 404 (Problems.tenantMismatch), NOT 403: no enumeration oracle.
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 unknown id', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/sales/sal_does_not_exist_at_all_x',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /v1/sales/:id/installer-handoff', () => {
  it('sets installer + scheduled date + audit', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createSale(t, 'handoff-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/sales/${id}/installer-handoff`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'sal-handoff-1' },
      payload: {
        installerOrgId: installerOrg,
        scheduledInstallAt: '2026-06-01T09:00:00.000Z',
        notes: 'Site survey complete',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sale.installerOrgId).toBe(installerOrg);
    expect(res.json().sale.scheduledInstallAt).toBe('2026-06-01T09:00:00.000Z');
    const audit = await prisma().auditEvent.findFirst({
      where: { resourceType: 'Sale', resourceId: id, action: 'sale.installer_handoff' },
    });
    expect(audit).toBeTruthy();
  });

  it('requires Idempotency-Key', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createSale(t, 'handoff-no-idem-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/sales/${id}/installer-handoff`,
      headers: { authorization: `Bearer ${t}` },
      payload: {
        installerOrgId: installerOrg,
        scheduledInstallAt: '2026-06-01T09:00:00.000Z',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('cross-tenant handoff returns 404', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const id = await createSale(tA, 'handoff-iso-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/sales/${id}/installer-handoff`,
      headers: { authorization: `Bearer ${tB}`, 'idempotency-key': 'sal-handoff-iso-1' },
      payload: {
        installerOrgId: installerOrg,
        scheduledInstallAt: '2026-06-01T09:00:00.000Z',
      },
    });
    // cross-tenant write → 404 (Problems.tenantMismatch), NOT 403: no enumeration oracle.
    expect(res.statusCode).toBe(404);
  });
});

describe('Stub endpoints', () => {
  it('POST /v1/sales returns 501 — sales are created via conversions', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sales',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'sal-stub-1' },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });

  // cancel is now IMPLEMENTED (cancel sale + clawback commission), not a 501
  // stub. A well-formed call against an unknown id resolves to 404.
  it('POST /:id/cancel is implemented — unknown id → 404', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sales/sal_does_not_exist/cancel',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'sal-cancel-404' },
      payload: { reason: 'buyer rescinded' },
    });
    expect(res.statusCode).toBe(404);
  });
});
