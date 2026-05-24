/**
 * Webhook service — Phase 1.3 real (endpoint register/list/rotate/delete +
 * signing helper).
 *
 * Secret handling:
 *   - On register, generate a 256-bit random secret. Persist SHA-256 of it
 *     on the WebhookEndpoint row (`secretCipher` column — name kept for
 *     schema compatibility; logically a hash here). Return the plaintext
 *     secret in the response. Only this one time — the caller MUST capture.
 *   - `rotateSecret()` mints a new secret, updates the hash, returns
 *     plaintext once. (Phase 1.4 ships an overlap window so both old + new
 *     signatures are accepted for 24h.)
 *   - `signPayload(secret, body, timestamp)` returns
 *     `"t=<ts>,v1=<hmac>"` per the D2D-Signature spec.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Prisma, RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/service';
import type {
  CreateWebhookEndpointRequest,
  ListWebhookDeliveriesQuery,
  ListWebhookEndpointsQuery,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface WebhookEndpointPublic {
  id: string;
  orgId: string;
  url: string;
  eventTypes: string[];
  status: string;
  createdAt: string;
}

export interface WebhookEndpointWithSecret extends WebhookEndpointPublic {
  secret: string; // plaintext — returned exactly once
}

export interface WebhookDeliveryPublic {
  id: string;
  endpointId: string;
  eventId: string;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function generateSecret(): string {
  // 32-byte random base64url — printable, no padding.
  return randomBytes(32).toString('base64url');
}

export const WebhookService = {
  /**
   * Sign a payload per D2D-Signature spec. Returns
   * `t=<unix-seconds>,v1=<hex-hmac-sha256>`.
   *
   * The HMAC is over `<timestamp>.<rawBody>` so a stolen body cannot be
   * replayed at a different time. Receivers verify the timestamp is within
   * ±5min and that the HMAC matches.
   */
  signPayload(secret: string, body: string, timestamp: number): string {
    const msg = `${timestamp}.${body}`;
    const sig = createHmac('sha256', secret).update(msg).digest('hex');
    return `t=${timestamp},v1=${sig}`;
  },

  /**
   * Verify a signature header from a receiver perspective. Used by tests
   * + the future inbound webhook receiver. Constant-time.
   */
  verifySignature(args: {
    secret: string;
    body: string;
    header: string;
    toleranceSeconds?: number;
    now?: number;
  }): boolean {
    const match = /^t=(\d+),v1=([a-fA-F0-9]+)$/.exec(args.header);
    if (!match) return false;
    const ts = Number(match[1]);
    const v1 = match[2]!;
    const now = args.now ?? Math.floor(Date.now() / 1000);
    const tolerance = args.toleranceSeconds ?? 300;
    if (Math.abs(now - ts) > tolerance) return false;
    const expected = createHmac('sha256', args.secret).update(`${ts}.${args.body}`).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  async registerEndpoint(
    input: CreateWebhookEndpointRequest,
    actor: ActorContext,
  ): Promise<WebhookEndpointWithSecret> {
    const id = newId('whk');
    const secret = generateSecret();
    const hashed = hashSecret(secret);
    const row = await prisma().$transaction(async (tx) => {
      const next = await tx.webhookEndpoint.create({
        data: {
          id,
          orgId: actor.orgId,
          url: input.url,
          secretCipher: hashed,
          eventTypes: input.eventTypes,
          status: 'active',
        },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'webhookEndpoint.created',
        resourceType: 'WebhookEndpoint',
        resourceId: id,
        afterJson: {
          url: input.url,
          eventTypes: input.eventTypes,
          status: 'active',
        },
      });
      return next;
    });
    return { ...toPublic(row), secret };
  },

  async listEndpoints(
    query: ListWebhookEndpointsQuery,
    actor: ActorContext,
  ): Promise<{ data: WebhookEndpointPublic[]; nextCursor: string | null }> {
    const where: Prisma.WebhookEndpointWhereInput = { orgId: actor.orgId };
    if (query.status) where.status = query.status;
    const rows = await prisma().webhookEndpoint.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: { id: 'asc' },
    });
    const hasMore = rows.length > query.limit;
    const slice = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
    return { data: slice.map(toPublic), nextCursor };
  },

  async rotateSecret(id: string, actor: ActorContext): Promise<WebhookEndpointWithSecret> {
    const existing = await prisma().webhookEndpoint.findUnique({ where: { id } });
    if (!existing) throw new ProblemError(Problems.notFound('WebhookEndpoint', id));
    if (existing.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(existing.orgId));
    }
    const secret = generateSecret();
    const hashed = hashSecret(secret);
    const row = await prisma().$transaction(async (tx) => {
      const next = await tx.webhookEndpoint.update({
        where: { id },
        data: { secretCipher: hashed },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'webhookEndpoint.secret_rotated',
        resourceType: 'WebhookEndpoint',
        resourceId: id,
        afterJson: { rotatedAt: new Date().toISOString() },
      });
      return next;
    });
    return { ...toPublic(row), secret };
  },

  async softDeleteEndpoint(id: string, actor: ActorContext): Promise<WebhookEndpointPublic> {
    const existing = await prisma().webhookEndpoint.findUnique({ where: { id } });
    if (!existing) throw new ProblemError(Problems.notFound('WebhookEndpoint', id));
    if (existing.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(existing.orgId));
    }
    if (existing.status === 'archived') return toPublic(existing);
    const row = await prisma().$transaction(async (tx) => {
      const next = await tx.webhookEndpoint.update({
        where: { id },
        data: { status: 'archived' },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'webhookEndpoint.archived',
        resourceType: 'WebhookEndpoint',
        resourceId: id,
        beforeJson: { status: existing.status },
        afterJson: { status: 'archived' },
      });
      return next;
    });
    return toPublic(row);
  },

  async listDeliveries(
    endpointId: string,
    query: ListWebhookDeliveriesQuery,
    actor: ActorContext,
  ): Promise<{ data: WebhookDeliveryPublic[]; nextCursor: string | null }> {
    const endpoint = await prisma().webhookEndpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint) throw new ProblemError(Problems.notFound('WebhookEndpoint', endpointId));
    if (endpoint.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(endpoint.orgId));
    }
    const where: Prisma.WebhookDeliveryWhereInput = { endpointId };
    if (query.status) where.status = query.status;
    const rows = await prisma().webhookDelivery.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: { id: 'asc' },
    });
    const hasMore = rows.length > query.limit;
    const slice = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
    return {
      data: slice.map((d) => ({
        id: d.id,
        endpointId: d.endpointId,
        eventId: d.eventId,
        status: d.status,
        attempts: d.attempts,
        lastError: d.lastError,
        nextAttemptAt: d.nextAttemptAt?.toISOString() ?? null,
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
      nextCursor,
    };
  },
};

function toPublic(e: {
  id: string;
  orgId: string;
  url: string;
  eventTypes: string[];
  status: string;
  createdAt: Date;
}): WebhookEndpointPublic {
  return {
    id: e.id,
    orgId: e.orgId,
    url: e.url,
    eventTypes: e.eventTypes,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  };
}
