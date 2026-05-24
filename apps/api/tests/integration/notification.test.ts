/**
 * Notification integration tests — sms/email/push queue path, recipient
 * hashing, listing, role gates.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { setUserPassword } from '../../src/domains/auth/service';
import { prisma } from '../../src/config/db';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const orgA = 'org_TEST_NTF_ALPHA';
const adminA = 'usr_TEST_NTF_ALPHA_ADMIN';
const adminEmailA = 'admin@ntf.test';
const adminPassA = 'NtfAdminPwd_1';

const managerA = 'usr_TEST_NTF_ALPHA_MGR';
const managerEmailA = 'manager@ntf.test';
const managerPassA = 'NtfMgrPwd_1';

const knockerA = 'usr_TEST_NTF_ALPHA_KNOCKER';
const knockerEmailA = 'knocker@ntf.test';
const knockerPassA = 'NtfKnockerPwd_1';

const superA = 'usr_TEST_NTF_ALPHA_SUPER';
const superEmailA = 'super@ntf.test';
const superPassA = 'NtfSuperPwd_1';

async function seed(): Promise<void> {
  await prisma().org.create({
    data: {
      id: orgA,
      legalName: 'Ntf A',
      tradingName: 'NA',
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
    },
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
        id: superA,
        orgId: orgA,
        email: superEmailA,
        emailDigest: emailDigest(superEmailA, process.env.PII_SEARCH_KEY!),
        givenName: 'S',
        familyName: 'Admin',
        role: 'super_admin',
        regionCode: 'US',
      },
    ],
  });
  await setUserPassword(adminA, adminPassA);
  await setUserPassword(managerA, managerPassA);
  await setUserPassword(knockerA, knockerPassA);
  await setUserPassword(superA, superPassA);
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

describe('POST /v1/notifications/sms', () => {
  it('manager can queue an SMS — recipient hashed, status queued', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/sms',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-sms-1' },
      payload: { to: '+15555550101', body: 'Hi, just a reminder.', regionCode: 'US' },
    });
    expect(res.statusCode).toBe(202);
    const notif = res.json().notification;
    expect(notif.id).toMatch(/^nlg_/);
    expect(notif.status).toBe('queued');
    expect(notif.channel).toBe('sms');
    expect(notif.recipientHash).toMatch(/^[a-f0-9]{64}$/);
    expect(notif).not.toHaveProperty('to');
  });

  it('knocker is rejected', async () => {
    const t = await tokenFor(knockerEmailA, knockerPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/sms',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-sms-rbac-1' },
      payload: { to: '+15555550101', body: 'Hi.' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Zod rejects non-E.164 phone', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/sms',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-sms-bad-1' },
      payload: { to: '5555550101', body: 'Hi.' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('idempotency replay returns same id', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const first = await app.inject({
      method: 'POST',
      url: '/v1/notifications/sms',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-sms-replay-1' },
      payload: { to: '+15555550101', body: 'Hi.' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/notifications/sms',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-sms-replay-1' },
      payload: { to: '+15555550101', body: 'Hi.' },
    });
    expect(second.json().notification.id).toBe(first.json().notification.id);
  });
});

describe('POST /v1/notifications/email', () => {
  it('manager can queue an email', async () => {
    const t = await tokenFor(managerEmailA, managerPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/email',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-email-1' },
      payload: {
        to: 'recipient@example.com',
        subject: 'Thanks for your donation',
        body: 'We appreciate your support!',
        fromBrand: 'Pilot Charlie',
      },
    });
    expect(res.statusCode).toBe(202);
    const notif = res.json().notification;
    expect(notif.channel).toBe('email');
    expect(notif.subject).toBe('Thanks for your donation');
    expect(notif.fromBrand).toBe('Pilot Charlie');
  });

  it('Zod rejects bad email', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/email',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-email-bad-1' },
      payload: { to: 'not-an-email', subject: 'x', body: 'y' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /v1/notifications/push', () => {
  it('super_admin can queue a push', async () => {
    const t = await tokenFor(superEmailA, superPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/push',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-push-1' },
      payload: {
        deviceId: 'device-abc-123456789',
        title: 'New lead assigned',
        body: 'You have a new lead in your queue',
      },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().notification.channel).toBe('push');
  });

  it('org_admin is rejected (super_admin only)', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/push',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-push-rbac-1' },
      payload: { deviceId: 'device-abc-123456789', title: 't', body: 'b' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /v1/notifications', () => {
  it('lists notifications scoped to org with filters + pagination', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/notifications/sms',
        headers: { authorization: `Bearer ${t}`, 'idempotency-key': `ntf-list-sms-${i}` },
        payload: { to: `+155555501${i}0`, body: `msg ${i}` },
      });
    }
    await app.inject({
      method: 'POST',
      url: '/v1/notifications/email',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-list-email-1' },
      payload: { to: 'a@example.com', subject: 's', body: 'b' },
    });
    const all = await app.inject({
      method: 'GET',
      url: '/v1/notifications',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(all.statusCode).toBe(200);
    expect(all.json().data.length).toBe(4);

    const emailOnly = await app.inject({
      method: 'GET',
      url: '/v1/notifications?channel=email',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(emailOnly.json().data).toHaveLength(1);
    expect(emailOnly.json().data[0].channel).toBe('email');

    const paged = await app.inject({
      method: 'GET',
      url: '/v1/notifications?limit=2',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(paged.json().data).toHaveLength(2);
    expect(paged.json().nextCursor).toBeTruthy();
  });

  it('requires JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/notifications',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Body preview truncation + audit', () => {
  it('truncates body preview at 200 chars and writes audit row', async () => {
    const t = await tokenFor(adminEmailA, adminPassA);
    const longBody = 'x'.repeat(500);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/sms',
      headers: { authorization: `Bearer ${t}`, 'idempotency-key': 'ntf-long-1' },
      payload: { to: '+15555550199', body: longBody },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().notification.bodyPreview.length).toBe(200);
    expect(res.json().notification.bodyPreview.endsWith('...')).toBe(true);
    const audit = await prisma().auditEvent.findFirst({
      where: { orgId: orgA, action: 'notification.sms_queued' },
    });
    expect(audit).toBeTruthy();
  });
});
