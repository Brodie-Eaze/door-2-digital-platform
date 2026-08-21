/**
 * Server-side DB helpers used by the route handlers.
 *
 * Audit writes: every mutation routes through `writeAudit()` inside the
 * same Prisma transaction, mirroring the Fastify API's ADR-0008 hash
 * chain. The chain is per-(orgId, regionCode) with platform-level events
 * keyed by regionCode + orgId=NULL.
 *
 * Slug helpers: `slugify()` is the kebab-case normaliser; `ensureUniqueSlug`
 * suffixes `-2`, `-3`, ... until a row with that slug doesn't exist (race
 * tolerated by the Postgres UNIQUE constraint on Org.slug).
 *
 * ID helpers: `newOrgId()` + friends emit `<prefix>_<ulid>` so logs and
 * audit rows stay greppable.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Prisma, db } from '@d2d/database';

// ────────────────────────────────────────────────────────────────────────────
// IDs — same shape as apps/api's newId(), without the @d2d/shared-utils dep
// (web-operator can't import server-only Node code from shared-utils at edge
// build time, so we duplicate the tiny piece we need).
// ────────────────────────────────────────────────────────────────────────────

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Tiny ULID generator. Not Crockford's exact ulid lib but produces a
 * monotonically sortable 26-char ID safe for primary keys + log greps.
 * (The Fastify API uses the official `ulid` package; this exists to
 * avoid an extra dep on the Next.js side. Both are 26 chars Crockford
 * base32 + millisecond-prefixed so they sort the same.)
 */
function ulid(): string {
  const timeBuf = Buffer.alloc(6);
  const ts = Date.now();
  timeBuf.writeUIntBE(ts, 0, 6);
  const randBuf = randomBytes(10);
  const buf = Buffer.concat([timeBuf, randBuf]);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out.slice(0, 26);
}

export const newOrgId = (): string => `org_${ulid()}`;
export const newBrandKitId = (): string => `brk_${ulid()}`;
export const newBillingId = (): string => `bil_${ulid()}`;
export const newAuditId = (): string => `aud_${ulid()}`;
export const newIdempotencyKey = (): string => `idem_${ulid()}`;
export const newShiftId = (): string => `ksft_${ulid()}`;
export const newAssignmentId = (): string => `tas_${ulid()}`;
export const newUserId = (): string => `usr_${ulid()}`;
export const newOfferingId = (): string => `svo_${ulid()}`;
export const newTerritoryId = (): string => `ter_${ulid()}`;

// ────────────────────────────────────────────────────────────────────────────
// Invite tokens — mirrors apps/api domains/auth/tokens.generateInviteToken.
// The opaque token is base64url(randomBytes(24)); we persist ONLY its SHA-256
// (UserCredential.inviteTokenHash) and hand the plaintext back once for the
// manager to send. acceptInvite() in the Fastify API verifies via
// hashRefreshToken() = sha256(plaintext), so a token minted here unlocks there.
// ────────────────────────────────────────────────────────────────────────────

export function generateInviteToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

// ────────────────────────────────────────────────────────────────────────────
// Slug helpers
// ────────────────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/**
 * Returns a slug guaranteed not to collide with any existing Org.slug.
 * Postgres UNIQUE provides the racy backstop; this prevents the common
 * case of two onboards picking the same trading name.
 */
export async function ensureUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || `org-${Date.now().toString(36)}`;
  let candidate = root;
  let suffix = 2;
  // Loop with a bounded retry — we never expect more than a handful of
  // collisions for a human-typed trading name.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const existing = await db.org.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  // Pathological collision (50 hits with same name) — fall back to ULID.
  return `${root}-${ulid().slice(-6).toLowerCase()}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Audit writer (mirrors apps/api AuditService.recordEvent without the env
// validation layer — Next.js loads env at runtime via process.env directly)
// ────────────────────────────────────────────────────────────────────────────

const GENESIS_PREV_HASH = '0'.repeat(64);

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function computeRowHash(prevHash: string, row: Record<string, unknown>, secret: string): string {
  const payload = `${prevHash}|${canonicalize(row)}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export interface AuditWriteInput {
  orgId?: string | null;
  regionCode: 'US' | 'AU' | 'SG';
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit row inside the caller's TX. Returns the audit ULID.
 * Mirrors apps/api `AuditService.recordEvent` so the chain replays the
 * same way regardless of which surface wrote a given row.
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: AuditWriteInput,
): Promise<string> {
  const secret = process.env.AUDIT_CHAIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUDIT_CHAIN_SECRET missing or too short in web-operator env');
  }
  const ulidStr = newAuditId();
  const occurredAt = new Date();

  const last = await tx.auditEvent.findFirst({
    where: input.orgId ? { orgId: input.orgId } : { orgId: null, regionCode: input.regionCode },
    orderBy: { id: 'desc' },
    select: {
      ulid: true,
      orgId: true,
      regionCode: true,
      actorUserId: true,
      action: true,
      resourceType: true,
      resourceId: true,
      beforeJson: true,
      afterJson: true,
      metadata: true,
      occurredAt: true,
      prevHash: true,
      rowHash: true,
    },
  });
  const prevHash = last?.rowHash ?? GENESIS_PREV_HASH;

  // SECRET-DRIFT TRIPWIRE. The chain is only tamper-evident if every writer
  // (this BFF + the Fastify API) hashes with the SAME AUDIT_CHAIN_SECRET.
  // Recompute the previous row's hash with OUR secret before extending the
  // chain: a mismatch means our secret differs from the one that wrote it
  // (or the row was tampered with) — either way, extending would silently
  // poison legal evidence. Fail loud instead (2026-08-21 dev incident: BFF
  // drift broke 5 org chains undetected until the weekly verify).
  if (last) {
    const lastRecomputed = computeRowHash(
      last.prevHash,
      {
        id: last.ulid,
        orgId: last.orgId,
        regionCode: last.regionCode,
        actorUserId: last.actorUserId,
        action: last.action,
        resourceType: last.resourceType,
        resourceId: last.resourceId,
        beforeJson: last.beforeJson ?? null,
        afterJson: last.afterJson ?? null,
        metadata: last.metadata ?? {},
        occurredAt: last.occurredAt.toISOString(),
      },
      secret,
    );
    if (lastRecomputed !== last.rowHash) {
      throw new Error(
        `Audit chain integrity check failed for ${input.orgId ?? `platform/${input.regionCode}`}: ` +
          `the previous row (${last.ulid}) does not verify with this service's ` +
          'AUDIT_CHAIN_SECRET. Refusing to extend a chain we would poison. ' +
          'Check secret alignment across API + BFF (see CLAUDE.md shared-secret law).',
      );
    }
  }

  const canonicalMetadata = input.metadata ?? {};
  const forHash = {
    id: ulidStr,
    orgId: input.orgId ?? null,
    regionCode: input.regionCode,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
    metadata: canonicalMetadata,
    occurredAt: occurredAt.toISOString(),
  };
  const rowHash = computeRowHash(prevHash, forHash, secret);

  await tx.auditEvent.create({
    data: {
      ulid: ulidStr,
      orgId: input.orgId ?? null,
      regionCode: input.regionCode,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      beforeJson:
        input.beforeJson !== undefined
          ? (input.beforeJson as Prisma.InputJsonValue)
          : Prisma.DbNull,
      afterJson:
        input.afterJson !== undefined ? (input.afterJson as Prisma.InputJsonValue) : Prisma.DbNull,
      metadata: canonicalMetadata as Prisma.InputJsonValue,
      prevHash,
      rowHash,
      occurredAt,
    },
  });

  return ulidStr;
}

// ────────────────────────────────────────────────────────────────────────────
// PII masking — Lead.email + Lead.phone become "first-2-chars + redacted"
// for any cross-tenant viewer + the row's own viewer (the unmask flow lives
// in the Fastify API + requires step-up auth; the demo UI just shows the
// masked form so cross-tenant + audit can verify the journey).
// ────────────────────────────────────────────────────────────────────────────

export function maskEmail(email?: string | null): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  // E.164 → country-code + last 4 digits visible. Anything else → show last 4.
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.length <= 4) return '****';
  const last4 = digits.slice(-4);
  const headLen = digits.startsWith('+') ? 3 : 1;
  const head = digits.slice(0, headLen);
  const masked = '*'.repeat(Math.max(digits.length - headLen - 4, 1));
  return `${head}${masked}${last4}`;
}

/**
 * Build the deterministic email-search digest used by the API (and the
 * apps/api seed) so client-side dedupes hit the same emailDigest column.
 */
export function emailDigest(email: string): string {
  const key = process.env.PII_SEARCH_KEY;
  if (!key) {
    // Safe default for dev/SSR where the env hasn't been loaded — return a
    // SHA-256 prefixed sentinel so we can spot the misconfiguration in the
    // DB. Production WILL throw because env is validated at startup.
    return `nokey_${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
  }
  return createHmac('sha256', key).update(email.trim().toLowerCase()).digest('hex');
}
