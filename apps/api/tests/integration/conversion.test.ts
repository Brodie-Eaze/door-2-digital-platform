/**
 * Conversion integration tests — donation create, sale create, attribution
 * rake calculation, processor residual for micamp, lead status flip.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_CNV_ALPHA';
const adminA = 'usr_TEST_CNV_ALPHA_ADMIN';
const adminEmailA = 'admin@cnv.test';
const adminPassA = 'CnvAdminPwd_1';

const orgB = 'org_TEST_CNV_BRAVO';
const adminB = 'usr_TEST_CNV_BRAVO_ADMIN';
const adminEmailB = 'b@cnv.test';
const adminPassB = 'CnvAdminPwd_2';

const insideSalesA = 'usr_TEST_CNV_ALPHA_IS';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Cnv A',
        tradingName: 'CA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Cnv B',
        tradingName: 'CB',
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
        id: insideSalesA,
        orgId: orgA,
        email: 'is@cnv.test',
        emailDigest: emailDigest('is@cnv.test', process.env.PII_SEARCH_KEY!),
        givenName: 'IS',
        familyName: 'Rep',
        role: 'inside_sales',
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

async function createLead(token: string, key: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/leads',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {
      vertical: 'charity',
      givenName: 'Donor',
      familyName: 'Dee',
      email: `donor-${key}@cnv.test`,
    },
  });
  return res.json().lead.id;
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

describe('POST /v1/conversions — donation', () => {
  it('creates a one-off donation + flips lead to converted + writes audit', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const leadId = await createLead(t, 'cnv-don-create-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cnv-don-1' },
      payload: {
        leadId,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: '5000',
        currency: 'USD',
        paymentProvider: 'micamp',
        paymentExternalId: 'micamp_charge_001',
        donationDetails: {},
      },
    });
    expect(res.statusCode).toBe(201);
    const conv = res.json().conversion;
    expect(conv.id).toMatch(/^cnv_/);
    expect(conv.type).toBe('donation_oneoff');
    expect(conv.attributionSource).toBe('door');
    expect(conv.amountCents).toBe('5000');
    // Door rake = 15% of 5000 = 750.
    expect(conv.d2dRakeCents).toBe('750');
    // MiCamp residual = 0.5% of 5000 = 25.
    expect(conv.processorResidualCents).toBe('25');
    expect(conv.donation).toBeTruthy();
    expect(conv.donation.amountCents).toBe('5000');
    expect(conv.sale).toBeNull();
    // Lead must be flipped to converted.
    const lead = await prisma().lead.findUnique({ where: { id: leadId } });
    expect(lead?.status).toBe('converted');
  });

  it('creates a recurring donation with frequency', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const leadId = await createLead(t, 'cnv-don-create-2');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cnv-don-2' },
      payload: {
        leadId,
        type: 'donation_recurring',
        attributionSource: 'inside_sales',
        amountCents: '10000',
        currency: 'USD',
        paymentProvider: 'micamp',
        donationDetails: { frequency: 'monthly' },
      },
    });
    expect(res.statusCode).toBe(201);
    const conv = res.json().conversion;
    expect(conv.donation.frequency).toBe('monthly');
    // Inside-sales rake = 10% of 10000 = 1000.
    expect(conv.d2dRakeCents).toBe('1000');
  });

  it('rejects donation_oneoff without donationDetails', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const leadId = await createLead(t, 'cnv-don-noattr-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cnv-don-no-3' },
      payload: {
        leadId,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: '1000',
        currency: 'USD',
        paymentProvider: 'micamp',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/conversions — sale', () => {
  it('creates a sale conversion + child Sale row', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const leadId = await createLead(t, 'cnv-sale-create-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cnv-sale-1' },
      payload: {
        leadId,
        type: 'sale_commercial',
        attributionSource: 'retargeting',
        amountCents: '500000',
        currency: 'USD',
        paymentProvider: 'stripe_au',
        saleDetails: { productSku: 'SKU-X-001' },
      },
    });
    expect(res.statusCode).toBe(201);
    const conv = res.json().conversion;
    expect(conv.type).toBe('sale_commercial');
    expect(conv.sale.productSku).toBe('SKU-X-001');
    expect(conv.donation).toBeNull();
    // Retargeting rake = 5% of 500000 = 25000.
    expect(conv.d2dRakeCents).toBe('25000');
    // Stripe AU → processor residual = 0.
    expect(conv.processorResidualCents).toBe('0');
  });

  it('rejects sale_commercial without saleDetails', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const leadId = await createLead(t, 'cnv-sale-nodet-lead');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cnv-sale-nodet-cnv' },
      payload: {
        leadId,
        type: 'sale_commercial',
        attributionSource: 'door',
        amountCents: '1000',
        currency: 'USD',
        paymentProvider: 'stripe_au',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Tenant isolation + auth', () => {
  it("forbids creating a conversion against another org's lead", async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const leadId = await createLead(tA, 'cnv-iso-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${tB}`, 'idempotency-key': 'cnv-iso-2' },
      payload: {
        leadId,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: '100',
        currency: 'USD',
        paymentProvider: 'micamp',
        donationDetails: {},
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('requires Idempotency-Key', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const leadId = await createLead(t, 'cnv-idem-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}` },
      payload: {
        leadId,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: '100',
        currency: 'USD',
        paymentProvider: 'micamp',
        donationDetails: {},
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/conversions',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /v1/conversions + GET /v1/conversions/:id', () => {
  it('lists conversions scoped to org', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const leadId = await createLead(tA, 'cnv-list-1');
    await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'cnv-list-2' },
      payload: {
        leadId,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: '1000',
        currency: 'USD',
        paymentProvider: 'micamp',
        donationDetails: {},
      },
    });
    const a = await app.inject({
      method: 'GET',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(a.statusCode).toBe(200);
    expect(a.json().data).toHaveLength(1);
    const b = await app.inject({
      method: 'GET',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(b.json().data).toEqual([]);
  });

  it('reads one conversion + cross-tenant 403', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const leadId = await createLead(tA, 'cnv-read-1');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'cnv-read-2' },
      payload: {
        leadId,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: '1000',
        currency: 'USD',
        paymentProvider: 'micamp',
        donationDetails: {},
      },
    });
    const id = created.json().conversion.id;
    const a = await app.inject({
      method: 'GET',
      url: `/v1/conversions/${id}`,
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(a.statusCode).toBe(200);
    const b = await app.inject({
      method: 'GET',
      url: `/v1/conversions/${id}`,
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(b.statusCode).toBe(403);
  });
});

describe('Stub endpoints', () => {
  it('POST /:id/refund returns 501', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions/anything/refund',
      headers: { authorization: `Bearer ${t}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });

  it('POST /:id/dispute returns 501', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions/anything/dispute',
      headers: { authorization: `Bearer ${t}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });
});
