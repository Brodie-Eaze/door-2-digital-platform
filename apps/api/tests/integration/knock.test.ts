/**
 * Knock integration tests — sessions, single knock, batch reconcile,
 * list, get. Covers Address upsert, idempotency dedupe (header + per-knock),
 * tenant isolation, JWT requirement, batch dedup behaviour.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_KNOCK_ALPHA';
const userA = 'usr_TEST_KNOCK_ALPHA_ADMIN';
const emailA = 'admin@knock.test';
const passwordA = 'KnockAdminPwd_1';

const orgB = 'org_TEST_KNOCK_BRAVO';
const userB = 'usr_TEST_KNOCK_BRAVO_ADMIN';
const emailB = 'b@knock.test';
const passwordB = 'KnockAdminPwd_2';

const territoryA = 'ter_TEST_KNOCK_ALPHA_01';
const territoryB = 'ter_TEST_KNOCK_BRAVO_01';

const wkt = 'POLYGON((-97.7 30.27, -97.69 30.27, -97.69 30.28, -97.7 30.28, -97.7 30.27))';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'KA',
        tradingName: 'KA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'KB',
        tradingName: 'KB',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    ],
  });
  await prisma().user.createMany({
    data: [
      {
        id: userA,
        orgId: orgA,
        email: emailA,
        emailDigest: emailDigest(emailA, process.env.PII_SEARCH_KEY!),
        givenName: 'Knock',
        familyName: 'A',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: userB,
        orgId: orgB,
        email: emailB,
        emailDigest: emailDigest(emailB, process.env.PII_SEARCH_KEY!),
        givenName: 'Knock',
        familyName: 'B',
        role: 'org_admin',
        regionCode: 'US',
      },
    ],
  });
  await prisma().territory.createMany({
    data: [
      {
        id: territoryA,
        orgId: orgA,
        regionCode: 'US',
        name: 'T-A',
        vertical: 'charity',
        polygon: wkt,
        centroid: '-97.695 30.275',
        s2CellIds: ['S2L13_-97.695_30.275'],
      },
      {
        id: territoryB,
        orgId: orgB,
        regionCode: 'US',
        name: 'T-B',
        vertical: 'charity',
        polygon: wkt,
        centroid: '-97.695 30.275',
        s2CellIds: ['S2L13_-97.695_30.275'],
      },
    ],
  });
  await setUserPassword(userA, passwordA);
  await setUserPassword(userB, passwordB);
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

async function startSession(token: string, territoryId: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/sessions',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `sess-helper-${newId()}` },
    payload: {
      territoryId,
      deviceId: 'test-device',
      startGeo: { lat: 30.275, lng: -97.695 },
    },
  });
  return res.json().session.id;
}

function knockPayload(opts: {
  sessionId: string;
  idempotencyKey: string;
  street?: string;
}): Record<string, unknown> {
  return {
    sessionId: opts.sessionId,
    disposition: 'no_answer',
    geo: { lat: 30.275, lng: -97.695, accuracyM: 8 },
    capturedAt: new Date().toISOString(),
    idempotencyKey: opts.idempotencyKey,
    rawAddress: {
      formatted: `${opts.street ?? '123 Main St'}, Austin, TX 78701, USA`,
      street: opts.street ?? '123 Main St',
      locality: 'Austin',
      region: 'TX',
      postcode: '78701',
      countryCode: 'US',
    },
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

describe('POST /v1/sessions', () => {
  it('starts a knock session', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'sess-start-1' },
      payload: {
        territoryId: territoryA,
        deviceId: 'iphone-15-test',
        startGeo: { lat: 30.275, lng: -97.695 },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.session.id).toMatch(/^sess_/);
    expect(body.session.territoryId).toBe(territoryA);
    expect(body.session.endedAt).toBeNull();
  });

  it('rejects starting a session on another tenant territory', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'sess-xtenant-1' },
      payload: {
        territoryId: territoryB,
        deviceId: 'evil-device',
        startGeo: { lat: 30.275, lng: -97.695 },
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 401 without JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { 'idempotency-key': 'sess-noauth' },
      payload: {
        territoryId: territoryA,
        deviceId: 'noauth',
        startGeo: { lat: 30.275, lng: -97.695 },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /sessions/:id/end is idempotent', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);
    const first = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/end`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'sess-end-1' },
      payload: {},
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/end`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'sess-end-1' },
      payload: {},
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().session.endedAt).toBeTypeOf('string');
    expect(second.json().session.endedAt).toBe(first.json().session.endedAt);
  });
});

describe('POST /v1/knocks (single)', () => {
  it('creates a knock and upserts Address', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'knk-header-1' },
      payload: knockPayload({ sessionId, idempotencyKey: 'knk-single-1' }),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.knock.id).toMatch(/^knk_/);
    expect(body.knock.addressId).toMatch(/^adr_/);
    expect(body.knock.disposition).toBe('no_answer');
    expect(body.knock.clientOffsetMs).toBeTypeOf('number');

    const addresses = await prisma().address.count();
    expect(addresses).toBe(1);
  });

  it('rejects when Idempotency-Key header missing', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${token}` },
      payload: knockPayload({ sessionId, idempotencyKey: 'knk-noheader-1' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { 'idempotency-key': 'knk-noauth-1' },
      payload: knockPayload({ sessionId: 'sess_x', idempotencyKey: 'knk-noauth-key-1' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('deduplicates by per-knock idempotencyKey (same row returned)', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);
    const payload = knockPayload({ sessionId, idempotencyKey: 'knk-dup-1' });
    const first = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'header-dup-1' },
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().deduped).toBe(false);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'header-dup-2' },
      payload,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().deduped).toBe(true);
    expect(second.json().knock.id).toBe(first.json().knock.id);
  });

  it('Zod rejects missing geo', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);
    const bad = knockPayload({ sessionId, idempotencyKey: 'knk-bad-zod' });
    delete (bad as { geo?: unknown }).geo;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'knk-bad-zod-h' },
      payload: bad,
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/knocks/batch', () => {
  it('inserts 50 knocks in one call', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);
    const knocks = Array.from({ length: 50 }, (_, i) =>
      knockPayload({ sessionId, idempotencyKey: `knk-batch-${i}`, street: `${i + 1} Test St` }),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks/batch',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'batch-header-1' },
      payload: { knocks },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.inserted).toBe(50);
    expect(body.deduped).toBe(0);
    expect(body.errors).toEqual([]);
    expect(body.knocks).toHaveLength(50);
  });

  it('dedupes within batch and against DB', async () => {
    const token = await tokenFor(emailA, passwordA);
    const sessionId = await startSession(token, territoryA);

    // Pre-insert one knock so its idempotencyKey is already taken.
    await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'batch-pre-1' },
      payload: knockPayload({ sessionId, idempotencyKey: 'shared-key-1' }),
    });

    const knocks = [
      knockPayload({ sessionId, idempotencyKey: 'shared-key-1', street: '99 Pre St' }), // dup vs DB
      knockPayload({ sessionId, idempotencyKey: 'batch-new-1', street: '100 New St' }),
      knockPayload({ sessionId, idempotencyKey: 'batch-new-1', street: '101 InBatch Dup St' }), // dup in batch
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks/batch',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'batch-header-dup-1' },
      payload: { knocks },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.inserted).toBe(1);
    expect(body.deduped).toBe(2);
  });
});

describe('GET /v1/knocks', () => {
  it('lists knocks scoped to actor org only', async () => {
    const tokenA = await tokenFor(emailA, passwordA);
    const sessionA = await startSession(tokenA, territoryA);
    await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': 'knk-list-h-1' },
      payload: knockPayload({ sessionId: sessionA, idempotencyKey: 'knk-list-a-1' }),
    });
    const tokenB = await tokenFor(emailB, passwordB);
    const sessionB = await startSession(tokenB, territoryB);
    await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${tokenB}`, 'idempotency-key': 'knk-list-h-2' },
      payload: knockPayload({ sessionId: sessionB, idempotencyKey: 'knk-list-b-1' }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });
});

describe('GET /v1/knocks/:id', () => {
  it('returns 403 cross-tenant', async () => {
    const tokenA = await tokenFor(emailA, passwordA);
    const tokenB = await tokenFor(emailB, passwordB);
    const sessionA = await startSession(tokenA, territoryA);
    const k = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': 'knk-get-h-1' },
      payload: knockPayload({ sessionId: sessionA, idempotencyKey: 'knk-get-1' }),
    });
    const id = k.json().knock.id;
    const res = await app.inject({
      method: 'GET',
      url: `/v1/knocks/${id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /v1/knocks/:id/contest', () => {
  it('returns 501 stub', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks/knk_test/contest',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });
});
