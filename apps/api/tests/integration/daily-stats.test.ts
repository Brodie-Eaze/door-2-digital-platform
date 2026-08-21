/**
 * Daily-stats integration tests — GET /v1/users/:userId/daily-stats.
 *
 * Covers: happy path (live counts from Knock/Conversion/Commission), the
 * self-only vs admin authorization gate, cross-tenant isolation, the
 * leaderboard ranking + isYou flag, and the JWT requirement.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_STATS_ALPHA';
const orgB = 'org_TEST_STATS_BRAVO';

const managerA = 'usr_TEST_STATS_MGR';
const managerEmailA = 'mgr@stats.test';
const managerPassA = 'StatsMgrPwd_1';

const knockerA = 'usr_TEST_STATS_K1';
const knockerEmailA = 'k1@stats.test';
const knockerPassA = 'StatsK1Pwd_1';

const knockerA2 = 'usr_TEST_STATS_K2';
const knockerEmailA2 = 'k2@stats.test';
const knockerPassA2 = 'StatsK2Pwd_1';

const knockerB = 'usr_TEST_STATS_KB';
const knockerEmailB = 'kb@stats.test';
const knockerPassB = 'StatsKBPwd_1';

const territoryA = 'ter_TEST_STATS_A';
const addressA = 'adr_TEST_STATS_A';
const sessionA = 'sess_TEST_STATS_A';
const planA = 'plan_TEST_STATS_A';

function user(id: string, orgId: string, email: string, given: string, family: string) {
  return {
    id,
    orgId,
    email,
    emailDigest: emailDigest(email, process.env.PII_SEARCH_KEY!),
    givenName: given,
    familyName: family,
    role: 'knocker' as const,
    regionCode: 'US' as const,
  };
}

async function makeKnock(userId: string, orgId: string): Promise<void> {
  await prisma().knock.create({
    data: {
      id: newId('knk'),
      sessionId: sessionA,
      orgId,
      userId,
      territoryId: territoryA,
      addressId: addressA,
      regionCode: 'US',
      disposition: 'no_answer',
      capturedAt: new Date(),
      idempotencyKey: newId('knkidem'),
    },
  });
}

async function makeConversion(
  knockerId: string,
  orgId: string,
  leadId: string,
  amountCents: bigint,
): Promise<void> {
  await prisma().lead.create({
    data: {
      id: leadId,
      orgId,
      regionCode: 'US',
      status: 'converted',
      vertical: 'charity',
      givenName: 'Donor',
      familyName: 'X',
    },
  });
  await prisma().conversion.create({
    data: {
      id: newId('cnv'),
      orgId,
      regionCode: 'US',
      leadId,
      knockerId,
      type: 'donation_oneoff',
      attributionSource: 'door',
      amountCents,
      currency: 'USD',
      signedAt: new Date(),
      paymentProvider: 'micamp',
      idempotencyKey: newId('cnvidem'),
    },
  });
}

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Stats A',
        tradingName: 'SA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Stats B',
        tradingName: 'SB',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    ],
  });
  await prisma().user.createMany({
    data: [
      { ...user(managerA, orgA, managerEmailA, 'Mona', 'Manager'), role: 'manager' },
      user(knockerA, orgA, knockerEmailA, 'Kris', 'Knocker'),
      user(knockerA2, orgA, knockerEmailA2, 'Kim', 'Knight'),
      user(knockerB, orgB, knockerEmailB, 'Ben', 'Bravo'),
    ],
  });
  await setUserPassword(managerA, managerPassA);
  await setUserPassword(knockerA, knockerPassA);
  await setUserPassword(knockerA2, knockerPassA2);
  await setUserPassword(knockerB, knockerPassB);

  await prisma().address.create({
    data: {
      id: addressA,
      regionCode: 'US',
      formatted: '1 Test St, Townsville, CA 90001, US',
      street: '1 Test St',
      locality: 'Townsville',
      region: 'CA',
      postcode: '90001',
      countryCode: 'US',
      hashKey: `hash_${addressA}`,
    },
  });
  await prisma().territory.create({
    data: { id: territoryA, orgId: orgA, regionCode: 'US', name: 'T1', vertical: 'charity' },
  });
  await prisma().knockSession.create({
    data: {
      id: sessionA,
      orgId: orgA,
      userId: knockerA,
      territoryId: territoryA,
      regionCode: 'US',
      startedAt: new Date(),
      deviceId: 'dev-1',
    },
  });
  await prisma().commissionPlan.create({
    data: {
      id: planA,
      orgId: orgA,
      name: 'Plan A',
      vertical: 'charity',
      rules: {},
      effectiveFrom: new Date(),
    },
  });

  // knockerA: 2 knocks + 1 conversion ($150) + $25 commission today.
  await makeKnock(knockerA, orgA);
  await makeKnock(knockerA, orgA);
  await makeConversion(knockerA, orgA, 'lead_TEST_STATS_A1', 15_000n);
  await prisma().commission.create({
    data: {
      id: newId('com'),
      orgId: orgA,
      userId: knockerA,
      planId: planA,
      type: 'per_conversion',
      amountCents: 2_500n,
      currency: 'USD',
      periodStart: new Date(),
      periodEnd: new Date(),
    },
  });

  // knockerA2: 1 knock, no conversions today (zero-conversion → not ranked).
  await prisma().knockSession.create({
    data: {
      id: 'sess_TEST_STATS_A2',
      orgId: orgA,
      userId: knockerA2,
      territoryId: territoryA,
      regionCode: 'US',
      startedAt: new Date(),
      deviceId: 'dev-2',
    },
  });
  await prisma().knock.create({
    data: {
      id: newId('knk'),
      sessionId: 'sess_TEST_STATS_A2',
      orgId: orgA,
      userId: knockerA2,
      territoryId: territoryA,
      addressId: addressA,
      regionCode: 'US',
      disposition: 'no_answer',
      capturedAt: new Date(),
      idempotencyKey: newId('knkidem'),
    },
  });

  // knockerB (other org): activity that must never leak into org A's stats.
  await makeConversion(knockerB, orgB, 'lead_TEST_STATS_B1', 99_999n);
}

async function tokenFor(email: string, password: string): Promise<string> {
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
  await seed();
});

describe('GET /v1/users/:userId/daily-stats', () => {
  it('returns live counts for the caller (self)', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.knocksToday).toBe(2);
    expect(body.conversionsToday).toBe(1);
    expect(body.commissionCentsToday).toBe(2_500);
    expect(body.revenueCentsToday).toBe(15_000);
    expect(typeof body.knocksYesterday).toBe('number');
    expect(body.knocksYesterday).toBe(0);
  });

  it('ranks the leaderboard by conversionsToday and flags isYou', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    const body = res.json();
    expect(body.leaderboardRank).toBe(1);
    expect(Array.isArray(body.leaderboard)).toBe(true);
    // Only knockerA has a conversion today → exactly one board entry, isYou.
    expect(body.leaderboard).toHaveLength(1);
    expect(body.leaderboard[0]).toMatchObject({
      userId: knockerA,
      knocks: 2,
      conversions: 1,
      isYou: true,
    });
    // Name = full given + family initial (in-org read boundary).
    expect(body.leaderboard[0].name).toBe('Kris K.');
  });

  it('a knocker with no conversions today has null rank', async () => {
    const t = await tokenFor(knockerEmailA2, knockerPassA2);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA2}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    const body = res.json();
    expect(body.conversionsToday).toBe(0);
    expect(body.leaderboardRank).toBeNull();
    // The org leaderboard still lists the ranked user(s).
    expect(body.leaderboard).toHaveLength(1);
    expect(body.leaderboard[0].isYou).toBe(false);
  });

  it('does not leak another org’s activity', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    const body = res.json();
    // orgB had a $999.99 conversion — must not appear in org A's revenue.
    expect(body.revenueCentsToday).toBe(15_000);
    expect(body.leaderboard.every((e: { userId: string }) => e.userId !== knockerB)).toBe(true);
  });

  it('rejects a knocker reading another user’s stats (403)', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA2}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows a manager to read another user’s stats in-org', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().knocksToday).toBe(2);
  });

  it('404s on a userId outside the caller’s org (manager)', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerB}/daily-stats`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('requires a JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${knockerA}/daily-stats`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /v1/notifications/inbox', () => {
  it('returns an empty array (no inbox model yet) for an authed user', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/notifications/inbox',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('requires a JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/notifications/inbox' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /v1/leads/callbacks', () => {
  it('returns an empty array (no callback model yet) for an authed user', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/leads/callbacks',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('requires a JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/leads/callbacks' });
    expect(res.statusCode).toBe(401);
  });
});
