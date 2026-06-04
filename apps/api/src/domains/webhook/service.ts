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
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Prisma, RegionCode } from '@prisma/client';
import { newId, problem, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantPrismaTx, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type {
  CreateWebhookEndpointRequest,
  ListWebhookDeliveriesQuery,
  ListWebhookEndpointsQuery,
} from './schemas';

// ───────────────────────────────────────────────────────────────────────────
// SEC-008 — SSRF allowlist for outbound webhook URLs
// ───────────────────────────────────────────────────────────────────────────

/**
 * Convert a dotted-quad IPv4 string to a 32-bit integer for range checks.
 * Returns null if the input isn't a valid IPv4.
 */
function ipv4ToInt(addr: string): number | null {
  if (isIP(addr) !== 4) return null;
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  // eslint-disable-next-line no-bitwise
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

// Inclusive [start, end] ranges of IPv4 space that must NEVER be allowed
// as webhook destinations. Includes RFC1918 private, loopback, link-local
// (AWS metadata at 169.254.169.254), carrier-grade NAT, and 0.0.0.0/8.
const FORBIDDEN_IPV4_RANGES: Array<readonly [number, number]> = [
  [ipv4ToInt('0.0.0.0')!, ipv4ToInt('0.255.255.255')!], // "this network"
  [ipv4ToInt('10.0.0.0')!, ipv4ToInt('10.255.255.255')!], // RFC1918 /8
  [ipv4ToInt('100.64.0.0')!, ipv4ToInt('100.127.255.255')!], // CGNAT /10
  [ipv4ToInt('127.0.0.0')!, ipv4ToInt('127.255.255.255')!], // loopback
  [ipv4ToInt('169.254.0.0')!, ipv4ToInt('169.254.255.255')!], // link-local + AWS metadata
  [ipv4ToInt('172.16.0.0')!, ipv4ToInt('172.31.255.255')!], // RFC1918 /12
  [ipv4ToInt('192.0.0.0')!, ipv4ToInt('192.0.0.255')!], // IETF protocol assignments
  [ipv4ToInt('192.168.0.0')!, ipv4ToInt('192.168.255.255')!], // RFC1918 /16
  [ipv4ToInt('198.18.0.0')!, ipv4ToInt('198.19.255.255')!], // benchmark
  [ipv4ToInt('224.0.0.0')!, ipv4ToInt('239.255.255.255')!], // multicast
  [ipv4ToInt('240.0.0.0')!, ipv4ToInt('255.255.255.255')!], // reserved + broadcast
];

function isForbiddenIpv4(int: number): boolean {
  return FORBIDDEN_IPV4_RANGES.some(([lo, hi]) => int >= lo && int <= hi);
}

/**
 * Reject IPv6 loopback (::1), link-local (fe80::/10), unique-local
 * (fc00::/7 which covers fc00::/8 and fd00::/8), and IPv4-mapped/IPv4-compat
 * forms that smuggle a forbidden IPv4 inside an IPv6 envelope.
 *
 * Conservative by design — only allow IPv6 addresses we can affirmatively
 * classify as global unicast. Today the platform delivers webhooks to
 * public SaaS endpoints; rejecting any ambiguous v6 form is the safer
 * default than mis-classifying.
 */
function isForbiddenIpv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  // fc00::/7 — unique local (fc00:: through fdff::)
  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    // Naive prefix check is sufficient; Node's `isIP` already gave us a
    // canonical form via the resolver path.
    return true;
  }
  // IPv4-mapped (::ffff:x.x.x.x) or IPv4-compat — extract embedded v4.
  const v4 = lower.match(/(?:::ffff:|::)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (v4 && v4[1]) {
    const asInt = ipv4ToInt(v4[1]);
    if (asInt === null) return true;
    return isForbiddenIpv4(asInt);
  }
  return false;
}

function ssrfProblem(detail: string): ReturnType<typeof problem> {
  return problem('webhook-url-rejected', 'Webhook URL rejected', { status: 400, detail });
}

/**
 * Validate a candidate webhook URL against the SSRF allowlist. Throws a
 * `ProblemError` (400) on any disallowed shape or destination.
 *
 * Rules:
 *   - HTTPS only (no http://, no other schemes)
 *   - Port 443 only (default or explicit)
 *   - DNS resolves to a public IP — no RFC1918, no loopback, no link-local
 *     (incl. AWS metadata 169.254.169.254), no IPv6 ULA / loopback
 *
 * Note: this is a Time-of-Check vs Time-of-Use mitigation, not a complete
 * defence. The future outbound worker (Phase 1.2 webhook delivery) must
 * re-resolve + re-validate per delivery to defend against DNS rebinding.
 */
export async function assertSafeWebhookUrl(raw: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ProblemError(ssrfProblem('Webhook URL is not a valid URL'));
  }
  if (parsed.protocol !== 'https:') {
    throw new ProblemError(ssrfProblem('Webhook URL must use https:// scheme'));
  }
  if (parsed.port && parsed.port !== '443') {
    throw new ProblemError(ssrfProblem(`Webhook URL must use port 443 (got ${parsed.port})`));
  }
  if (!parsed.hostname || parsed.hostname.length === 0) {
    throw new ProblemError(ssrfProblem('Webhook URL hostname is required'));
  }
  // Reject literal-IP destinations up front — they bypass DNS but we still
  // need to range-check.
  const hostKind = isIP(parsed.hostname);
  if (hostKind === 4) {
    const asInt = ipv4ToInt(parsed.hostname);
    if (asInt === null || isForbiddenIpv4(asInt)) {
      throw new ProblemError(
        ssrfProblem(`Webhook URL resolves to a forbidden IP (${parsed.hostname})`),
      );
    }
    return;
  }
  if (hostKind === 6) {
    if (isForbiddenIpv6(parsed.hostname)) {
      throw new ProblemError(
        ssrfProblem(`Webhook URL resolves to a forbidden IP (${parsed.hostname})`),
      );
    }
    return;
  }
  // Hostname — resolve and range-check.
  let resolved: { address: string; family: number };
  try {
    resolved = await lookup(parsed.hostname);
  } catch {
    throw new ProblemError(
      ssrfProblem(`Webhook URL hostname does not resolve: ${parsed.hostname}`),
    );
  }
  if (resolved.family === 4) {
    const asInt = ipv4ToInt(resolved.address);
    if (asInt === null || isForbiddenIpv4(asInt)) {
      throw new ProblemError(
        ssrfProblem(
          `Webhook URL hostname ${parsed.hostname} resolves to a forbidden IP (${resolved.address})`,
        ),
      );
    }
    return;
  }
  if (resolved.family === 6) {
    if (isForbiddenIpv6(resolved.address)) {
      throw new ProblemError(
        ssrfProblem(
          `Webhook URL hostname ${parsed.hostname} resolves to a forbidden IPv6 (${resolved.address})`,
        ),
      );
    }
    return;
  }
  // Unknown family — refuse rather than guess.
  throw new ProblemError(
    ssrfProblem(`Webhook URL hostname ${parsed.hostname} resolved to an unknown IP family`),
  );
}

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
    // SEC-008: SSRF allowlist. Reject http://, non-443 ports, RFC1918,
    // loopback, link-local (incl. AWS metadata 169.254.169.254), IPv6 ULA.
    // Resolves the hostname via DNS so we catch public-looking names that
    // point at private space.
    await assertSafeWebhookUrl(input.url);
    const id = newId('whk');
    const secret = generateSecret();
    const hashed = hashSecret(secret);
    const row = await tenantTx(actor.orgId, async (tx) => {
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
    // §4b: org-scoped list through the tenant client (orgId filter +
    // GUC-pinned RLS belt under d2d_app). The where.orgId stays — scopeWhere
    // is idempotent on a matching tenant id.
    const rows = await tenantPrismaTx(actor.orgId).webhookEndpoint.findMany({
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
    // §4b: read through the tenant-scoped client. A foreign endpoint is
    // invisible (app-layer orgId filter + RLS belt under d2d_app) → null →
    // notFound, not the pre-belt tenantMismatch 403. The existence oracle
    // closes — a cross-tenant caller can't tell "forbidden" from "doesn't
    // exist". See docs/runbooks/rls-cutover.md §4b.1.
    const existing = await tenantPrismaTx(actor.orgId).webhookEndpoint.findUnique({
      where: { id },
    });
    if (!existing) throw new ProblemError(Problems.notFound('WebhookEndpoint', id));
    const secret = generateSecret();
    const hashed = hashSecret(secret);
    const row = await tenantTx(actor.orgId, async (tx) => {
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
    // §4b: tenant-scoped read — a foreign endpoint resolves to null → notFound
    // (404), not the pre-belt tenantMismatch 403. See rls-cutover.md §4b.1.
    const existing = await tenantPrismaTx(actor.orgId).webhookEndpoint.findUnique({
      where: { id },
    });
    if (!existing) throw new ProblemError(Problems.notFound('WebhookEndpoint', id));
    if (existing.status === 'archived') return toPublic(existing);
    const row = await tenantTx(actor.orgId, async (tx) => {
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
    // §4b: the tenant-scoped endpoint read gates delivery visibility. A
    // foreign endpoint resolves to null → notFound (404), so we never reach
    // the delivery query for an endpoint the caller doesn't own. The flip
    // from the pre-belt tenantMismatch 403 closes the existence oracle.
    // WebhookDelivery itself carries no orgId and is not RLS-enabled; it's
    // read on the bare client, transitively scoped by the verified endpointId.
    const endpoint = await tenantPrismaTx(actor.orgId).webhookEndpoint.findUnique({
      where: { id: endpointId },
    });
    if (!endpoint) throw new ProblemError(Problems.notFound('WebhookEndpoint', endpointId));
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
