/**
 * Donation integration tests — read, pause, cancel, change-amount.
 *
 * Each test creates a fresh donation via /v1/conversions then exercises the
 * targeted lifecycle endpoint. Audit trail is verified by querying the
 * AuditEvent table directly.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_DON_ALPHA';
const adminA = 'usr_TEST_DON_ALPHA_ADMIN';
const adminEmailA = 'admin@don.test';
const adminPassA = 'DonAdminPwd_1';

const orgB = 'org_TEST_DON_BRAVO';
const adminB = 'usr_TEST_DON_BRAVO_ADMIN';
const adminEmailB = 'b@don.test';
const adminPassB = 'DonAdminPwd_2';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Don A',
        tradingName: 'DA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Don B',
        tradingName: 'DB',
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

async function createRecurringDonation(token: string, key: string): Promise<string> {
  const leadRes = await app.inject({
    method: 'POST',
    url: '/v1/leads',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `don-lead-${key}` },
    payload: {
      vertical: 'charity',
      givenName: 'Donor',
      familyName: 'Donut',
    },
  });
  const leadId = leadRes.json().lead.id;
  const cnvRes = await app.inject({
    method: 'POST',
    url: '/v1/conversions',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `don-cnv-${key}` },
    payload: {
      leadId,
      type: 'donation_recurring',
      attributionSource: 'door',
      amountCents: '5000',
      currency: 'USD',
      paymentProvider: 'micamp',
      donationDetails: { frequency: 'monthly' },
    },
  });
  return cnvRes.json().conversion.donation.id;
}

async function createOneOffDonation(token: string, key: string): Promise<string> {
  const leadRes = await app.inject({
    method: 'POST',
    url: '/v1/leads',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `don-lead-${key}` },
    payload: { vertical: 'charity', givenName: 'OneOff', familyName: 'Donor' },
  });
  const leadId = leadRes.json().lead.id;
  const cnvRes = await app.inject({
    method: 'POST',
    url: '/v1/conversions',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `don-cnv-${key}` },
    payload: {
      leadId,
      type: 'donation_oneoff',
      attributionSource: 'door',
      amountCents: '2500',
      currency: 'USD',
      paymentProvider: 'micamp',
      donationDetails: {},
    },
  });
  return cnvRes.json().conversion.donation.id;
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

describe('GET /v1/donations/:id', () => {
  it('reads a donation in the actor org', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'read-1');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/donations/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().donation.id).toBe(id);
    expect(res.json().donation.frequency).toBe('monthly');
  });

  it("returns 404 cross-tenant — the donation's parent conversion is invisible (not 403)", async () => {
    // RLS belt (SEC-005): a Donation has no orgId of its own; tenancy lives on its
    // parent Conversion. Org B's read pins the belt to org B, so org A's parent
    // conversion is RLS-invisible → null → 404. We deliberately do NOT return 403:
    // surfacing "this donation exists in another org" is the cross-tenant existence
    // disclosure tenant isolation must withhold.
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const id = await createRecurringDonation(tA, 'iso-1');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/donations/${id}`,
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 unknown id', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/donations/don_nonexistent_id_value_1234',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /v1/donations/:id/pause', () => {
  it('flips status to paused and writes audit', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'pause-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/pause`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-pause-1' },
      payload: { reason: 'donor request' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().donation.status).toBe('paused');
    const audit = await prisma().auditEvent.findFirst({
      where: { resourceType: 'Donation', resourceId: id, action: 'donation.paused' },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects pause on cancelled donation', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'pause-cancel-1');
    await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/cancel`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-pause-cancel-1' },
      payload: { reason: 'fraudulent' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/pause`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-pause-cancel-2' },
      payload: { reason: 'too late' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /v1/donations/:id/cancel', () => {
  it('cancels and sets cancelledAt + writes audit', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'cancel-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/cancel`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-cancel-1' },
      payload: { reason: 'donor passed away' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().donation.status).toBe('cancelled');
    expect(res.json().donation.cancelledAt).toBeTruthy();
    const audit = await prisma().auditEvent.findFirst({
      where: { resourceType: 'Donation', resourceId: id, action: 'donation.cancelled' },
    });
    expect(audit).toBeTruthy();
  });

  it('idempotency replay returns same response', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'cancel-replay-1');
    const first = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/cancel`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-cancel-replay-1' },
      payload: { reason: 'change of plans' },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/cancel`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-cancel-replay-1' },
      payload: { reason: 'change of plans' },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  });
});

describe('POST /v1/donations/:id/change-amount', () => {
  it('updates amount and writes audit', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'change-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/change-amount`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-change-1' },
      payload: { newAmountCents: '7500' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().donation.amountCents).toBe('7500');
    const audit = await prisma().auditEvent.findFirst({
      where: {
        resourceType: 'Donation',
        resourceId: id,
        action: 'donation.amount_changed',
      },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects change on non-recurring donation', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createOneOffDonation(t, 'change-oneoff-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/change-amount`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-change-oneoff-1' },
      payload: { newAmountCents: '5000' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects zero or negative amount', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const id = await createRecurringDonation(t, 'change-zero-1');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/donations/${id}/change-amount`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'don-change-zero-1' },
      payload: { newAmountCents: '0' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Stub endpoints', () => {
  it('POST /:id/resume returns 501', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/donations/don_anything/resume',
      headers: { authorization: `Bearer ${t}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });

  it('POST /:id/receipt returns 501', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/donations/don_anything/receipt',
      headers: { authorization: `Bearer ${t}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });
});
