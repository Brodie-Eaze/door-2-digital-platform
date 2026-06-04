/**
 * Lead integration tests — create (auto-routing), list, get, patch
 * (state machine + invalid transitions), assign, activities. Covers
 * tenant isolation, idempotency, JWT requirement, Zod validation.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_LEAD_ALPHA';
const adminA = 'usr_TEST_LEAD_ALPHA_ADMIN';
const adminEmailA = 'admin@lead.test';
const adminPassA = 'LeadAdminPwd_1';

const insideSales1 = 'usr_TEST_LEAD_ALPHA_IS_01';
const insideSales2 = 'usr_TEST_LEAD_ALPHA_IS_02';

const orgB = 'org_TEST_LEAD_BRAVO';
const adminB = 'usr_TEST_LEAD_BRAVO_ADMIN';
const adminEmailB = 'b@lead.test';
const adminPassB = 'LeadAdminPwd_2';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Lead A',
        tradingName: 'LA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Lead B',
        tradingName: 'LB',
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
        givenName: 'Lead',
        familyName: 'A',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: insideSales1,
        orgId: orgA,
        email: 'is1@lead.test',
        emailDigest: emailDigest('is1@lead.test', process.env.PII_SEARCH_KEY!),
        givenName: 'IS',
        familyName: '1',
        role: 'inside_sales',
        regionCode: 'US',
      },
      {
        id: insideSales2,
        orgId: orgA,
        email: 'is2@lead.test',
        emailDigest: emailDigest('is2@lead.test', process.env.PII_SEARCH_KEY!),
        givenName: 'IS',
        familyName: '2',
        role: 'inside_sales',
        regionCode: 'US',
      },
      {
        id: adminB,
        orgId: orgB,
        email: adminEmailB,
        emailDigest: emailDigest(adminEmailB, process.env.PII_SEARCH_KEY!),
        givenName: 'Lead',
        familyName: 'B',
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

describe('POST /v1/leads', () => {
  it('creates a lead and auto-routes to an inside_sales rep', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-create-1' },
      payload: {
        vertical: 'charity',
        givenName: 'Jane',
        familyName: 'Doe',
        email: 'jane@example.com',
        phone: '+15555550100',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.lead.id).toMatch(/^lead_/);
    expect(body.lead.status).toBe('new');
    expect([insideSales1, insideSales2]).toContain(body.lead.assignedToId);
  });

  it('honours explicit assignedToId when provided', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-create-explicit-1' },
      payload: {
        vertical: 'charity',
        givenName: 'John',
        familyName: 'Doe',
        assignedToId: insideSales1,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().lead.assignedToId).toBe(insideSales1);
  });

  it('rejects when Idempotency-Key header missing', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { vertical: 'charity', givenName: 'X', familyName: 'Y' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { 'idempotency-key': 'lead-noauth-1' },
      payload: { vertical: 'charity', givenName: 'X', familyName: 'Y' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('Zod rejects bad email format', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-zod-1' },
      payload: {
        vertical: 'charity',
        givenName: 'X',
        familyName: 'Y',
        email: 'not-an-email',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('replays cached response on idempotency-key reuse', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const payload = {
      vertical: 'charity' as const,
      givenName: 'Replay',
      familyName: 'Lead',
    };
    const first = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-replay-1' },
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-replay-1' },
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().lead.id).toBe(first.json().lead.id);
  });
});

describe('GET /v1/leads', () => {
  it('lists leads scoped to actor org only (tenant isolation)', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'lead-list-a-1' },
      payload: { vertical: 'charity', givenName: 'A', familyName: 'One' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${tB}`, 'idempotency-key': 'lead-list-b-1' },
      payload: { vertical: 'charity', givenName: 'B', familyName: 'One' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].givenName).toBe('A');
  });
});

describe('GET /v1/leads/:id', () => {
  it('returns lead with last 20 activities + cross-tenant 404', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'lead-get-1' },
      payload: { vertical: 'charity', givenName: 'Get', familyName: 'Me' },
    });
    const id = created.json().lead.id;
    const get = await app.inject({
      method: 'GET',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().lead.activities).toEqual([]);

    // RLS belt (SEC-005): org B cannot see org A's lead — the row is invisible, so
    // the read resolves to null → 404 (not 403). Withholding existence is the point
    // of tenant isolation; a 403 would itself disclose that the resource exists.
    const peek = await app.inject({
      method: 'GET',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(peek.statusCode).toBe(404);
  });
});

describe('PATCH /v1/leads/:id — state machine', () => {
  it('allows valid transition new → contacted', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-sm-good-1' },
      payload: { vertical: 'charity', givenName: 'SM', familyName: 'Good' },
    });
    const id = created.json().lead.id;
    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'contacted' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().lead.status).toBe('contacted');
  });

  it('rejects backwards transition contacted → new with 400 invalid-state-transition', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-sm-bad-1' },
      payload: { vertical: 'charity', givenName: 'SM', familyName: 'Bad' },
    });
    const id = created.json().lead.id;
    await app.inject({
      method: 'PATCH',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'contacted' },
    });
    const back = await app.inject({
      method: 'PATCH',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'new' },
    });
    expect(back.statusCode).toBe(400);
    expect(back.json().type).toBe('https://docs.d2d.io/problems/invalid-state-transition');
  });

  it('do_not_contact is terminal', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-sm-dnc-1' },
      payload: { vertical: 'charity', givenName: 'SM', familyName: 'DNC' },
    });
    const id = created.json().lead.id;
    await app.inject({
      method: 'PATCH',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'do_not_contact' },
    });
    const further = await app.inject({
      method: 'PATCH',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'contacted' },
    });
    expect(further.statusCode).toBe(400);
  });
});

describe('POST /v1/leads/:id/assign', () => {
  it('reassigns + creates a reassignment LeadActivity', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-assign-1' },
      payload: {
        vertical: 'charity',
        givenName: 'Assignee',
        familyName: 'McLead',
        assignedToId: insideSales1,
      },
    });
    const id = created.json().lead.id;
    const assign = await app.inject({
      method: 'POST',
      url: `/v1/leads/${id}/assign`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'lead-assign-2',
      },
      payload: { userId: insideSales2, reason: 'workload' },
    });
    expect(assign.statusCode).toBe(200);
    expect(assign.json().lead.assignedToId).toBe(insideSales2);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const activities = detail.json().lead.activities;
    expect(activities.find((a: { outcome?: string }) => a.outcome === 'reassigned')).toBeDefined();
  });

  it('rejects assigning to a user from another org', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-xtnt-1' },
      payload: { vertical: 'charity', givenName: 'X', familyName: 'Y' },
    });
    const id = created.json().lead.id;
    const res = await app.inject({
      method: 'POST',
      url: `/v1/leads/${id}/assign`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-xtnt-2' },
      payload: { userId: adminB },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/leads/:id/activities', () => {
  it('appends an activity and surfaces it via GET', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'lead-act-1' },
      payload: { vertical: 'charity', givenName: 'Act', familyName: 'Lead' },
    });
    const id = created.json().lead.id;
    const act = await app.inject({
      method: 'POST',
      url: `/v1/leads/${id}/activities`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'lead-act-2',
      },
      payload: { type: 'call', outcome: 'voicemail', payload: { durationMs: 23000 } },
    });
    expect(act.statusCode).toBe(201);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/leads/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const activities = detail.json().lead.activities;
    expect(activities.some((a: { type: string }) => a.type === 'call')).toBe(true);
  });
});

describe('POST /v1/leads/:id/dnk', () => {
  it('returns 501 — handled by DNK service', async () => {
    const token = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/leads/lead_anything/dnk',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(501);
  });
});
