/**
 * Compliance state-clearance gate — the legal P0 proof.
 *
 *   (a) A charity conversion whose campaign is NOT cleared for the donor's
 *       state → 409 PROBLEM_STATE_NOT_CLEARED, and NO Conversion row written.
 *   (b) After an approved paid-solicitor registration + clearance for that
 *       state, the SAME conversion succeeds.
 *   (c) Commercial sales (no campaignId) skip the gate.
 *   (d) Registration status state-machine + clearance fan-out (service layer).
 *
 * The compliance HTTP routes are not mounted in buildTestApp, so registration
 * filing/approval is exercised through the service layer (fileRegistration /
 * transitionRegistration) — the same code the routes call. The gate itself is
 * proven end-to-end through POST /v1/conversions.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import {
  fileRegistration,
  transitionRegistration,
  assertStateCleared,
} from '../../src/domains/compliance/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId, ProblemError } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_CLR_ALPHA';
const adminA = 'usr_TEST_CLR_ALPHA_ADMIN';
const adminEmailA = 'admin@clr.test';
const adminPassA = 'ClrAdminPwd_1';

// Campaign + address are created per-test; their IDs must satisfy idSchema
// (>= 20 chars) when passed in the conversion request body.
let campaignId: string;
let addressId: string;
let leadIdCA: string; // lead whose address.region = 'CA'

const actor = { userId: adminA, orgId: orgA, regionCode: 'US' as const };

async function seed(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgA,
      legalName: 'Clr A',
      tradingName: 'CA',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
  });
  await prisma().user.create({
    data: {
      id: adminA,
      orgId: orgA,
      email: adminEmailA,
      emailDigest: emailDigest(adminEmailA, process.env.PII_SEARCH_KEY!),
      givenName: 'A',
      familyName: 'Admin',
      role: 'org_admin',
      regionCode: 'US',
    },
  });
  await setUserPassword(adminA, adminPassA);

  campaignId = newId('cmp');
  await prisma().campaign.create({
    data: {
      id: campaignId,
      orgId: orgA,
      regionCode: 'US',
      name: 'Clean Water Drive',
      vertical: 'charity',
    },
  });

  // Authoritative donor state = CA, carried on the lead's address.
  addressId = newId('adr');
  await prisma().address.create({
    data: {
      id: addressId,
      regionCode: 'US',
      formatted: '1 Market St, San Francisco, CA 94105',
      street: '1 Market St',
      locality: 'San Francisco',
      region: 'CA',
      postcode: '94105',
      countryCode: 'US',
      hashKey: newId('hash'),
    },
  });

  leadIdCA = newId('lead');
  await prisma().lead.create({
    data: {
      id: leadIdCA,
      orgId: orgA,
      regionCode: 'US',
      vertical: 'charity',
      campaignId,
      addressId,
      givenName: 'Donor',
      familyName: 'Dee',
    },
  });
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

function donationPayload(leadId: string, campaign: string | null): Record<string, unknown> {
  return {
    leadId,
    ...(campaign ? { campaignId: campaign } : {}),
    type: 'donation_oneoff',
    attributionSource: 'door',
    amountCents: '5000',
    currency: 'USD',
    paymentProvider: 'micamp',
    paymentExternalId: 'micamp_charge_clr',
    donationDetails: {},
  };
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

describe('State-clearance gate on POST /v1/conversions', () => {
  it('(a) blocks a charity conversion when the campaign is NOT cleared for the donor state — 409 + no row', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'clr-blocked-1' },
      payload: donationPayload(leadIdCA, campaignId),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().type).toBe('https://docs.d2d.io/problems/state-not-cleared');
    expect(res.json().state).toBe('CA');
    // The gate must fire BEFORE any row is written.
    const count = await prisma().conversion.count({ where: { leadId: leadIdCA } });
    expect(count).toBe(0);
  });

  it('(b) allows the SAME conversion after an approved registration + clearance', async () => {
    // File + approve a paid-solicitor registration for CA → clears the campaign.
    const reg = await fileRegistration({ campaignId, state: 'CA' }, actor);
    expect(reg.status).toBe('pending');
    const approved = await transitionRegistration(reg.id, 'approved', actor);
    expect(approved.status).toBe('approved');

    // Clearance row now exists for (campaign, CA), backed by the registration.
    await expect(assertStateCleared(orgA, campaignId, 'CA')).resolves.toBeUndefined();

    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'clr-allowed-1' },
      payload: donationPayload(leadIdCA, campaignId),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().conversion.id).toMatch(/^cnv_/);
    const count = await prisma().conversion.count({ where: { leadId: leadIdCA } });
    expect(count).toBe(1);
  });

  it('(c) commercial sale with no campaignId skips the gate', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/conversions',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'clr-sale-1' },
      payload: {
        leadId: leadIdCA,
        type: 'sale_commercial',
        attributionSource: 'door',
        amountCents: '500000',
        currency: 'USD',
        paymentProvider: 'stripe_au',
        saleDetails: { productSku: 'SKU-1' },
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('assertStateCleared resolution rules', () => {
  it('resolves when no campaignId is present (commercial path)', async () => {
    await expect(assertStateCleared(orgA, null, 'CA')).resolves.toBeUndefined();
    await expect(assertStateCleared(orgA, undefined, undefined)).resolves.toBeUndefined();
  });

  it('fails closed when a campaign is present but donor state is unknown', async () => {
    await expect(assertStateCleared(orgA, campaignId, null)).rejects.toBeInstanceOf(ProblemError);
  });

  it('does not treat an expired registration as cleared', async () => {
    const reg = await fileRegistration({ campaignId, state: 'CA' }, actor);
    await transitionRegistration(reg.id, 'approved', actor);
    // Force the backing registration past expiry.
    await prisma().paidSolicitorRegistration.update({
      where: { id: reg.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expect(assertStateCleared(orgA, campaignId, 'CA')).rejects.toBeInstanceOf(ProblemError);
  });
});

describe('Registration status state-machine', () => {
  it('rejects an invalid transition (pending → expired)', async () => {
    const reg = await fileRegistration({ campaignId, state: 'NY' }, actor);
    await expect(transitionRegistration(reg.id, 'expired', actor)).rejects.toMatchObject({
      problem: { status: 409 },
    });
  });

  it('rejects transitioning a terminal (rejected) registration', async () => {
    const reg = await fileRegistration({ campaignId, state: 'NY' }, actor);
    await transitionRegistration(reg.id, 'rejected', actor);
    await expect(transitionRegistration(reg.id, 'approved', actor)).rejects.toMatchObject({
      problem: { status: 409 },
    });
  });

  it('approval fans out clearance to every campaign of the client org', async () => {
    // Second campaign in the same org → both clear for CA on approval.
    const campaign2 = newId('cmp');
    await prisma().campaign.create({
      data: {
        id: campaign2,
        orgId: orgA,
        regionCode: 'US',
        name: 'Second Drive',
        vertical: 'charity',
      },
    });
    const reg = await fileRegistration({ campaignId, state: 'CA' }, actor);
    await transitionRegistration(reg.id, 'approved', actor);

    const matrix = await prisma().campaignStateClearance.findMany({
      where: { state: 'CA' },
      select: { campaignId: true },
    });
    const ids = matrix.map((m) => m.campaignId).sort();
    expect(ids).toEqual([campaignId, campaign2].sort());
  });

  it('rejects filing against another org’s campaign', async () => {
    const otherOrg = 'org_TEST_CLR_OTHER';
    await prisma().org.create({
      data: {
        id: otherOrg,
        legalName: 'Other',
        tradingName: 'OT',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    });
    // cross-tenant campaign → 404 (Problems.tenantMismatch), NOT 403: a foreign
    // campaign id must be indistinguishable from a non-existent one.
    await expect(
      fileRegistration({ campaignId, state: 'CA' }, { ...actor, orgId: otherOrg }),
    ).rejects.toMatchObject({ problem: { status: 404 } });
  });
});
