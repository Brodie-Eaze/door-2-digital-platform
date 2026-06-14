/**
 * Cross-tenant isolation probe (C8 / Gate 9).
 *
 * Two orgs (Alpha, Bravo) are seeded. Every test asserts that Bravo's JWT
 * cannot read, write, or enumerate Alpha's data.
 *
 * Expected HTTP status for direct-id reads of another tenant's row: 404.
 * (tenantMismatch() returns a generic 404 "Resource not found" — the
 * cross-tenant id is indistinguishable from a non-existent one, preventing
 * enumeration via 403 leak.)
 *
 * For LIST endpoints, cross-tenant JWTs receive an empty result set (the
 * tenant-scoped Prisma client injects `where: { orgId }` automatically).
 *
 * This file is the authoritative synthetic isolation test referenced in
 * docs/GAP-MAP.md (C8) and .github/workflows/ci.yml (Gate 9).
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;

// ── fixtures ──────────────────────────────────────────────────────────────────

const ORG_ALPHA = 'org_ISOLATION_ALPHA';
const ORG_BRAVO = 'org_ISOLATION_BRAVO';
const USR_ALPHA = 'usr_ISOLATION_ALPHA_ADMIN';
const USR_BRAVO = 'usr_ISOLATION_BRAVO_ADMIN';
const EMAIL_ALPHA = 'alpha-admin@isolation.test';
const EMAIL_BRAVO = 'bravo-admin@isolation.test';
const PASS_ALPHA = 'AlphaAdminPwd_42!';
const PASS_BRAVO = 'BravoAdminPwd_42!';
const TERRITORY_ALPHA = 'ter_ISOLATION_ALPHA_01';

const WKT = 'POLYGON((-97.7 30.27, -97.69 30.27, -97.69 30.28, -97.7 30.28, -97.7 30.27))';

async function seed(): Promise<void> {
  await prisma().org.createMany({
    data: [
      {
        id: ORG_ALPHA,
        legalName: 'Alpha Org',
        tradingName: 'Alpha',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
      {
        id: ORG_BRAVO,
        legalName: 'Bravo Org',
        tradingName: 'Bravo',
        vertical: 'charity',
        type: 'client',
        regionCode: 'US',
      },
    ],
  });
  await prisma().user.createMany({
    data: [
      {
        id: USR_ALPHA,
        orgId: ORG_ALPHA,
        email: EMAIL_ALPHA,
        emailDigest: emailDigest(EMAIL_ALPHA, process.env.PII_SEARCH_KEY!),
        givenName: 'Alpha',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
      {
        id: USR_BRAVO,
        orgId: ORG_BRAVO,
        email: EMAIL_BRAVO,
        emailDigest: emailDigest(EMAIL_BRAVO, process.env.PII_SEARCH_KEY!),
        givenName: 'Bravo',
        familyName: 'Admin',
        role: 'org_admin',
        regionCode: 'US',
      },
    ],
  });
  await prisma().territory.create({
    data: {
      id: TERRITORY_ALPHA,
      orgId: ORG_ALPHA,
      regionCode: 'US',
      name: 'Alpha Territory',
      vertical: 'charity',
      polygon: WKT,
      centroid: '-97.695 30.275',
      s2CellIds: ['S2L13_-97.695_30.275'],
    },
  });
  await setUserPassword(USR_ALPHA, PASS_ALPHA);
  await setUserPassword(USR_BRAVO, PASS_BRAVO);
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
  });
  expect(res.statusCode, 'login must succeed').toBe(200);
  return res.json<{ accessToken: string }>().accessToken;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('cross-tenant isolation', () => {
  let tokenAlpha: string;
  let tokenBravo: string;

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
    [tokenAlpha, tokenBravo] = await Promise.all([
      tokenFor(EMAIL_ALPHA, PASS_ALPHA),
      tokenFor(EMAIL_BRAVO, PASS_BRAVO),
    ]);
  });

  // ── Territory ──────────────────────────────────────────────────────────────

  describe('Territory', () => {
    it('Alpha can GET its own territory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/territories/${TERRITORY_ALPHA}`,
        headers: { authorization: `Bearer ${tokenAlpha}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().territory.id).toBe(TERRITORY_ALPHA);
    });

    it('Bravo gets 404 reading Alphas territory by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/territories/${TERRITORY_ALPHA}`,
        headers: { authorization: `Bearer ${tokenBravo}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Bravo list returns empty (not Alphas territories)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/territories',
        headers: { authorization: `Bearer ${tokenBravo}` },
      });
      expect(res.statusCode).toBe(200);
      // Bravo has no territories — must not leak Alpha's
      const body = res.json<{ data: unknown[] }>();
      expect(body.data).toHaveLength(0);
    });
  });

  // ── Knock session ──────────────────────────────────────────────────────────

  describe('Knock session', () => {
    it('Bravo cannot start a session on Alphas territory', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: {
          authorization: `Bearer ${tokenBravo}`,
          'idempotency-key': newId('ik'),
        },
        payload: {
          territoryId: TERRITORY_ALPHA,
          deviceId: 'bravo-device',
          startGeo: { lat: 30.275, lng: -97.695 },
        },
      });
      // Territory not found in Bravo's tenant scope → 404
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Lead ───────────────────────────────────────────────────────────────────

  describe('Lead', () => {
    let leadAlphaId: string;

    beforeEach(async () => {
      // Create a lead directly in Alpha's org
      const lead = await prisma().lead.create({
        data: {
          id: newId('led'),
          orgId: ORG_ALPHA,
          regionCode: 'US',
          vertical: 'charity',
          givenName: 'Secret',
          familyName: 'Person',
          status: 'new',
        },
      });
      leadAlphaId = lead.id;
    });

    it('Alpha can GET its own lead', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/leads/${leadAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlpha}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('Bravo gets 404 reading Alphas lead by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/leads/${leadAlphaId}`,
        headers: { authorization: `Bearer ${tokenBravo}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Bravo lead list does not include Alphas leads', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/leads',
        headers: { authorization: `Bearer ${tokenBravo}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { id: string }[] }>();
      const ids = body.data.map((l) => l.id);
      expect(ids).not.toContain(leadAlphaId);
    });
  });

  // ── User ───────────────────────────────────────────────────────────────────

  describe('User', () => {
    it('Bravo gets 404 reading Alphas user by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${USR_ALPHA}`,
        headers: { authorization: `Bearer ${tokenBravo}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Bravo user list does not include Alphas users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${tokenBravo}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { id: string }[] }>();
      const ids = body.data.map((u) => u.id);
      expect(ids).not.toContain(USR_ALPHA);
    });
  });
});
