/**
 * Content-Studio integration tests — Agent 16.
 *
 * Verifies the thin facade over MarketingService:
 *   - jobs/copy   → claude_copy (sync, ready inline)
 *   - jobs/image  → flux_image (sync)
 *   - jobs/video  → runway_video (async, externalJobId)
 *   - jobs/avatar → heygen_avatar (async)
 *   - jobs/:id    → proxies to MarketingService.getJob (polls + flips)
 *   - providers   → filtered to content-generation capabilities
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_CS_ALPHA';
const adminA = 'usr_TEST_CS_ALPHA_ADMIN';
const adminEmailA = 'admin@cs.test';
const adminPassA = 'CsAdminPwd_1';

async function seed(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgA,
      legalName: 'CS A',
      tradingName: 'CSA',
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
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

async function connect(token: string, kind: string, key: string): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: `/v1/marketing/providers/${kind}/connect`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: { credentials: {}, mode: 'sandbox' },
  });
  expect(res.statusCode).toBe(201);
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

describe('GET /v1/content-studio/providers', () => {
  it('lists only content-gen providers', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/content-studio/providers',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const providers = res.json().providers as Array<{ kind: string; capabilities: string[] }>;
    // claude_copy + openai_copy + flux_image + ideogram_image + runway_video + higgsfield + heygen_avatar = 7
    expect(providers.length).toBeGreaterThanOrEqual(7);
    expect(
      providers.every((p) => p.capabilities.some((c) => c.startsWith('creative.generate.'))),
    ).toBe(true);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/content-studio/providers' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /v1/content-studio/jobs/copy', () => {
  it('persists a ready job via claude_copy default', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'cs-copy-conn-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/copy',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cs-copy-job-1' },
      payload: { prompt: 'Write a tagline' },
    });
    expect(res.statusCode).toBe(201);
    const job = res.json().job;
    expect(job.providerKind).toBe('claude_copy');
    expect(job.status).toBe('ready');
    expect(job.outputJson?.text).toBeTruthy();
  });

  it('respects providerOverride=openai_copy', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'openai_copy', 'cs-copy-oai-conn-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/copy',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cs-copy-oai-job-1' },
      payload: { prompt: 'Slogan', providerOverride: 'openai_copy' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().job.providerKind).toBe('openai_copy');
  });

  it('requires idempotency-key', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'cs-copy-idem-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/copy',
      headers: { authorization: `Bearer ${t}` },
      payload: { prompt: 'No key' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/content-studio/jobs/image', () => {
  it('persists a ready image job via flux_image default', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'flux_image', 'cs-img-conn-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/image',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cs-img-job-1' },
      payload: { prompt: 'Hero shot', aspectRatio: '1:1', count: 1 },
    });
    expect(res.statusCode).toBe(201);
    const job = res.json().job;
    expect(job.providerKind).toBe('flux_image');
    expect(job.status).toBe('ready');
    expect(Array.isArray(job.outputJson?.images)).toBe(true);
  });
});

describe('POST /v1/content-studio/jobs/video', () => {
  it('returns 202 + async running job via runway_video', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'runway_video', 'cs-vid-conn-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/video',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cs-vid-job-1' },
      payload: { prompt: 'B-roll', durationSec: 5, aspectRatio: '9:16' },
    });
    expect(res.statusCode).toBe(202);
    const job = res.json().job;
    expect(job.providerKind).toBe('runway_video');
    expect(job.status).toBe('running');
    expect(job.externalJobId).toMatch(/^job_stub_/);
  });
});

describe('POST /v1/content-studio/jobs/avatar', () => {
  it('returns 202 + async running job via heygen', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'heygen_avatar', 'cs-av-conn-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/avatar',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cs-av-job-1' },
      payload: { script: 'Hello', avatarId: 'av1', voiceId: 'vc1' },
    });
    expect(res.statusCode).toBe(202);
    const job = res.json().job;
    expect(job.providerKind).toBe('heygen_avatar');
    expect(job.status).toBe('running');
  });
});

describe('GET /v1/content-studio/jobs/:id', () => {
  it('proxies through MarketingService.getJob', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'cs-get-conn-1');
    const create = await app.inject({
      method: 'POST',
      url: '/v1/content-studio/jobs/copy',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'cs-get-job-1' },
      payload: { prompt: 'X' },
    });
    const id = create.json().job.id;
    const res = await app.inject({
      method: 'GET',
      url: `/v1/content-studio/jobs/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().job.id).toBe(id);
    expect(res.json().job.status).toBe('ready');
  });

  it('404s for unknown id', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/content-studio/jobs/cgj_nonsense',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
