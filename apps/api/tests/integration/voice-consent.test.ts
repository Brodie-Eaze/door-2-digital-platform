/**
 * Voice capture double-gate integration tests (D8 evidence).
 *
 * Gate 1 — feature flag: D2D_VOICE_ENABLED !== 'true' → 403
 *   voice-capture-disabled, even with full consent. Nothing persists.
 * Gate 2 — consent: flag on but consentObtained !== true → 422
 *   voice-consent-required. Nothing persists, idempotency never caches.
 * Happy path: flag on + consent true → 201, row persisted with
 *   consentObtained=true (the 7-year audit fact).
 * Tenant wall: org B cannot read org A's recording (404).
 */
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_VOICE_ALPHA';
const userA = 'usr_TEST_VOICE_ALPHA';
const emailA = 'admin@voice-a.test';
const passwordA = 'VoiceAdminPwd_1';

const orgB = 'org_TEST_VOICE_BRAVO';
const userB = 'usr_TEST_VOICE_BRAVO';
const emailB = 'admin@voice-b.test';
const passwordB = 'VoiceAdminPwd_2';

const AUDIO = Buffer.from('not-really-audio').toString('base64');

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'VA',
        tradingName: 'VA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'VB',
        tradingName: 'VB',
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
        emailDigest: emailDigest(emailA, process.env.PII_SEARCH_KEY ?? ''),
        givenName: 'Voice',
        familyName: 'Alpha',
        role: 'org_admin',
        regionCode: 'US',
        status: 'active',
      },
      {
        id: userB,
        orgId: orgB,
        email: emailB,
        emailDigest: emailDigest(emailB, process.env.PII_SEARCH_KEY ?? ''),
        givenName: 'Voice',
        familyName: 'Bravo',
        role: 'org_admin',
        regionCode: 'US',
        status: 'active',
      },
    ],
  });
  await setUserPassword(userA, passwordA);
  await setUserPassword(userB, passwordB);
}

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { accessToken: string }).accessToken;
}

function voiceBody(consent: boolean): Record<string, unknown> {
  return {
    capturedAt: new Date().toISOString(),
    durationMs: 4200,
    consentObtained: consent,
    audioBase64: AUDIO,
  };
}

const savedFlag = process.env.D2D_VOICE_ENABLED;

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

afterEach(() => {
  if (savedFlag === undefined) delete process.env.D2D_VOICE_ENABLED;
  else process.env.D2D_VOICE_ENABLED = savedFlag;
});

describe('voice capture — gate 1: feature flag (default OFF)', () => {
  it('_status reports disabled by default', async () => {
    delete process.env.D2D_VOICE_ENABLED;
    const res = await app.inject({ method: 'GET', url: '/v1/voice/_status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enabled: false });
  });

  it('rejects capture with 403 voice-capture-disabled even WITH consent, persists nothing', async () => {
    delete process.env.D2D_VOICE_ENABLED;
    const token = await login(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/voice',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_voice_gate1_test' },
      payload: voiceBody(true),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: expect.stringContaining('voice-capture-disabled') });
    expect(await prisma().voiceRecording.count()).toBe(0);
  });

  it('a non-true flag value ("1", "TRUE", "yes") stays disabled — the gate is exact', async () => {
    for (const v of ['1', 'TRUE', 'yes', 'on']) {
      process.env.D2D_VOICE_ENABLED = v;
      const token = await login(emailA, passwordA);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/voice',
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': `idem_voice_v_${v}` },
        payload: voiceBody(true),
      });
      expect(res.statusCode).toBe(403);
    }
    expect(await prisma().voiceRecording.count()).toBe(0);
  });
});

describe('voice capture — gate 2: all-party consent (flag ON)', () => {
  it('rejects consentObtained=false with 422 voice-consent-required, persists nothing', async () => {
    process.env.D2D_VOICE_ENABLED = 'true';
    const token = await login(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/voice',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_voice_gate2_test' },
      payload: voiceBody(false),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ type: expect.stringContaining('voice-consent-required') });
    expect(await prisma().voiceRecording.count()).toBe(0);
    // The refusal must not be cached — a later consenting retry with the SAME
    // idempotency key must not replay the 422.
    const retry = await app.inject({
      method: 'POST',
      url: '/v1/voice',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_voice_gate2_test' },
      payload: voiceBody(true),
    });
    expect(retry.statusCode).toBe(201);
  });

  it('captures with consent → 201 and persists consentObtained=true', async () => {
    process.env.D2D_VOICE_ENABLED = 'true';
    const token = await login(emailA, passwordA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/voice',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_voice_happy_test' },
      payload: voiceBody(true),
    });
    expect(res.statusCode).toBe(201);
    const rows = await prisma().voiceRecording.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.consentObtained).toBe(true);
    expect(rows[0]?.orgId).toBe(orgA);
  });
});

describe('voice capture — tenant wall', () => {
  it('org B cannot read org A recordings (list empty, raw 404)', async () => {
    process.env.D2D_VOICE_ENABLED = 'true';
    const tokenA = await login(emailA, passwordA);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/voice',
      headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': 'idem_voice_wall_test' },
      payload: voiceBody(true),
    });
    expect(created.statusCode).toBe(201);
    const rec = await prisma().voiceRecording.findFirstOrThrow();

    const tokenB = await login(emailB, passwordB);
    const list = await app.inject({
      method: 'GET',
      url: '/v1/voice',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as { data?: unknown[]; recordings?: unknown[] };
    expect(listBody.data ?? listBody.recordings ?? []).toHaveLength(0);

    const raw = await app.inject({
      method: 'GET',
      url: `/v1/voice/${rec.id}/raw`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(raw.statusCode).toBe(404);
  });
});
