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
  it('returns 403 cross-tenant (RFC 7807 tenant-mismatch)', async () => {
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
    expect(peek.statusCode).toBe(403);
    expect(peek.json().type).toBe('https://docs.d2d.io/problems/tenant-mismatch');
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

describe('GET /v1/territories/assigned', () => {
  const knockerId = 'usr_TEST_TER_ASSIGNED_KNOCKER';
  const knockerEmail = 'assigned-knocker@territory.test';
  const knockerPwd = 'AssignedKnockerPwd_1';

  async function makeKnocker(): Promise<void> {
    await prisma().user.create({
      data: {
        id: knockerId,
        orgId: orgA,
        email: knockerEmail,
        emailDigest: emailDigest(knockerEmail, process.env.PII_SEARCH_KEY!),
        givenName: 'Assigned',
        familyName: 'Knocker',
        role: 'knocker',
        regionCode: 'US',
      },
    });
    await setUserPassword(knockerId, knockerPwd);
  }

  async function createAndAssign(
    name: string,
    opts: { assign?: boolean; expiresAt?: string; status?: string } = {},
  ): Promise<string> {
    // Idempotency-Key charset is [a-zA-Z0-9._-] — slug out the name's spaces.
    const slug = name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const adminToken = await tokenFor(emailA, passwordA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/territories',
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': `assigned-${slug}` },
      payload: { name, vertical: 'charity', polygonWkt: samplePolygon },
    });
    const tid = created.json().territory.id;
    if (opts.status && opts.status !== 'active') {
      await prisma().territory.update({ where: { id: tid }, data: { status: opts.status } });
    }
    if (opts.assign) {
      await app.inject({
        method: 'POST',
        url: `/v1/territories/${tid}/assignments`,
        headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': `assign-${slug}` },
        payload: { userId: knockerId, ...(opts.expiresAt && { expiresAt: opts.expiresAt }) },
      });
    }
    return tid;
  }

  it('returns active, non-expired assigned territories as a bare array, ordered by name', async () => {
    await makeKnocker();
    await createAndAssign('Zulu Ward', { assign: true });
    await createAndAssign('Alpha Ward', { assign: true });
    await createAndAssign('Unassigned Ward', { assign: false });

    const token = await tokenFor(knockerEmail, knockerPwd);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/territories/assigned',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((t: { name: string }) => t.name)).toEqual(['Alpha Ward', 'Zulu Ward']);
    expect(body[0]).toEqual({
      id: expect.stringMatching(/^ter_/),
      name: 'Alpha Ward',
      vertical: 'charity',
      polygon: samplePolygon,
      centroid: expect.any(String),
      campaignId: null,
      status: 'active',
    });
  });

  it('excludes expired and just-revoked assignments', async () => {
    await makeKnocker();
    // Expired in the past.
    await createAndAssign('Past Ward', { assign: true, expiresAt: '2020-01-01T00:00:00.000Z' });
    // Live, then revoke (sets expiresAt = now).
    const adminToken = await tokenFor(emailA, passwordA);
    const tid = await createAndAssign('Revoked Ward', { assign: true });
    const ter = await app.inject({
      method: 'GET',
      url: `/v1/territories/${tid}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const aid = ter.json().territory.assignments[0].id;
    await app.inject({
      method: 'DELETE',
      url: `/v1/territories/${tid}/assignments/${aid}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const token = await tokenFor(knockerEmail, knockerPwd);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/territories/assigned',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('excludes non-active territories even when assigned', async () => {
    await makeKnocker();
    await createAndAssign('Paused Ward', { assign: true, status: 'paused' });

    const token = await tokenFor(knockerEmail, knockerPwd);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/territories/assigned',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('is tenant-scoped — a knocker never sees another org\'s assignments', async () => {
    await makeKnocker();
    // Assign an orgA territory to the orgA knocker.
    await createAndAssign('Org A Ward', { assign: true });
    // orgB admin has no assignments and must see an empty array, not orgA's.
    const tokenB = await tokenFor(emailB, passwordB);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/territories/assigned',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 401 when JWT missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/territories/assigned' });
    expect(res.statusCode).toBe(401);
  });

  it('does not let GET /:id capture the literal "assigned" segment', async () => {
    await makeKnocker();
    const token = await tokenFor(knockerEmail, knockerPwd);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/territories/assigned',
      headers: { authorization: `Bearer ${token}` },
    });
    // A /:id hit would 404 (no territory "assigned"); a 200 array proves the
    // static route wins.
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
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
