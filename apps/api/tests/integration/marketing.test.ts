/**
 * Marketing integration tests — Agent 16.
 *
 * Covers:
 *   - listProviders shape (11 adapters + connection status)
 *   - connect → status=connected + webhookSecret plaintext returned ONCE
 *   - disconnect → status=disconnected
 *   - generateCreative sync (claude_copy) → persisted ContentGenerationJob ready inline
 *   - generateCreative async (runway_video) → externalJobId + status=running, pollJob
 *   - inbound webhook receiver with HMAC + replay dedup
 *   - cross-tenant isolation (org A's connection invisible to org B)
 *   - idempotency-key required on POSTs
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';
// Stub-mode poll threshold (must match @d2d/integrations adapter helper).
// We backdate `createdAt` past this to flip a running stub job to ready.
const STUB_READY_AFTER_MS = 30_000;

let app: FastifyInstance;

const orgA = 'org_TEST_MKT_ALPHA';
const adminA = 'usr_TEST_MKT_ALPHA_ADMIN';
const adminEmailA = 'admin@mkt.test';
const adminPassA = 'MktAdminPwd_1';

const insideA = 'usr_TEST_MKT_ALPHA_IS';
const insideEmailA = 'is@mkt.test';
const insidePassA = 'MktInsidePwd_1';

const orgB = 'org_TEST_MKT_BRAVO';
const adminB = 'usr_TEST_MKT_BRAVO_ADMIN';
const adminEmailB = 'b@mkt.test';
const adminPassB = 'MktAdminPwd_2';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Mkt A',
        tradingName: 'MA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Mkt B',
        tradingName: 'MB',
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
        givenName: 'A',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: insideA,
        orgId: orgA,
        email: insideEmailA,
        emailDigest: emailDigest(insideEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'IS',
        familyName: 'Rep',
        role: 'inside_sales',
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
  await setUserPassword(adminB, adminPassB);
  await setUserPassword(insideA, insidePassA);
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

/** Connect a sandbox-mode provider and return the plaintext webhook secret. */
async function connect(token: string, kind: string, key: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/v1/marketing/providers/${kind}/connect`,
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: { credentials: {}, mode: 'sandbox' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().webhookSecret;
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

// ───────────────────────────────────────────────────────────────────────────
// listProviders
// ───────────────────────────────────────────────────────────────────────────

describe('GET /v1/marketing/providers', () => {
  it('lists all 11 adapters', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const providers = res.json().providers as Array<{ kind: string; connected: boolean }>;
    expect(providers).toHaveLength(11);
    const kinds = providers.map((p) => p.kind).sort();
    expect(kinds).toContain('claude_copy');
    expect(kinds).toContain('runway_video');
    expect(kinds).toContain('heygen_avatar');
    expect(kinds).toContain('meta_marketing');
  });

  it('marks unconnected providers as connected=false', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers',
      headers: { authorization: `Bearer ${t}` },
    });
    const providers = res.json().providers as Array<{ connected: boolean }>;
    expect(providers.every((p) => p.connected === false)).toBe(true);
  });

  it('returns capabilities and docsUrl', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers',
      headers: { authorization: `Bearer ${t}` },
    });
    const claude = (
      res.json().providers as Array<{ kind: string; capabilities: string[]; docsUrl: string }>
    ).find((p) => p.kind === 'claude_copy');
    expect(claude?.capabilities).toContain('creative.generate.text');
    expect(claude?.docsUrl).toMatch(/^https?:\/\//);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/marketing/providers' });
    expect(res.statusCode).toBe(401);
  });

  it('isolates connection state by org', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    await connect(tA, 'claude_copy', 'iso-conn-1');
    const a = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers',
      headers: { authorization: `Bearer ${tA}` },
    });
    const b = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers',
      headers: { authorization: `Bearer ${tB}` },
    });
    const aClaude = (a.json().providers as Array<{ kind: string; connected: boolean }>).find(
      (p) => p.kind === 'claude_copy',
    );
    const bClaude = (b.json().providers as Array<{ kind: string; connected: boolean }>).find(
      (p) => p.kind === 'claude_copy',
    );
    expect(aClaude?.connected).toBe(true);
    expect(bClaude?.connected).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// connect / disconnect / status
// ───────────────────────────────────────────────────────────────────────────

describe('POST /v1/marketing/providers/:kind/connect', () => {
  it('connects in sandbox mode and returns webhookSecret once', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/providers/claude_copy/connect',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-conn-1' },
      payload: { credentials: {}, mode: 'sandbox' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.connection.kind).toBe('claude_copy');
    expect(body.connection.status).toBe('connected');
    expect(body.connection.mode).toBe('sandbox');
    expect(body.webhookSecret).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('persists ProviderConnection row with credentials in vault', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'flux_image', 'mkt-conn-vault-1');
    const row = await prisma().providerConnection.findUnique({
      where: { orgId_kind: { orgId: orgA, kind: 'flux_image' } },
    });
    expect(row).toBeTruthy();
    expect(row?.status).toBe('connected');
    expect(row?.kind).toBe('flux_image');
    // Vault sealed — must have AAD + ciphertext shape, not raw creds.
    const v = row?.credentialsVault as Record<string, string> | null;
    expect(v).toBeTruthy();
    expect(typeof v?.ciphertext).toBe('string');
    expect(typeof v?.iv).toBe('string');
    expect(typeof v?.dekWrapped).toBe('string');
    // Hash of secret only — no plaintext.
    expect(row?.webhookSecretHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects inside_sales (org_admin required)', async () => {
    const t = await tokenFor(insideEmailA, insidePassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/providers/claude_copy/connect',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-rbac-1' },
      payload: { credentials: {}, mode: 'sandbox' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects missing Idempotency-Key', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/providers/claude_copy/connect',
      headers: { authorization: `Bearer ${t}` },
      payload: { credentials: {}, mode: 'sandbox' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('writes an audit event with action=providerConnection.connected', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-conn-audit-1');
    const audit = await prisma().auditEvent.findFirst({
      where: { orgId: orgA, action: 'providerConnection.connected' },
      orderBy: { id: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.resourceType).toBe('ProviderConnection');
  });
});

describe('DELETE /v1/marketing/providers/:kind', () => {
  it('soft-disconnects', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-disc-1');
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/marketing/providers/claude_copy',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().connection.status).toBe('disconnected');
    expect(res.json().connection.disconnectedAt).toBeTruthy();
  });

  it('rejects inside_sales (org_admin required)', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    await connect(tA, 'claude_copy', 'mkt-disc-rbac-1');
    const tI = await tokenFor(insideEmailA, insidePassA);
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/marketing/providers/claude_copy',
      headers: { authorization: `Bearer ${tI}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /v1/marketing/providers/:kind/status', () => {
  it('returns live ping status', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-status-1');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers/claude_copy/status',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().connection.status).toBe('connected');
    expect(res.json().connection.lastPingStatus).toBe('ok');
  });

  it('404s when not connected', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/providers/claude_copy/status',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Creative generation — sync (claude_copy)
// ───────────────────────────────────────────────────────────────────────────

describe('POST /v1/marketing/creatives/generate — sync', () => {
  it('returns ready inline for claude_copy with persisted job', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-gen-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-gen-job-1' },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'Write a door-knock script for charity X.', maxTokens: 50 },
      },
    });
    expect(res.statusCode).toBe(201);
    const job = res.json().job;
    expect(job.status).toBe('ready');
    expect(job.providerKind).toBe('claude_copy');
    expect(job.capability).toBe('creative.generate.text');
    expect(job.modelId).toBeTruthy();
    expect(job.outputJson?.text).toMatch(/^\[stub:/);
    expect(job.outputJson?.safetyScanResult).toBe('pass');
    // Row exists in DB.
    const row = await prisma().contentGenerationJob.findUnique({ where: { id: job.id } });
    expect(row?.status).toBe('ready');
  });

  it('returns 412 when provider not connected', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-gen-noconn-1' },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'Hi' },
      },
    });
    expect(res.statusCode).toBe(412);
  });

  it('persists costCents from adapter output', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-cost-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-cost-job-1' },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'Write a tagline' },
      },
    });
    const job = res.json().job;
    // Stub adapter returns costCents=1.
    expect(job.costCents).toBe('1');
  });

  it('rejects discriminated union with mismatched input', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'flux_image', 'mkt-mismatch-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-mismatch-job-1' },
      payload: {
        capability: 'creative.generate.image',
        providerKind: 'flux_image',
        input: { prompt: 'no aspect or count' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires idempotency-key', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-idem-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}` },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'no key' },
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Creative generation — async (runway_video)
// ───────────────────────────────────────────────────────────────────────────

describe('POST /v1/marketing/creatives/generate — async', () => {
  it('persists running job with externalJobId for runway', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'runway_video', 'mkt-rw-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-rw-job-1' },
      payload: {
        capability: 'creative.generate.video',
        providerKind: 'runway_video',
        input: { prompt: 'Hero shot', durationSec: 5, aspectRatio: '9:16' },
      },
    });
    expect(res.statusCode).toBe(201);
    const job = res.json().job;
    expect(job.status).toBe('running');
    expect(job.externalJobId).toMatch(/^job_stub_/);
    expect(job.outputJson?.estimatedReadyAt).toBeTruthy();
  });

  it('GET /jobs/:id returns running until stub elapse', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'runway_video', 'mkt-rw-poll-1');
    const create = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-rw-poll-job-1' },
      payload: {
        capability: 'creative.generate.video',
        providerKind: 'runway_video',
        input: { prompt: 'Brand opener', durationSec: 5, aspectRatio: '16:9' },
      },
    });
    const jobId = create.json().job.id;
    const res = await app.inject({
      method: 'GET',
      url: `/v1/marketing/creatives/jobs/${jobId}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().job.status).toBe('running');
  });

  it('GET /jobs/:id flips to ready after backdating createdAt past stub threshold', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'runway_video', 'mkt-rw-ready-1');
    const create = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-rw-ready-job-1' },
      payload: {
        capability: 'creative.generate.video',
        providerKind: 'runway_video',
        input: { prompt: 'B-roll', durationSec: 5, aspectRatio: '9:16' },
      },
    });
    const jobId = create.json().job.id;
    // Simulate elapsed time by backdating createdAt.
    await prisma().contentGenerationJob.update({
      where: { id: jobId },
      data: { createdAt: new Date(Date.now() - STUB_READY_AFTER_MS - 1000) },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/marketing/creatives/jobs/${jobId}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().job.status).toBe('ready');
    expect(res.json().job.completedAt).toBeTruthy();
  });

  it('async heygen avatar persists externalJobId', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'heygen_avatar', 'mkt-hg-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-hg-job-1' },
      payload: {
        capability: 'creative.generate.avatar',
        providerKind: 'heygen_avatar',
        input: { script: 'Hi there', avatarId: 'av1', voiceId: 'vc1' },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().job.status).toBe('running');
    expect(res.json().job.externalJobId).toMatch(/^job_stub_/);
  });

  it('higgsfield also async', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'higgsfield', 'mkt-hf-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-hf-job-1' },
      payload: {
        capability: 'creative.generate.video',
        providerKind: 'higgsfield',
        input: { prompt: 'TikTok hook', durationSec: 8, aspectRatio: '9:16' },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().job.providerKind).toBe('higgsfield');
    expect(res.json().job.status).toBe('running');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Listing jobs
// ───────────────────────────────────────────────────────────────────────────

describe('GET /v1/marketing/creatives/jobs', () => {
  it('lists jobs scoped to org', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    await connect(tA, 'claude_copy', 'mkt-list-conn-1');
    await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'mkt-list-job-1' },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'A only' },
      },
    });
    const aList = await app.inject({
      method: 'GET',
      url: '/v1/marketing/creatives/jobs',
      headers: { authorization: `Bearer ${tA}` },
    });
    expect(aList.statusCode).toBe(200);
    expect(aList.json().data).toHaveLength(1);
    const bList = await app.inject({
      method: 'GET',
      url: '/v1/marketing/creatives/jobs',
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(bList.json().data).toEqual([]);
  });

  it('filters by status', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-filt-conn-1');
    await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-filt-job-1' },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'tagline' },
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/creatives/jobs?status=ready',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.json().data).toHaveLength(1);
    const none = await app.inject({
      method: 'GET',
      url: '/v1/marketing/creatives/jobs?status=failed',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(none.json().data).toEqual([]);
  });

  it('cross-tenant 404 on read by id (foreign job invisible)', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    await connect(tA, 'claude_copy', 'mkt-iso-conn-1');
    const create = await app.inject({
      method: 'POST',
      url: '/v1/marketing/creatives/generate',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'mkt-iso-job-1' },
      payload: {
        capability: 'creative.generate.text',
        providerKind: 'claude_copy',
        input: { prompt: 'a' },
      },
    });
    const id = create.json().job.id;
    const res = await app.inject({
      method: 'GET',
      url: `/v1/marketing/creatives/jobs/${id}`,
      headers: { authorization: `Bearer ${tB}` },
    });
    // getJob reads through tenantPrismaTx(actor.orgId): org A's job is invisible
    // to org B (orgId filter at the app layer + RLS belt under d2d_app), so the
    // read resolves to null → notFound, not the pre-belt 403 tenantMismatch. The
    // existence oracle closes — org B can't tell "forbidden" from "doesn't exist".
    // See docs/runbooks/rls-cutover.md §4b.1.
    expect(res.statusCode).toBe(404);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Inbound webhook receiver
// ───────────────────────────────────────────────────────────────────────────

describe('POST /v1/marketing/webhooks/:kind', () => {
  it('verifies HMAC + persists event', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const secret = await connect(t, 'higgsfield', 'mkt-whk-conn-1');
    const bodyObj = {
      job_id: 'hf_real_001',
      status: 'ready',
      ready_at: new Date().toISOString(),
      url: 'https://hf.example.com/v1.mp4',
    };
    const body = JSON.stringify(bodyObj);
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers: {
        'content-type': 'application/json',
        'x-d2d-org': orgA,
        'x-higgsfield-signature': sig,
      },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().event.verifiedSignature).toBe(true);
    expect(res.json().event.externalId).toBe('hf_real_001');
    // Row in DB.
    const row = await prisma().providerWebhookEvent.findUnique({
      where: { providerKind_externalId: { providerKind: 'higgsfield', externalId: 'hf_real_001' } },
    });
    expect(row?.eventType).toBe('higgsfield.video.ready');
  });

  it('rejects with 401 + persists failed-sig record on bad HMAC', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'higgsfield', 'mkt-whk-bad-1');
    const body = JSON.stringify({ job_id: 'bad', status: 'ready' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers: {
        'content-type': 'application/json',
        'x-d2d-org': orgA,
        'x-higgsfield-signature': 'deadbeef' + 'ff'.repeat(28),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    const cnt = await prisma().providerWebhookEvent.count({
      where: { orgId: orgA, verifiedSignature: false },
    });
    expect(cnt).toBe(1);
  });

  it('rejects with 401 when signature missing', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'higgsfield', 'mkt-whk-nosig-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers: { 'content-type': 'application/json', 'x-d2d-org': orgA },
      payload: { job_id: 'x', status: 'ready' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('dedupes on (kind, externalId) replay', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const secret = await connect(t, 'higgsfield', 'mkt-whk-dup-1');
    const bodyObj = { job_id: 'dup_001', status: 'ready' };
    const body = JSON.stringify(bodyObj);
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const headers = {
      'content-type': 'application/json',
      'x-d2d-org': orgA,
      'x-higgsfield-signature': sig,
    } as const;
    const a = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers,
      payload: body,
    });
    expect(a.statusCode).toBe(202);
    const b = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers,
      payload: body,
    });
    // Second arrival also 202 — returns the cached event (no duplicate row).
    expect(b.statusCode).toBe(202);
    const cnt = await prisma().providerWebhookEvent.count({
      where: { providerKind: 'higgsfield', externalId: 'dup_001' },
    });
    expect(cnt).toBe(1);
  });

  it('requires x-d2d-org header', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'higgsfield', 'mkt-whk-noorg-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers: { 'content-type': 'application/json' },
      payload: { job_id: 'noorg', status: 'ready' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('signs raw bytes verbatim — leading whitespace + key-order preserved (SEC-007)', async () => {
    // SEC-007 regression: Fastify's default JSON parser re-canonicalises
    // payloads (strips whitespace, re-orders keys, normalises escapes).
    // Providers HMAC the bytes they sent, not our recanonicalisation. The
    // raw-body parser must preserve the original bytes so the signature
    // still verifies. We send a body with leading whitespace + an unusual
    // key order — a wire payload that the old re-serialise path would
    // have mutated and broken.
    const t = await tokenFor(adminEmailA, adminPassA);
    const secret = await connect(t, 'higgsfield', 'mkt-whk-raw-1');
    const rawBody =
      '   {"status":"ready","job_id":"hf_raw_001","ready_at":"2026-05-27T10:00:00Z"}   ';
    const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/webhooks/higgsfield',
      headers: {
        'content-type': 'application/json',
        'x-d2d-org': orgA,
        'x-higgsfield-signature': sig,
      },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().event.verifiedSignature).toBe(true);
    expect(res.json().event.externalId).toBe('hf_raw_001');
  });
});

describe('GET /v1/marketing/webhooks/:kind/recent', () => {
  it('lists recent events for the org', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const secret = await connect(t, 'higgsfield', 'mkt-whk-list-1');
    for (let i = 0; i < 3; i++) {
      const body = JSON.stringify({ job_id: `rl_${i}`, status: 'ready' });
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      await app.inject({
        method: 'POST',
        url: '/v1/marketing/webhooks/higgsfield',
        headers: {
          'content-type': 'application/json',
          'x-d2d-org': orgA,
          'x-higgsfield-signature': sig,
        },
        payload: body,
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/v1/marketing/webhooks/higgsfield/recent',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Audience build + campaign deliver — adapter calls
// ───────────────────────────────────────────────────────────────────────────

describe('POST /v1/marketing/audiences/build + /campaigns/deliver', () => {
  it('audience.build returns failed for adapter without method', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    await connect(t, 'claude_copy', 'mkt-aud-1');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/marketing/audiences/build',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'mkt-aud-job-1' },
      payload: {
        providerKind: 'claude_copy',
        input: {
          name: 'x',
          hashedIdentifiers: ['a'.repeat(64)],
          countryCode: 'US',
        },
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
