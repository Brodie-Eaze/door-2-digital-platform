/**
 * Notification service — Phase 1.3 real (queue path only; sending is Phase 1.2
 * worker territory — Twilio / Resend / FCM are *not* installed here).
 *
 * Every `send*` method persists a NotificationLog row (status='queued') and
 * returns 202. A background worker picks it up later and calls the actual
 * provider. The recipient is HMAC-hashed on the row so a DB scan never
 * yields plaintext numbers / emails.
 */
import { createHmac } from 'node:crypto';
import type { Prisma, RegionCode } from '@prisma/client';
import { newId } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { AuditService } from '../audit/service';
import type {
  ListNotificationsQuery,
  SendEmailRequest,
  SendPushRequest,
  SendSmsRequest,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface NotificationPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  channel: string;
  recipientHash: string;
  subject: string | null;
  bodyPreview: string;
  fromBrand: string | null;
  status: string;
  providerExternalId: string | null;
  providerError: string | null;
  createdAt: string;
  sentAt: string | null;
}

function hashRecipient(channel: string, recipient: string): string {
  // PII_HASH_SECRET is shared across messages — receivers can prove their
  // address matches a log row without revealing other addresses.
  return createHmac('sha256', env().PII_HASH_SECRET)
    .update(`${channel}:${recipient.trim().toLowerCase()}`)
    .digest('hex');
}

function previewOf(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length <= 200 ? oneLine : `${oneLine.slice(0, 197)}...`;
}

async function enqueue(args: {
  channel: 'sms' | 'email' | 'push';
  recipientHash: string;
  subject: string | null;
  body: string;
  fromBrand: string | null;
  payload: Record<string, unknown>;
  actor: ActorContext;
}): Promise<NotificationPublic> {
  const id = newId('nlg');
  const row = await prisma().$transaction(async (tx) => {
    const next = await tx.notificationLog.create({
      data: {
        id,
        orgId: args.actor.orgId,
        regionCode: args.actor.regionCode,
        channel: args.channel,
        recipientHash: args.recipientHash,
        subject: args.subject,
        bodyPreview: previewOf(args.body),
        fromBrand: args.fromBrand,
        status: 'queued',
        payload: args.payload as Prisma.InputJsonValue,
      },
    });
    await AuditService.recordEvent(tx, {
      orgId: args.actor.orgId,
      regionCode: args.actor.regionCode,
      actorUserId: args.actor.userId,
      action: `notification.${args.channel}_queued`,
      resourceType: 'NotificationLog',
      resourceId: id,
      afterJson: {
        channel: args.channel,
        recipientHash: args.recipientHash,
        bodyPreview: previewOf(args.body),
      },
    });
    return next;
  });
  return toPublic(row);
}

export async function sendSms(
  input: SendSmsRequest,
  actor: ActorContext,
): Promise<NotificationPublic> {
  return enqueue({
    channel: 'sms',
    recipientHash: hashRecipient('sms', input.to),
    subject: null,
    body: input.body,
    fromBrand: null,
    payload: { ...(input.leadId && { leadId: input.leadId }) },
    actor,
  });
}

export async function sendEmail(
  input: SendEmailRequest,
  actor: ActorContext,
): Promise<NotificationPublic> {
  return enqueue({
    channel: 'email',
    recipientHash: hashRecipient('email', input.to),
    subject: input.subject,
    body: input.body,
    fromBrand: input.fromBrand ?? null,
    payload: { ...(input.leadId && { leadId: input.leadId }) },
    actor,
  });
}

export async function sendPush(
  input: SendPushRequest,
  actor: ActorContext,
): Promise<NotificationPublic> {
  return enqueue({
    channel: 'push',
    recipientHash: hashRecipient('push', input.deviceId),
    subject: input.title,
    body: input.body,
    fromBrand: null,
    payload: input.payload ?? {},
    actor,
  });
}

export async function listNotifications(
  query: ListNotificationsQuery,
  actor: ActorContext,
): Promise<{ data: NotificationPublic[]; nextCursor: string | null }> {
  const where: Prisma.NotificationLogWhereInput = { orgId: actor.orgId };
  if (query.channel) where.channel = query.channel;
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    const range: Prisma.DateTimeFilter = {};
    if (query.from) range.gte = new Date(query.from);
    if (query.to) range.lte = new Date(query.to);
    where.createdAt = range;
  }
  const rows = await prisma().notificationLog.findMany({
    where,
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
  });
  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toPublic), nextCursor };
}

function toPublic(r: {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  channel: string;
  recipientHash: string;
  subject: string | null;
  bodyPreview: string;
  fromBrand: string | null;
  status: string;
  providerExternalId: string | null;
  providerError: string | null;
  createdAt: Date;
  sentAt: Date | null;
}): NotificationPublic {
  return {
    id: r.id,
    orgId: r.orgId,
    regionCode: r.regionCode,
    channel: r.channel,
    recipientHash: r.recipientHash,
    subject: r.subject,
    bodyPreview: r.bodyPreview,
    fromBrand: r.fromBrand,
    status: r.status,
    providerExternalId: r.providerExternalId,
    providerError: r.providerError,
    createdAt: r.createdAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
  };
}
