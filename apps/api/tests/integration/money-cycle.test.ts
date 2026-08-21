/**
 * Money-cycle integration proof (D6 evidence).
 *
 * conversion → commission accrual (plan DSL, BigInt cents) → payout batch
 * (dry-run then draft) — reconciled to the cent, idempotent per period, and
 * the movement gates (lock / instruction file) hard-require WebAuthn step-up:
 * money is computed by machine, moved only by a human.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_MONEY_ALPHA';
const userA = 'usr_TEST_MONEY_ALPHA';
const emailA = 'admin@money.test';
const passwordA = 'MoneyAdminPwd_1';

async function seed(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgA,
      legalName: 'MA',
      tradingName: 'MA',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
  });
  await prisma().user.create({
    data: {
      id: userA,
      orgId: orgA,
      email: emailA,
      emailDigest: emailDigest(emailA, process.env.PII_SEARCH_KEY ?? ''),
      givenName: 'Money',
      familyName: 'Admin',
      role: 'org_admin',
      regionCode: 'US',
      status: 'active',
    },
  });
  await setUserPassword(userA, passwordA);
  // 10% per-conversion plan, effective since yesterday.
  await prisma().commissionPlan.create({
    data: {
      id: newId('plan'),
      orgId: orgA,
      name: 'Standard 10%',
      vertical: 'charity',
      rules: {
        version: 'v0.1',
        currency: 'USD',
        rules: [{ type: 'per_conversion', percent: 10 }],
      },
      effectiveFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
}

async function login(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: emailA, password: passwordA },
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { accessToken: string }).accessToken;
}

async function createLead(token: string, key: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/leads',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {
      vertical: 'charity',
      givenName: 'Donor',
      familyName: 'Cycle',
      email: `donor-${key}@money.test`,
    },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { lead: { id: string } }).lead.id;
}

async function createConversion(token: string, key: string, amountCents: string): Promise<string> {
  const leadId = await createLead(token, `lead-${key}`);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/conversions',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {
      leadId,
      type: 'donation_oneoff',
      attributionSource: 'door',
      amountCents,
      currency: 'USD',
      paymentProvider: 'micamp',
      paymentExternalId: `micamp_${key}`,
      donationDetails: {},
    },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { conversion: { id: string } }).conversion.id;
}

function periodBody(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  return {
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
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

describe('money cycle — conversion → commission → payout batch', () => {
  it('accrues exact BigInt commissions and reconciles the batch to the cent', async () => {
    const token = await login();

    // $2,000.00 and $1,000.50 at 10% → $200.00 + $100.05 = $300.05 exactly.
    await createConversion(token, 'cnv-money-1', '200000');
    await createConversion(token, 'cnv-money-2', '100050');

    const commissions = await prisma().commission.findMany({
      where: { orgId: orgA },
      orderBy: { amountCents: 'desc' },
    });
    expect(commissions).toHaveLength(2);
    expect(commissions[0]?.amountCents).toBe(20000n);
    expect(commissions[1]?.amountCents).toBe(10005n);
    expect(commissions.every((c) => c.status === 'accrued')).toBe(true);

    // Dry-run: totals computed, nothing written.
    const dry = await app.inject({
      method: 'POST',
      url: '/v1/payout-batches',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_pay_dry' },
      payload: { ...periodBody(), dryRun: true },
    });
    expect(dry.statusCode).toBe(201);
    const dryBatch = (dry.json() as { batch: { totalCents: string; lineCount: number } }).batch;
    expect(dryBatch.totalCents).toBe('30005');
    expect(dryBatch.lineCount).toBe(2);
    expect(await prisma().payoutBatch.count()).toBe(0);

    // Real batch: draft, reconciles to the cent against the accrued rows.
    const real = await app.inject({
      method: 'POST',
      url: '/v1/payout-batches',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_pay_real' },
      payload: periodBody(),
    });
    expect(real.statusCode).toBe(201);
    const batch = (real.json() as { batch: { id: string; totalCents: string; status: string } })
      .batch;
    expect(batch.status).toBe('draft');
    expect(batch.totalCents).toBe('30005');

    const dbSum = await prisma().commission.aggregate({
      where: { orgId: orgA },
      _sum: { amountCents: true },
    });
    expect((dbSum._sum.amountCents ?? 0n).toString()).toBe(batch.totalCents);
  });

  it('a second batch for the same period is refused (409) — no double payout', async () => {
    const token = await login();
    await createConversion(token, 'cnv-money-3', '150000');

    const first = await app.inject({
      method: 'POST',
      url: '/v1/payout-batches',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_pay_a' },
      payload: periodBody(),
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/payout-batches',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_pay_b' },
      payload: periodBody(),
    });
    expect(second.statusCode).toBe(409);
  });

  it('money MOVEMENT is human-gated: lock + instruction file demand WebAuthn step-up', async () => {
    const token = await login();
    await createConversion(token, 'cnv-money-4', '120000');

    const real = await app.inject({
      method: 'POST',
      url: '/v1/payout-batches',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_pay_gate' },
      payload: periodBody(),
    });
    expect(real.statusCode).toBe(201);
    const batchId = (real.json() as { batch: { id: string } }).batch.id;

    // A plain JWT (no hardware-key step-up) must NOT be able to lock the batch
    // or download the bank instruction file.
    const lock = await app.inject({
      method: 'POST',
      url: `/v1/payout-batches/${batchId}/lock`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_pay_lock' },
    });
    expect([401, 403]).toContain(lock.statusCode);

    const file = await app.inject({
      method: 'GET',
      url: `/v1/payout-batches/${batchId}/instruction-file`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(file.statusCode);

    // And the batch is still an unmoved draft.
    const row = await prisma().payoutBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(row.status).toBe('draft');
    expect(row.instructedAt).toBeNull();
  });
});
