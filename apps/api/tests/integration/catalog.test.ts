/**
 * Catalog integration tests — per-tenant ServiceOffering CRUD over real
 * Postgres: GET (active, ordered, tenant-scoped), POST/PATCH/DELETE role gates,
 * idempotency, soft-delete, audit, cross-tenant isolation, adversarial bodies.
 *
 * The orchestrator wires `registerCatalog` into the production app; the shared
 * `buildTestApp` helper does not (the catalog domain is registered by the
 * orchestrator, not this PR). We therefore register it directly onto the test
 * app under the same `/v1/catalog` prefix used in production, so these tests
 * exercise the real routes/service/RLS without editing shared harness files.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { truncateAll, teardown } from '../helpers/app';
import { errorHandler } from '../../src/shared/errors/handler';
import { registerCorrelationId } from '../../src/shared/middleware/correlation';
import { registerAuth } from '../../src/domains/auth/routes';
import { registerCatalog } from '../../src/domains/catalog/routes';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { newId, emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

/**
 * Minimal real-wiring app: same cookie/sensible/correlation/errorHandler stack
 * as the shared `buildTestApp` helper, plus the auth routes (for /v1/auth/login
 * + the requireAuth preHandler) and the catalog routes under the production
 * prefix. We build it here rather than via `buildTestApp` because that helper
 * already calls `app.ready()`, and Fastify forbids registering a plugin after
 * boot — the catalog domain is wired by the orchestrator in production, not the
 * shared test helper.
 */
async function buildCatalogApp(): Promise<FastifyInstance> {
  const instance = Fastify({ logger: false, trustProxy: true, genReqId: () => newId('req') });
  await instance.register(cookie, {
    secret: process.env.CSRF_SIGNING_SECRET ?? 'test-csrf-secret-must-be-at-least-32-chars-long',
  });
  await instance.register(sensible);
  await instance.register(registerCorrelationId);
  instance.setErrorHandler(errorHandler);
  await instance.register(registerAuth, { prefix: '/v1/auth' });
  // Mounted exactly as the orchestrator does in production (index.ts).
  await instance.register(registerCatalog, { prefix: '/v1/catalog' });
  await instance.ready();
  return instance;
}

const orgA = 'org_TEST_CAT_ALPHA';
const orgB = 'org_TEST_CAT_BRAVO';

const adminA = 'usr_TEST_CAT_A_ADMIN';
const adminEmailA = 'admin@cat.test';
const adminPassA = 'CatAdminPwd_1';

const managerA = 'usr_TEST_CAT_A_MGR';
const managerEmailA = 'manager@cat.test';
const managerPassA = 'CatMgrPwd_1';

const knockerA = 'usr_TEST_CAT_A_KNOCKER';
const knockerEmailA = 'knocker@cat.test';
const knockerPassA = 'CatKnockerPwd_1';

const adminB = 'usr_TEST_CAT_B_ADMIN';
const adminEmailB = 'admin@cat-b.test';
const adminPassB = 'CatAdminBPwd_1';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Cat A',
        tradingName: 'CA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Cat B',
        tradingName: 'CB',
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
        id: managerA,
        orgId: orgA,
        email: managerEmailA,
        emailDigest: emailDigest(managerEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'M',
        familyName: 'Manager',
        role: 'manager',
        regionCode: 'US',
      },
      {
        id: knockerA,
        orgId: orgA,
        email: knockerEmailA,
        emailDigest: emailDigest(knockerEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'K',
        familyName: 'Nocker',
        role: 'knocker',
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
  await setUserPassword(managerA, managerPassA);
  await setUserPassword(knockerA, knockerPassA);
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

const validOffering = {
  name: 'Hope Plus',
  blurb: 'Clean water for a family',
  amountCents: 4000,
  frequency: 'monthly' as const,
  vertical: 'charity' as const,
};

beforeAll(async () => {
  app = await buildCatalogApp();
});

afterAll(async () => {
  await app.close();
  await teardown();
});

beforeEach(async () => {
  await truncateAll();
  // truncateAll doesn't yet list ServiceOffering (owned by the orchestrator);
  // clear it ourselves so each test starts empty.
  await prisma().$executeRawUnsafe('TRUNCATE TABLE "ServiceOffering" RESTART IDENTITY CASCADE;');
  await seed();
});

describe('GET /v1/catalog', () => {
  it('returns active offerings ordered by sortOrder asc, only the iOS fields', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-seed-2' },
      payload: { ...validOffering, name: 'Second', sortOrder: 2 },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-seed-1' },
      payload: { ...validOffering, name: 'First', sortOrder: 1, highlighted: true },
    });

    const knockerToken = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${knockerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((o: { name: string }) => o.name)).toEqual(['First', 'Second']);
    const first = body[0];
    expect(Object.keys(first).sort()).toEqual(
      [
        'amountCents',
        'blurb',
        'frequency',
        'highlighted',
        'id',
        'name',
        'sortOrder',
        'vertical',
      ].sort(),
    );
    expect(first.id).toMatch(/^svo_/);
    expect(first.amountCents).toBe(4000);
    expect(typeof first.amountCents).toBe('number');
    expect(first.highlighted).toBe(true);
    expect(first).not.toHaveProperty('orgId');
    expect(first).not.toHaveProperty('active');
  });

  it('excludes soft-deleted offerings', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-del-1' },
      payload: validOffering,
    });
    const id = created.json().id;
    await app.inject({
      method: 'DELETE',
      url: `/v1/catalog/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.json()).toHaveLength(0);
  });

  it('is tenant-scoped — org B never sees org A offerings', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'cat-iso-1' },
      payload: validOffering,
    });
    const tB = await tokenFor(adminEmailB, adminPassB);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(res.json()).toHaveLength(0);
  });

  it('requires JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/catalog' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /v1/catalog', () => {
  it('manager can create — returns 201 + id, writes audit row', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-create-1' },
      payload: validOffering,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toMatch(/^svo_/);
    const audit = await prisma().auditEvent.findFirst({
      where: { orgId: orgA, action: 'service_offering.created' },
    });
    expect(audit).toBeTruthy();
  });

  it('knocker is rejected (403)', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-rbac-1' },
      payload: validOffering,
    });
    expect(res.statusCode).toBe(403);
  });

  it('idempotency replay returns the same id', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const first = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-replay-1' },
      payload: validOffering,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-replay-1' },
      payload: validOffering,
    });
    expect(second.json().id).toBe(first.json().id);
    const count = await prisma().serviceOffering.count({ where: { orgId: orgA } });
    expect(count).toBe(1);
  });

  it('Zod rejects amountCents <= 0', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-bad-amt-1' },
      payload: { ...validOffering, amountCents: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('Zod rejects unknown vertical and unknown keys', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const badVertical = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-bad-vert-1' },
      payload: { ...validOffering, vertical: 'crypto' },
    });
    expect(badVertical.statusCode).toBe(400);
    const extraKey = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-bad-key-1' },
      payload: { ...validOffering, orgId: orgB },
    });
    expect(extraKey.statusCode).toBe(400);
  });

  it('Zod rejects empty name and oversized name', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const empty = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-empty-1' },
      payload: { ...validOffering, name: '' },
    });
    expect(empty.statusCode).toBe(400);
    const big = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-big-1' },
      payload: { ...validOffering, name: 'x'.repeat(201) },
    });
    expect(big.statusCode).toBe(400);
  });
});

describe('PATCH /v1/catalog/:id', () => {
  async function createOne(): Promise<{ id: string; token: string }> {
    const token = await tokenFor(managerEmailA, managerPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `cat-patch-seed-${Math.random()}`,
      },
      payload: validOffering,
    });
    return { id: created.json().id, token };
  }

  it('manager can update fields and the change is reflected', async () => {
    const { id, token } = await createOne();
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/catalog/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Hope Premium', amountCents: 6000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(id);
    const get = await app.inject({
      method: 'GET',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.json()[0].name).toBe('Hope Premium');
    expect(get.json()[0].amountCents).toBe(6000);
    const audit = await prisma().auditEvent.findFirst({
      where: { orgId: orgA, action: 'service_offering.updated' },
    });
    expect(audit).toBeTruthy();
  });

  it('knocker is rejected (403)', async () => {
    const { id } = await createOne();
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/catalog/${id}`,
      headers: { authorization: `Bearer ${t}` },
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('unknown id 404s', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/catalog/svo_does_not_exist',
      headers: { authorization: `Bearer ${t}` },
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it("cross-tenant id 404s (org B can't patch org A)", async () => {
    const { id } = await createOne();
    const tB = await tokenFor(adminEmailB, adminPassB);
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/catalog/${id}`,
      headers: { authorization: `Bearer ${tB}` },
      payload: { name: 'pwned' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /v1/catalog/:id', () => {
  it('soft-deletes (active=false), never hard-deletes', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-soft-1' },
      payload: validOffering,
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/catalog/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(id);
    const row = await prisma().serviceOffering.findUnique({ where: { id } });
    expect(row).toBeTruthy();
    expect(row?.active).toBe(false);
    const audit = await prisma().auditEvent.findFirst({
      where: { orgId: orgA, action: 'service_offering.archived' },
    });
    expect(audit).toBeTruthy();
  });

  it('knocker is rejected (403)', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cat-soft-rbac-1' },
      payload: validOffering,
    });
    const id = created.json().id;
    const kt = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/catalog/${id}`,
      headers: { authorization: `Bearer ${kt}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /v1/catalog/_status', () => {
  it('reports the domain live', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/catalog/_status' });
    expect(res.json()).toEqual({ domain: 'catalog', status: 'live' });
  });
});
