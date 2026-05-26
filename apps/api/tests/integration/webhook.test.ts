/**
 * Webhook integration tests — endpoint register (plaintext secret), list,
 * rotate, soft-delete, deliveries list, signPayload determinism.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';
import { WebhookService } from '../../src/domains/webhook/service';

let app: FastifyInstance;

const orgA = 'org_TEST_WHK_ALPHA';
const adminA = 'usr_TEST_WHK_ALPHA_ADMIN';
const adminEmailA = 'admin@whk.test';
const adminPassA = 'WhkAdminPwd_1';

const insideA = 'usr_TEST_WHK_ALPHA_IS';
const insideEmailA = 'is@whk.test';
const insidePassA = 'WhkInsidePwd_1';

const orgB = 'org_TEST_WHK_BRAVO';
const adminB = 'usr_TEST_WHK_BRAVO_ADMIN';
const adminEmailB = 'b@whk.test';
const adminPassB = 'WhkAdminPwd_2';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: orgA,
        legalName: 'Whk A',
        tradingName: 'WA',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: orgB,
        legalName: 'Whk B',
        tradingName: 'WB',
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

describe('WebhookService.signPayload', () => {
  it('produces a deterministic signature for the same inputs', () => {
    const sig1 = WebhookService.signPayload('s3cr3t', '{"hi":"there"}', 1700000000);
    const sig2 = WebhookService.signPayload('s3cr3t', '{"hi":"there"}', 1700000000);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
  });

  it('verifies a freshly-signed payload (constant-time)', () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = WebhookService.signPayload('correct horse', 'payload', ts);
    expect(
      WebhookService.verifySignature({
        secret: 'correct horse',
        body: 'payload',
        header: sig,
        now: ts,
      }),
    ).toBe(true);
  });

  it('rejects sig from a different secret', () => {
    const sig = WebhookService.signPayload('right', 'p', 1700000000);
    expect(
      WebhookService.verifySignature({
        secret: 'wrong',
        body: 'p',
        header: sig,
        now: 1700000000,
      }),
    ).toBe(false);
  });

  it('rejects sig outside tolerance window', () => {
    const sig = WebhookService.signPayload('right', 'p', 1700000000);
    expect(
      WebhookService.verifySignature({
        secret: 'right',
        body: 'p',
        header: sig,
        // 1 hour later — outside ±5min default
        now: 1700000000 + 3600,
      }),
    ).toBe(false);
  });
});

describe('POST /v1/webhooks/endpoints', () => {
  it('registers an endpoint and returns plaintext secret once', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-create-1' },
      payload: {
        url: 'https://example.com/d2d',
        eventTypes: ['lead.created', 'conversion.created'],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().endpoint.id).toMatch(/^whk_/);
    expect(res.json().endpoint.secret).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    // DB row stores only the hash.
    const row = await prisma().webhookEndpoint.findUnique({
      where: { id: res.json().endpoint.id },
    });
    expect(row?.secretCipher).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.secretCipher).not.toBe(res.json().endpoint.secret);
  });

  it('rejects inside_sales (org_admin required)', async () => {
    const t = await tokenFor(insideEmailA, insidePassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-rbac-1' },
      payload: {
        url: 'https://example.com/role',
        eventTypes: ['lead.created'],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Zod rejects bad URL', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-bad-url-1' },
      payload: {
        url: 'not-a-url',
        eventTypes: ['lead.created'],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // SEC-008: SSRF allowlist on webhook URL registration.
  describe('SEC-008 SSRF allowlist', () => {
    it('rejects http:// scheme (https only)', async () => {
      const t = await tokenFor(adminEmailA, adminPassA);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/endpoints',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-ssrf-http-1' },
        payload: {
          url: 'http://example.com/d2d',
          eventTypes: ['lead.created'],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().type).toBe('https://docs.d2d.io/problems/webhook-url-rejected');
    });

    it('rejects AWS metadata IP (169.254.169.254)', async () => {
      const t = await tokenFor(adminEmailA, adminPassA);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/endpoints',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-ssrf-meta-1' },
        payload: {
          url: 'https://169.254.169.254/latest/meta-data/',
          eventTypes: ['lead.created'],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().type).toBe('https://docs.d2d.io/problems/webhook-url-rejected');
    });

    it('rejects RFC1918 IP (10.0.0.1)', async () => {
      const t = await tokenFor(adminEmailA, adminPassA);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/endpoints',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-ssrf-rfc1918-1' },
        payload: {
          url: 'https://10.0.0.1/hook',
          eventTypes: ['lead.created'],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().type).toBe('https://docs.d2d.io/problems/webhook-url-rejected');
    });

    it('rejects non-443 port', async () => {
      const t = await tokenFor(adminEmailA, adminPassA);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/endpoints',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-ssrf-port-1' },
        payload: {
          url: 'https://example.com:8080/hook',
          eventTypes: ['lead.created'],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().type).toBe('https://docs.d2d.io/problems/webhook-url-rejected');
    });

    it('accepts a hostname that resolves to a public IP', async () => {
      // example.com resolves to 23.x.x.x — public unicast.
      const t = await tokenFor(adminEmailA, adminPassA);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/endpoints',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-ssrf-ok-1' },
        payload: {
          url: 'https://example.com/d2d-hook',
          eventTypes: ['lead.created'],
        },
      });
      expect(res.statusCode).toBe(201);
    });
  });
});

describe('GET /v1/webhooks/endpoints', () => {
  it('lists endpoints scoped to actor org with pagination', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/webhooks/endpoints',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': `whk-list-${i}` },
        payload: {
          url: `https://example.com/list-${i}`,
          eventTypes: ['lead.created'],
        },
      });
    }
    const res = await app.inject({
      method: 'GET',
      url: '/v1/webhooks/endpoints?limit=2',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    expect(res.json().nextCursor).toBeTruthy();

    const next = await app.inject({
      method: 'GET',
      url: `/v1/webhooks/endpoints?limit=2&cursor=${res.json().nextCursor}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().data).toHaveLength(1);
  });

  it('tenant isolation', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'whk-iso-1' },
      payload: { url: 'https://example.com/iso', eventTypes: ['lead.created'] },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(res.json().data).toEqual([]);
  });
});

describe('POST /v1/webhooks/endpoints/:id/rotate-secret', () => {
  it('mints a new secret', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const create = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-rot-1' },
      payload: { url: 'https://example.com/rot', eventTypes: ['lead.created'] },
    });
    const id = create.json().endpoint.id;
    const initialSecret = create.json().endpoint.secret;
    const rot = await app.inject({
      method: 'POST',
      url: `/v1/webhooks/endpoints/${id}/rotate-secret`,
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-rot-2' },
      payload: {},
    });
    expect(rot.statusCode).toBe(200);
    expect(rot.json().endpoint.secret).not.toBe(initialSecret);
    expect(rot.json().endpoint.secret).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    // The new signature with the rotated secret should verify, and the old
    // secret should NOT (no overlap window in Phase 1.1).
    const ts = Math.floor(Date.now() / 1000);
    const newSecret = rot.json().endpoint.secret;
    const goodSig = createHmac('sha256', newSecret).update(`${ts}.payload`).digest('hex');
    const expected = `t=${ts},v1=${goodSig}`;
    expect(
      WebhookService.verifySignature({
        secret: newSecret,
        body: 'payload',
        header: expected,
        now: ts,
      }),
    ).toBe(true);
  });
});

describe('DELETE /v1/webhooks/endpoints/:id', () => {
  it('soft-deletes (status archived)', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const create = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-del-1' },
      payload: { url: 'https://example.com/del', eventTypes: ['lead.created'] },
    });
    const id = create.json().endpoint.id;
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/webhooks/endpoints/${id}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().endpoint.status).toBe('archived');
  });
});

describe('GET /v1/webhooks/endpoints/:id/deliveries', () => {
  it('returns empty list for a new endpoint', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const create = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'whk-deliv-1' },
      payload: { url: 'https://example.com/deliv', eventTypes: ['lead.created'] },
    });
    const id = create.json().endpoint.id;
    const res = await app.inject({
      method: 'GET',
      url: `/v1/webhooks/endpoints/${id}/deliveries`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(res.json().nextCursor).toBeNull();
  });

  it('cross-tenant returns 403', async () => {
    const tA = await tokenFor(adminEmailA, adminPassA);
    const tB = await tokenFor(adminEmailB, adminPassB);
    const create = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/endpoints',
      headers: { authorization: `Bearer ${tA}`, 'idempotency-key': 'whk-deliv-iso-1' },
      payload: { url: 'https://example.com/deliv-iso', eventTypes: ['lead.created'] },
    });
    const id = create.json().endpoint.id;
    const res = await app.inject({
      method: 'GET',
      url: `/v1/webhooks/endpoints/${id}/deliveries`,
      headers: { authorization: `Bearer ${tB}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
