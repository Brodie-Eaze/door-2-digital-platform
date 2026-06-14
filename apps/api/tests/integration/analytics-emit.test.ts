/**
 * Analytics real-time emit tests — proves the warehouse outbox is now written
 * INLINE on the D2D write paths (no backfill), inside the SAME tenantTx as the
 * business row, exactly once per business fact.
 *
 * Covers, per call site:
 *   field-signup  -> "sale"           (amountCents + attributionSource + type + serviceId + frequency)
 *   knock single  -> "knock"          (one event; a deduped re-POST does NOT double-emit)
 *   knock batch   -> "knock" * N      (one per NEWLY-created knock; dups excluded)
 *   roster        -> "session_start" / "session_end"
 *   photo         -> "photo"          (no image bytes on the payload)
 *
 * Tenant scope: every emit uses orgId/userId from the auth principal; a second
 * org's writes never appear in the first org's events. We build a local app that
 * registers exactly the write + read routes we exercise (the shared buildTestApp
 * intentionally wires only a subset) and seed our own org/users/territory.
 *
 * truncateAll() does NOT cover AnalyticsEvent / KnockerShift / KnockPhoto, so we
 * clean those ourselves in beforeEach to stay isolated.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { errorHandler } from '../../src/shared/errors/handler';
import { registerCorrelationId } from '../../src/shared/middleware/correlation';
import { registerAuth } from '../../src/domains/auth/routes';
import { registerKnock, registerKnockSessions } from '../../src/domains/knock/routes';
import { registerFieldSignup } from '../../src/domains/field-signup/routes';
import { registerRoster } from '../../src/domains/roster/routes';
import { registerPhoto } from '../../src/domains/photo/routes';
import { registerAnalytics } from '../../src/domains/analytics/routes';
import { setUserPassword } from '../../src/domains/auth/service';
import { truncateAll, teardown } from '../helpers/app';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_AEMIT_ALPHA';
const orgB = 'org_TEST_AEMIT_BRAVO';
const repA = 'usr_TEST_AEMIT_A_REP';
const mgrA = 'usr_TEST_AEMIT_A_MGR';
const repB = 'usr_TEST_AEMIT_B_REP';
const repEmailA = 'rep@aemit.test';
const mgrEmailA = 'mgr@aemit.test';
const repEmailB = 'rep@aemit-b.test';
const pass = 'AemitPwd_12345';
const territoryA = 'ter_TEST_AEMIT_ALPHA_01';

const wkt = 'POLYGON((-97.7 30.27, -97.69 30.27, -97.69 30.28, -97.7 30.28, -97.7 30.27))';

// 1x1 transparent PNG (real bytes so capturePhoto's zero-byte guard passes).
const PNG_1PX_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function buildApp(): Promise<FastifyInstance> {
  const a = Fastify({ logger: false, trustProxy: true, genReqId: () => newId('req') });
  await a.register(cookie, {
    secret: process.env.CSRF_SIGNING_SECRET ?? 'test-csrf-secret-must-be-at-least-32-chars-long',
  });
  await a.register(sensible);
  await a.register(registerCorrelationId);
  a.setErrorHandler(errorHandler);
  await a.register(registerAuth, { prefix: '/v1/auth' });
  await a.register(registerKnock, { prefix: '/v1/knocks' });
  await a.register(registerKnockSessions, { prefix: '/v1/sessions' });
  await a.register(registerFieldSignup, { prefix: '/v1/field' });
  await a.register(registerRoster, { prefix: '/v1/roster' });
  await a.register(registerPhoto, { prefix: '/v1/photos' });
  await a.register(registerAnalytics, { prefix: '/v1/analytics' });
  await a.ready();
  return a;
}

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'AE A',
        tradingName: 'AEA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'AE B',
        tradingName: 'AEB',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    ],
  });
  await prisma().user.createMany({
    data: [
      {
        id: repA,
        orgId: orgA,
        email: repEmailA,
        emailDigest: emailDigest(repEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'Rep',
        familyName: 'Alpha',
        role: 'knocker',
        regionCode: 'US',
      },
      {
        id: mgrA,
        orgId: orgA,
        email: mgrEmailA,
        emailDigest: emailDigest(mgrEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'Mgr',
        familyName: 'Alpha',
        role: 'manager',
        regionCode: 'US',
      },
      {
        id: repB,
        orgId: orgB,
        email: repEmailB,
        emailDigest: emailDigest(repEmailB, process.env.PII_SEARCH_KEY!),
        givenName: 'Rep',
        familyName: 'Bravo',
        role: 'knocker',
        regionCode: 'US',
      },
    ],
  });
  await prisma().territory.create({
    data: {
      id: territoryA,
      orgId: orgA,
      regionCode: 'US',
      name: 'AE-A',
      vertical: 'charity',
      polygon: wkt,
      centroid: '-97.695 30.275',
      s2CellIds: ['S2L13_-97.695_30.275'],
      status: 'active',
    },
  });
  await setUserPassword(repA, pass);
  await setUserPassword(mgrA, pass);
  await setUserPassword(repB, pass);
}

async function tokenFor(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: pass },
  });
  return res.json().accessToken;
}

async function startSession(token: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/sessions',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': `sess-${newId()}` },
    payload: {
      territoryId: territoryA,
      deviceId: 'test-device',
      startGeo: { lat: 30.275, lng: -97.695 },
    },
  });
  return res.json().session.id;
}

function knockPayload(sessionId: string, key: string, street: string): Record<string, unknown> {
  return {
    sessionId,
    disposition: 'no_answer',
    geo: { lat: 30.275, lng: -97.695, accuracyM: 8 },
    capturedAt: new Date().toISOString(),
    idempotencyKey: key,
    rawAddress: {
      formatted: `${street}, Austin, TX 78701, USA`,
      street,
      locality: 'Austin',
      region: 'TX',
      postcode: '78701',
      countryCode: 'US',
    },
  };
}

/** Direct DB read of the outbox — the proof the emit committed in the same tx. */
async function events(
  orgId: string,
  eventType?: string,
): Promise<
  Array<{
    eventType: string;
    entityType: string | null;
    entityId: string | null;
    userId: string | null;
    orgId: string;
    occurredAt: Date;
    shippedAt: Date | null;
    payload: unknown;
  }>
> {
  return prisma().analyticsEvent.findMany({
    where: { orgId, ...(eventType ? { eventType } : {}) },
    orderBy: { id: 'asc' },
  });
}

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await teardown();
});

beforeEach(async () => {
  await truncateAll();
  // truncateAll doesn't cover these three — clean them so each test is isolated.
  await prisma().$executeRawUnsafe(
    'TRUNCATE TABLE "AnalyticsEvent", "KnockerShift", "KnockPhoto" RESTART IDENTITY CASCADE;',
  );
  await seed();
});

describe('field-signup -> "sale" event', () => {
  it('emits exactly one sale event with the right amountCents in the same tx', async () => {
    const t = await tokenFor(repEmailA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/field/signups',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'fs-sale-1' },
      payload: {
        customerName: 'Donor One',
        serviceId: 'svc_water',
        serviceName: 'Clean Water',
        amountCents: 137777,
        frequency: 'monthly',
      },
    });
    expect(res.statusCode).toBe(201); // money path still works
    const conversionId = res.json().id as string;

    const sales = await events(orgA, 'sale');
    expect(sales).toHaveLength(1);
    const ev = sales[0]!;
    expect(ev.entityType).toBe('Conversion');
    expect(ev.entityId).toBe(conversionId);
    expect(ev.userId).toBe(repA); // auth principal, not the body
    expect(ev.shippedAt).toBeNull(); // fresh, unshipped — not a backfill artefact
    expect(ev.payload).toMatchObject({
      amountCents: 137777,
      attributionSource: 'door',
      type: 'donation_recurring',
      serviceId: 'svc_water',
      frequency: 'monthly',
    });
  });

  it('does not leak the sale event into another tenant', async () => {
    const t = await tokenFor(repEmailA);
    await app.inject({
      method: 'POST',
      url: '/v1/field/signups',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'fs-iso-1' },
      payload: {
        customerName: 'Donor Iso',
        serviceId: 'svc_food',
        serviceName: 'Food',
        amountCents: 5000,
        frequency: 'once',
      },
    });
    expect(await events(orgB, 'sale')).toHaveLength(0);
  });
});

describe('knock -> "knock" event', () => {
  it('single knock emits one event; the deduped re-POST does NOT double-emit', async () => {
    const t = await tokenFor(repEmailA);
    const sessionId = await startSession(t);
    const payload = knockPayload(sessionId, 'knk-emit-1', '1 Emit St');

    const first = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'knk-emit-h-1' },
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().deduped).toBe(false);

    // Same per-knock idempotencyKey -> service short-circuits BEFORE the tx.
    const second = await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'knk-emit-h-2' },
      payload,
    });
    expect(second.json().deduped).toBe(true);

    const knocks = await events(orgA, 'knock');
    expect(knocks).toHaveLength(1); // dedupe did not emit a second time
    const ev = knocks[0]!;
    expect(ev.entityType).toBe('Knock');
    expect(ev.entityId).toBe(first.json().knock.id);
    expect(ev.payload).toMatchObject({
      disposition: 'no_answer',
      latitude: 30.275,
      longitude: -97.695,
      territoryId: territoryA,
    });
  });

  it('batch emits exactly one event per NEWLY-created knock (dups excluded)', async () => {
    const t = await tokenFor(repEmailA);
    const sessionId = await startSession(t);

    // Pre-insert one knock so its idempotencyKey is already taken in the DB.
    await app.inject({
      method: 'POST',
      url: '/v1/knocks',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'pre-emit-h-1' },
      payload: knockPayload(sessionId, 'shared-key-1', '99 Pre St'),
    });
    expect(await events(orgA, 'knock')).toHaveLength(1);

    const batch = [
      knockPayload(sessionId, 'shared-key-1', '99 Pre St'), // dup vs DB -> no emit
      knockPayload(sessionId, 'batch-new-1', '100 New St'), // new -> emit
      knockPayload(sessionId, 'batch-new-1', '101 Dup St'), // dup in batch -> no emit
      knockPayload(sessionId, 'batch-new-2', '102 New St'), // new -> emit
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/v1/knocks/batch',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'batch-h-1' },
      payload: { knocks: batch },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().inserted).toBe(2);
    expect(res.json().deduped).toBe(2);

    // 1 (pre) + 2 (newly inserted) = 3 knock events; no event for either dup.
    const knocks = await events(orgA, 'knock');
    expect(knocks).toHaveLength(3);
    const entityIds = new Set(knocks.map((k) => k.entityId));
    expect(entityIds.size).toBe(3); // no duplicate entityId
  });
});

describe('roster -> "session_start" / "session_end"', () => {
  async function rosterShift(): Promise<{ mgrToken: string; repToken: string; shiftId: string }> {
    const mgrToken = await tokenFor(mgrEmailA);
    const repToken = await tokenFor(repEmailA);
    const monday = '2026-06-15'; // a Monday
    const created = await app.inject({
      method: 'POST',
      url: '/v1/roster/shifts',
      headers: { authorization: `Bearer ${mgrToken}`, 'idempotency-key': 'shift-emit-1' },
      payload: {
        userId: repA,
        territoryId: territoryA,
        weekStart: monday,
        day: 0,
        start: '09:00',
        end: '17:00',
      },
    });
    return { mgrToken, repToken, shiftId: created.json().id as string };
  }

  it('clock-in emits session_start; clock-out emits session_end for the closed session', async () => {
    const { repToken, shiftId } = await rosterShift();

    const cin = await app.inject({
      method: 'POST',
      url: `/v1/roster/shifts/${shiftId}/clock-in`,
      headers: { authorization: `Bearer ${repToken}`, 'idempotency-key': 'clockin-1' },
      payload: { deviceId: 'iphone-test' },
    });
    expect(cin.statusCode).toBe(200);
    const sessionId = cin.json().sessionId as string;

    const start = await events(orgA, 'session_start');
    expect(start).toHaveLength(1);
    expect(start[0]!.entityType).toBe('KnockSession');
    expect(start[0]!.entityId).toBe(sessionId);
    expect(start[0]!.payload).toMatchObject({ shiftId, territoryId: territoryA });

    const cout = await app.inject({
      method: 'POST',
      url: `/v1/roster/shifts/${shiftId}/clock-out`,
      headers: { authorization: `Bearer ${repToken}`, 'idempotency-key': 'clockout-1' },
      payload: {},
    });
    expect(cout.statusCode).toBe(200);
    expect(cout.json().sessionId).toBe(sessionId);

    const end = await events(orgA, 'session_end');
    expect(end).toHaveLength(1);
    expect(end[0]!.entityId).toBe(sessionId);
    expect(end[0]!.payload).toMatchObject({ shiftId, sessionId });
  });
});

describe('photo -> "photo" event', () => {
  it('emits one photo event with metadata only (no image bytes on the payload)', async () => {
    const t = await tokenFor(repEmailA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photos',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'photo-emit-1' },
      payload: {
        clientKnockId: 'client-knock-uuid-1',
        capturedAt: new Date().toISOString(),
        latitude: 30.275,
        longitude: -97.695,
        contentType: 'image/png',
        imageBase64: PNG_1PX_B64,
      },
    });
    expect(res.statusCode).toBe(201);
    const photoId = res.json().id as string;

    const photos = await events(orgA, 'photo');
    expect(photos).toHaveLength(1);
    const ev = photos[0]!;
    expect(ev.entityType).toBe('KnockPhoto');
    expect(ev.entityId).toBe(photoId);
    expect(ev.payload).toMatchObject({
      clientKnockId: 'client-knock-uuid-1',
      latitude: 30.275,
      longitude: -97.695,
    });
    // Never ship the bytes to the warehouse.
    expect(JSON.stringify(ev.payload)).not.toContain('imageBase64');
    expect(JSON.stringify(ev.payload)).not.toContain(PNG_1PX_B64);
  });
});
