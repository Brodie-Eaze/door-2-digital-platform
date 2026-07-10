/**
 * Territory integration tests — create, list, read, patch, assignments,
 * heatmap. Covers idempotency replay, tenant isolation, JWT requirement,
 * polygon immutability + WKT parser validation.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_TER_A';
const userA = 'usr_TEST_TER_A';
const emailA = 'admin@territory.test';
const passwordA = 'TerritoryAdminPwd_1';

const orgB = 'org_TEST_TER_B';
const userB = 'usr_TEST_TER_B';
const emailB = 'other@territory.test';
const passwordB = 'TerritoryAdminPwd_2';

const samplePolygon =
  'POLYGON((-97.7 30.27, -97.69 30.27, -97.69 30.28, -97.7 30.28, -97.7 30.27))';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Territory A',
        tradingName: 'A',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Territory B',
        tradingName: 'B',
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
        givenName: 'Ter',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: userB,
        orgId: orgB,
        email: emailB,
        emailDigest: emailDigest(emailB, process.env.PII_SEARCH_KEY!),
        givenName: 'Other',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
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

describe('POST /v1/territories', () => {
  it('creates a territory with computed centroid + s2 cells', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'ter-create-1',
      },
      payload: {
        name: 'Downtown Austin',
        vertical: 'charity',
        polygonWkt: samplePolygon,
        metadata: { seifaDecile: 7 },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.territory.id).toMatch(/^ter_/);
    expect(body.territory.orgId).toBe(orgA);
    expect(body.territory.polygonWkt).toBe(samplePolygon);
    expect(body.territory.centroid).toEqual({ lng: expect.any(Number), lat: expect.any(Number) });
    expect(body.territory.s2CellIds.length).toBeGreaterThan(0);
    expect(body.territory.metadata.seifaDecile).toBe(7);
  });

  it('rejects when Idempotency-Key header missing', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Downtown Austin',
        vertical: 'charity',
        polygonWkt: samplePolygon,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe('https://docs.d2d.io/problems/validation-failed');
  });

  it('returns 401 when JWT missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { 'idempotency-key': 'ter-create-noauth' },
      payload: {
        name: 'Downtown',
        vertical: 'charity',
        polygonWkt: samplePolygon,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid WKT polygon (open ring)', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'ter-create-bad-polygon',
      },
      payload: {
        name: 'Bad polygon',
        vertical: 'charity',
        polygonWkt: 'POLYGON((-97.7 30.27, -97.69 30.27, -97.69 30.28, -97.7 30.28))',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('replays cached response on idempotency-key reuse', async () => {
    const token = await tokenFor(emailA, passwordA);
    const payload = {
      name: 'Replay test',
      vertical: 'charity' as const,
      polygonWkt: samplePolygon,
    };
    const first = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-replay-1' },
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-replay-1' },
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().territory.id).toBe(first.json().territory.id);
  });

  it('returns 400 when Zod input invalid (missing vertical)', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'ter-create-bad-zod',
      },
      payload: { name: 'Missing vertical', polygonWkt: samplePolygon },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /v1/territories', () => {
  it('lists territories scoped to actor org only (tenant isolation)', async () => {
    const tokenA = await tokenFor(emailA, passwordA);
    const tokenB = await tokenFor(emailB, passwordB);
    await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': 'ter-list-a-1' },
      payload: { name: 'A1', vertical: 'charity', polygonWkt: samplePolygon },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${tokenB}`, 'idempotency-key': 'ter-list-b-1' },
      payload: { name: 'B1', vertical: 'charity', polygonWkt: samplePolygon },
    });
    const resA = await app.inject({
      method: 'GET',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resA.statusCode).toBe(200);
    const bodyA = resA.json();
    expect(bodyA.data.length).toBe(1);
    expect(bodyA.data[0].name).toBe('A1');
  });
});

describe('GET /v1/territories/:id', () => {
  it('returns 404 cross-tenant (RLS belt withholds existence, not 403)', async () => {
    // Under the §4b RLS belt, org B reading org A's territory sees null (the
    // row is invisible at the GUC-pinned read), so we 404 rather than 403:
    // disclosing "this exists but isn't yours" would leak cross-tenant
    // existence, which is exactly what tenant isolation must prevent.
    const tokenA = await tokenFor(emailA, passwordA);
    const tokenB = await tokenFor(emailB, passwordB);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': 'ter-x-tenant-1' },
      payload: { name: 'Hidden', vertical: 'charity', polygonWkt: samplePolygon },
    });
    const id = created.json().territory.id;
    const peek = await app.inject({
      method: 'GET',
      url: `/v1/territories/${id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(peek.statusCode).toBe(404);
    expect(peek.json().type).toBe('https://docs.d2d.io/problems/not-found');
  });
});

describe('PATCH /v1/territories/:id', () => {
  it('updates name + status, rejects polygon edit', async () => {
    const token = await tokenFor(emailA, passwordA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-patch-1' },
      payload: { name: 'Patchable', vertical: 'charity', polygonWkt: samplePolygon },
    });
    const id = created.json().territory.id;
    const ok = await app.inject({
      method: 'PATCH',
      url: `/v1/territories/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Patched', status: 'paused' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().territory.name).toBe('Patched');
    expect(ok.json().territory.status).toBe('paused');

    const bad = await app.inject({
      method: 'PATCH',
      url: `/v1/territories/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { polygonWkt: samplePolygon },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe('Territory assignments', () => {
  it('add + revoke (soft-delete via expiresAt=now)', async () => {
    const token = await tokenFor(emailA, passwordA);
    // Make a knocker in the same org.
    const knockerId = 'usr_TEST_TERRITORY_KNOCKER_01';
    await prisma().user.create({
      data: {
        id: knockerId,
        orgId: orgA,
        email: 'k@territory.test',
        emailDigest: emailDigest('k@territory.test', process.env.PII_SEARCH_KEY!),
        givenName: 'K',
        familyName: 'Nock',
        role: 'knocker',
        regionCode: 'US',
      },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-assign-1' },
      payload: { name: 'Assignable', vertical: 'charity', polygonWkt: samplePolygon },
    });
    const tid = created.json().territory.id;
    const assign = await app.inject({
      method: 'POST',
      url: `/v1/territories/${tid}/assignments`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'ter-assign-2',
      },
      payload: { userId: knockerId },
    });
    expect(assign.statusCode).toBe(201);
    const aid = assign.json().assignment.id;
    expect(assign.json().assignment.expiresAt).toBeNull();

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/v1/territories/${tid}/assignments/${aid}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().assignment.expiresAt).toBeTypeOf('string');
  });

  it('rejects assigning a user from another org', async () => {
    const token = await tokenFor(emailA, passwordA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-assign-xtnt-1' },
      payload: { name: 'Test', vertical: 'charity', polygonWkt: samplePolygon },
    });
    const tid = created.json().territory.id;
    const res = await app.inject({
      method: 'POST',
      url: `/v1/territories/${tid}/assignments`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-assign-xtnt-2' },
      payload: { userId: userB },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /v1/territories/heatmap', () => {
  it('returns a bbox-scoped knock-density aggregate (mock)', async () => {
    const token = await tokenFor(emailA, passwordA);
    await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'ter-heat-1' },
      payload: { name: 'HeatA', vertical: 'charity', polygonWkt: samplePolygon },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/territories/heatmap?bbox=-98,30,-97,31',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.layer).toBe('knock-density');
    expect(body.cells.length).toBeGreaterThan(0);
    expect(body.cells[0]).toEqual({
      cellId: expect.any(String),
      count: expect.any(Number),
      centroid: { lng: expect.any(Number), lat: expect.any(Number) },
    });
  });
});

describe('POST /v1/territories/:id/draft', () => {
  it('returns 501 — draft workflow still pending', async () => {
    const token = await tokenFor(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/territories/ter_anything/draft',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });
});
