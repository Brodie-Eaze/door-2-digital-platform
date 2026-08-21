/**
 * DSAR / RTBF integration tests (D7 evidence).
 *
 * Files a deletion DSAR against a lead carrying PII, fulfils it, and proves
 * the erasure actually happened at rest: name tombstoned, email/phone +
 * digests + vault blobs nulled. Also proves the no-lead path records the
 * manual-resolution audit gap instead of silently "fulfilling".
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest, newId } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_RTBF_ALPHA';
const userA = 'usr_TEST_RTBF_ALPHA';
const emailA = 'admin@rtbf.test';
const passwordA = 'RtbfAdminPwd_1';

async function seed(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgA,
      legalName: 'RA',
      tradingName: 'RA',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
  });
  await prisma().user.create({
    data: {
      id: userA,
      orgId: orgA,
      email: emailA,
      emailDigest: emailDigest(emailA, process.env.PII_SEARCH_KEY ?? ''),
      givenName: 'Rtbf',
      familyName: 'Admin',
      role: 'org_admin',
      regionCode: 'US',
      status: 'active',
    },
  });
  await setUserPassword(userA, passwordA);
}

async function login(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: emailA, password: passwordA },
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { accessToken: string }).accessToken;
}

async function seedLeadWithPii(): Promise<string> {
  const leadId = newId('led');
  await prisma().lead.create({
    data: {
      id: leadId,
      orgId: orgA,
      regionCode: 'US',
      brandCode: 'd2d',
      status: 'new',
      vertical: 'charity',
      givenName: 'Maria',
      familyName: 'Santos',
      email: 'maria.santos@example.com',
      emailDigest: emailDigest('maria.santos@example.com', process.env.PII_SEARCH_KEY ?? ''),
      phone: '+15125550142',
    },
  });
  return leadId;
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

describe('DSAR deletion → RTBF erasure at rest', () => {
  it('fulfilling a deletion DSAR tombstones the lead PII', async () => {
    const token = await login();
    const leadId = await seedLeadWithPii();

    const filed = await app.inject({
      method: 'POST',
      url: '/v1/dsar/requests',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_dsar_file_test' },
      payload: {
        kind: 'deletion',
        subjectEmail: 'maria.santos@example.com',
        subjectLeadId: leadId,
        jurisdiction: 'ccpa',
      },
    });
    expect(filed.statusCode).toBe(201);
    const dsarId = (filed.json() as { request: { id: string } }).request.id;

    const fulfilled = await app.inject({
      method: 'POST',
      url: `/v1/dsar/requests/${dsarId}/fulfil`,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_dsar_fulfil_test' },
      payload: {},
    });
    expect(fulfilled.statusCode).toBe(200);
    expect((fulfilled.json() as { request: { status: string } }).request.status).toBe('fulfilled');

    // The proof: PII is gone AT REST, not just marked done.
    const lead = await prisma().lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.givenName).toBe('[rtbf]');
    expect(lead.familyName).toBe('[rtbf]');
    expect(lead.email).toBeNull();
    expect(lead.emailDigest).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.phoneDigest).toBeNull();

    // And the erasure is audit-trailed.
    const audits = await prisma().auditEvent.findMany({
      where: { orgId: orgA, action: { contains: 'rtbf' } },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it('a deletion DSAR without a lead id records the manual-resolution gap in audit', async () => {
    const token = await login();

    const filed = await app.inject({
      method: 'POST',
      url: '/v1/dsar/requests',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'idem_dsar_nolead_test' },
      payload: {
        kind: 'deletion',
        subjectEmail: 'unknown.person@example.com',
        jurisdiction: 'gdpr',
      },
    });
    expect(filed.statusCode).toBe(201);
    const dsarId = (filed.json() as { request: { id: string } }).request.id;

    const fulfilled = await app.inject({
      method: 'POST',
      url: `/v1/dsar/requests/${dsarId}/fulfil`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'idem_dsar_nolead_fulfil',
      },
      payload: {},
    });
    expect(fulfilled.statusCode).toBe(200);

    const gap = await prisma().auditEvent.findFirst({
      where: { orgId: orgA, action: 'dsar.rtbf.skipped_no_lead' },
    });
    expect(gap).not.toBeNull();
  });
});
