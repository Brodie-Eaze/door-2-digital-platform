/**
 * PII Vault service — Phase 1.1 real.
 *
 * Cryptographic contract (node:crypto only — NO external deps):
 *
 *   Per-row envelope:
 *     1. Generate a random 256-bit DEK (data encryption key).
 *     2. Encrypt the plaintext with AES-256-GCM using the DEK.
 *        AAD = utf8("<rowType>:<rowId>") so the ciphertext is bound to
 *        its row — copying a vault blob to another row fails to decrypt.
 *     3. Wrap the DEK under a static "KMS key" loaded from `PII_KMS_KEY`
 *        env (32 bytes base64). Wrap = AES-256-GCM with a random IV and
 *        AAD = utf8("dek-wrap"). Production replaces this with AWS KMS.
 *
 *   Searchable digest:
 *     HMAC-SHA256(plaintext, PII_SIV_KEY) → hex.
 *     Deterministic so two writes of the same plaintext produce the same
 *     digest, which lets us enforce UNIQUE indices and lookup by digest.
 *
 *     Phase 1.1 upgrade target: replace HMAC-SHA256 digests with AES-SIV
 *     (RFC 5297) once we land a vetted implementation — SIV gives us
 *     deterministic encryption that is reversible inside the vault while
 *     remaining safe against equal-prefix attacks. Tracked in tech-debt.
 *
 *   Storage shape (`EncryptedField`):
 *     { ciphertext, iv, authTag, dekWrapped, dekIv, dekAuthTag, aad, digest }
 *     All bytes base64-encoded for JSON transport.
 *
 *   Two-person unmask:
 *     - `request()` inserts a PiiUnmaskRequest (status='pending')
 *     - `approve()` rejects same-user approval, mints a 30-minute opaque
 *        grant token, stores SHA-256 of it on the row.
 *     - `reveal()` verifies the grant, decrypts the row's vault fields,
 *        marks the request revealed, and writes an audit event of
 *        action='pii.unmask'.
 */
import {
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { Prisma, RegionCode } from '@prisma/client';
import { Problems, ProblemError, newId } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { AuditService } from '../audit/service';
import type { UnmaskRequestInput, UnmaskApproveInput, UnmaskRevealInput } from './schemas';

// ───────────────────────────────────────────────────────────────────────────
// Field-level crypto
// ───────────────────────────────────────────────────────────────────────────

export interface EncryptedField {
  ciphertext: string; // base64
  iv: string; // base64 (12 bytes for GCM)
  authTag: string; // base64 (16 bytes for GCM)
  dekWrapped: string; // base64
  dekIv: string; // base64
  dekAuthTag: string; // base64
  aad: string; // base64 of AAD string
  digest: string; // hex HMAC-SHA256 search digest
}

function kmsKey(): Buffer {
  const k = Buffer.from(env().PII_KMS_KEY, 'base64');
  if (k.length !== 32) {
    throw new Error('PII_KMS_KEY must decode to 32 bytes');
  }
  return k;
}

function sivKey(): Buffer {
  const k = Buffer.from(env().PII_SIV_KEY, 'base64');
  if (k.length < 32) {
    throw new Error('PII_SIV_KEY must decode to at least 32 bytes');
  }
  return k;
}

function aadFor(rowType: string, rowId: string): Buffer {
  return Buffer.from(`${rowType}:${rowId}`, 'utf8');
}

function encryptAesGcm(
  key: Buffer,
  plaintext: Buffer,
  aad: Buffer,
): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptAesGcm(
  key: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  authTag: Buffer,
  aad: Buffer,
): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export const PiiVaultService = {
  /**
   * Encrypt a plaintext field for a specific row. The (rowType, rowId)
   * tuple is bound into the AAD so the ciphertext is useless if copied
   * to a different row.
   */
  encryptForRow(rowType: string, rowId: string, plaintext: string): EncryptedField {
    const dek = randomBytes(32);
    const aad = aadFor(rowType, rowId);
    const enc = encryptAesGcm(dek, Buffer.from(plaintext, 'utf8'), aad);
    const wrap = encryptAesGcm(kmsKey(), dek, Buffer.from('dek-wrap', 'utf8'));
    return {
      ciphertext: enc.ciphertext.toString('base64'),
      iv: enc.iv.toString('base64'),
      authTag: enc.authTag.toString('base64'),
      dekWrapped: wrap.ciphertext.toString('base64'),
      dekIv: wrap.iv.toString('base64'),
      dekAuthTag: wrap.authTag.toString('base64'),
      aad: aad.toString('base64'),
      digest: this.digest(plaintext),
    };
  },

  /**
   * Decrypt a vaulted field. Throws if (rowType, rowId) AAD doesn't match —
   * which is the guarantee that protects against ciphertext relocation.
   */
  decrypt(field: EncryptedField, rowType: string, rowId: string): string {
    const aad = aadFor(rowType, rowId);
    const stored = Buffer.from(field.aad, 'base64');
    if (stored.length !== aad.length || !timingSafeEqual(stored, aad)) {
      throw new ProblemError(
        Problems.forbidden('Vault AAD mismatch — ciphertext does not belong to this row'),
      );
    }
    const dek = decryptAesGcm(
      kmsKey(),
      Buffer.from(field.dekWrapped, 'base64'),
      Buffer.from(field.dekIv, 'base64'),
      Buffer.from(field.dekAuthTag, 'base64'),
      Buffer.from('dek-wrap', 'utf8'),
    );
    const plaintext = decryptAesGcm(
      dek,
      Buffer.from(field.ciphertext, 'base64'),
      Buffer.from(field.iv, 'base64'),
      Buffer.from(field.authTag, 'base64'),
      aad,
    );
    return plaintext.toString('utf8');
  },

  /**
   * Deterministic digest used for unique lookups (e.g. find Lead by email
   * digest without ever holding plaintext). HMAC-SHA256(plaintext, SIV_KEY).
   *
   * Phase 1.1 upgrade target: swap to AES-SIV for proper deterministic AEAD.
   */
  digest(plaintext: string): string {
    return createHmac('sha256', sivKey()).update(plaintext.trim().toLowerCase()).digest('hex');
  },

  // ───────────────────────────────────────────────────────────────────────
  // Two-person JIT unmask
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Register an unmask request — status='pending', no grant yet.
   */
  async requestUnmask(
    input: UnmaskRequestInput,
    actor: { userId: string; orgId: string; regionCode: RegionCode },
  ): Promise<{ requestId: string; status: string }> {
    const id = newId('pur');
    await prisma().$transaction(async (tx) => {
      await tx.piiUnmaskRequest.create({
        data: {
          id,
          orgId: actor.orgId,
          regionCode: actor.regionCode,
          requesterId: actor.userId,
          rowType: input.rowType,
          rowId: input.rowId,
          fields: input.fields,
          justification: input.justification,
          status: 'pending',
        },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'pii.unmask_requested',
        resourceType: 'PiiUnmaskRequest',
        resourceId: id,
        afterJson: {
          rowType: input.rowType,
          rowId: input.rowId,
          fields: input.fields,
          justification: '[REDACTED]',
        },
      });
    });
    return { requestId: id, status: 'pending' };
  },

  /**
   * Approve an unmask. MUST be a different user than the requester. Mints
   * a 30-minute opaque grant token; only the SHA-256 of it lands in the
   * DB so a DB leak doesn't grant unmasks.
   */
  async approveUnmask(
    requestId: string,
    input: UnmaskApproveInput,
    actor: { userId: string; orgId: string; regionCode: RegionCode },
  ): Promise<{ requestId: string; grantToken: string; grantExpiresAt: string }> {
    const existing = await prisma().piiUnmaskRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new ProblemError(Problems.notFound('PiiUnmaskRequest', requestId));
    if (existing.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(existing.orgId));
    }
    if (existing.status !== 'pending') {
      throw new ProblemError(Problems.conflict(`Request already ${existing.status}`));
    }
    if (existing.requesterId === actor.userId) {
      throw new ProblemError(
        Problems.forbidden('Two-person rule — approver must differ from requester'),
      );
    }

    if (input.approved === false) {
      await prisma().$transaction(async (tx) => {
        await tx.piiUnmaskRequest.update({
          where: { id: requestId },
          data: {
            status: 'rejected',
            approverId: actor.userId,
            rejectedAt: new Date(),
            rejectedReason: input.note ?? null,
          },
        });
        await AuditService.recordEvent(tx, {
          orgId: actor.orgId,
          regionCode: actor.regionCode,
          actorUserId: actor.userId,
          action: 'pii.unmask_rejected',
          resourceType: 'PiiUnmaskRequest',
          resourceId: requestId,
          beforeJson: { status: 'pending' },
          afterJson: { status: 'rejected' },
        });
      });
      throw new ProblemError({
        type: 'https://docs.d2d.io/problems/unmask-rejected',
        title: 'Unmask rejected',
        status: 200,
        detail: 'Request rejected — no grant issued',
      });
    }

    const grant = randomBytes(32).toString('base64url');
    const grantHash = createHash('sha256').update(grant).digest('hex');
    const grantExpiresAt = new Date(Date.now() + 30 * 60_000);

    await prisma().$transaction(async (tx) => {
      await tx.piiUnmaskRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approverId: actor.userId,
          grantTokenHash: grantHash,
          grantExpiresAt,
        },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'pii.unmask_approved',
        resourceType: 'PiiUnmaskRequest',
        resourceId: requestId,
        beforeJson: { status: 'pending' },
        afterJson: { status: 'approved', grantExpiresAt: grantExpiresAt.toISOString() },
      });
    });

    return {
      requestId,
      grantToken: grant,
      grantExpiresAt: grantExpiresAt.toISOString(),
    };
  },

  /**
   * Reveal plaintext values for the requested fields. Requires the grant
   * token issued at approval. Writes an `pii.unmask` audit row.
   */
  async revealUnmask(
    requestId: string,
    input: UnmaskRevealInput,
    actor: { userId: string; orgId: string; regionCode: RegionCode },
  ): Promise<{ requestId: string; values: Record<string, string | null> }> {
    const existing = await prisma().piiUnmaskRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new ProblemError(Problems.notFound('PiiUnmaskRequest', requestId));
    if (existing.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(existing.orgId));
    }
    if (existing.status !== 'approved') {
      throw new ProblemError(Problems.conflict(`Request status is ${existing.status}`));
    }
    if (!existing.grantTokenHash || !existing.grantExpiresAt) {
      throw new ProblemError(Problems.conflict('Approved row missing grant — inconsistent state'));
    }
    if (existing.grantExpiresAt.getTime() < Date.now()) {
      await prisma().piiUnmaskRequest.update({
        where: { id: requestId },
        data: { status: 'expired' },
      });
      throw new ProblemError(Problems.forbidden('Grant token expired'));
    }
    const givenHash = createHash('sha256').update(input.grantToken).digest('hex');
    const a = Buffer.from(givenHash, 'hex');
    const b = Buffer.from(existing.grantTokenHash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ProblemError(Problems.forbidden('Invalid grant token'));
    }

    // Fetch the row and decrypt requested fields.
    const values = await fetchAndDecryptFields(existing.rowType, existing.rowId, existing.fields);

    await prisma().$transaction(async (tx) => {
      await tx.piiUnmaskRequest.update({
        where: { id: requestId },
        data: { status: 'revealed', revealedAt: new Date() },
      });
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'pii.unmask',
        resourceType: existing.rowType,
        resourceId: existing.rowId,
        metadata: {
          requestId,
          fields: existing.fields,
          approverId: existing.approverId,
        },
      });
    });
    return { requestId, values };
  },

  /**
   * Read-only fetch of a request status — the actor must be in the same
   * org. Returns enough metadata for the UI but never the plaintext.
   */
  async getUnmaskRequest(
    requestId: string,
    actor: { orgId: string },
  ): Promise<{
    id: string;
    status: string;
    rowType: string;
    rowId: string;
    fields: string[];
    requesterId: string;
    approverId: string | null;
    justification: string;
    grantExpiresAt: string | null;
    revealedAt: string | null;
    rejectedReason: string | null;
    createdAt: string;
  }> {
    const row = await prisma().piiUnmaskRequest.findUnique({ where: { id: requestId } });
    if (!row) throw new ProblemError(Problems.notFound('PiiUnmaskRequest', requestId));
    if (row.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(row.orgId));
    }
    return {
      id: row.id,
      status: row.status,
      rowType: row.rowType,
      rowId: row.rowId,
      fields: row.fields,
      requesterId: row.requesterId,
      approverId: row.approverId,
      justification: row.justification,
      grantExpiresAt: row.grantExpiresAt?.toISOString() ?? null,
      revealedAt: row.revealedAt?.toISOString() ?? null,
      rejectedReason: row.rejectedReason,
      createdAt: row.createdAt.toISOString(),
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Field fetcher — picks the right table + columns by rowType
// ───────────────────────────────────────────────────────────────────────────

async function fetchAndDecryptFields(
  rowType: string,
  rowId: string,
  fields: string[],
): Promise<Record<string, string | null>> {
  if (rowType === 'Lead') {
    const lead = await prisma().lead.findUnique({ where: { id: rowId } });
    if (!lead) throw new ProblemError(Problems.notFound(rowType, rowId));
    const out: Record<string, string | null> = {};
    for (const f of fields) {
      out[f] = revealLeadField(lead, f, rowId);
    }
    return out;
  }
  if (rowType === 'Donation') {
    const don = await prisma().donation.findUnique({ where: { id: rowId } });
    if (!don) throw new ProblemError(Problems.notFound(rowType, rowId));
    const out: Record<string, string | null> = {};
    for (const f of fields) {
      out[f] = f === 'email' ? don.donorEmail : null;
    }
    return out;
  }
  if (rowType === 'Sale' || rowType === 'Conversion') {
    // Sale/Conversion don't yet hold encrypted PII columns — return null
    // for any requested fields. Vault-wrap of sale records lands later.
    return Object.fromEntries(fields.map((f) => [f, null]));
  }
  throw new ProblemError(Problems.validation(`Unsupported rowType: ${rowType}`));
}

function revealLeadField(
  lead: {
    id: string;
    givenName: string;
    familyName: string;
    email: string | null;
    phone: string | null;
    emailVault: unknown;
    phoneVault: unknown;
    notesVault: unknown;
  },
  field: string,
  rowId: string,
): string | null {
  if (field === 'fullName') return `${lead.givenName} ${lead.familyName}`.trim();
  if (field === 'email') {
    if (lead.emailVault) {
      return PiiVaultService.decrypt(lead.emailVault as EncryptedField, 'Lead', rowId);
    }
    return lead.email;
  }
  if (field === 'phone') {
    if (lead.phoneVault) {
      return PiiVaultService.decrypt(lead.phoneVault as EncryptedField, 'Lead', rowId);
    }
    return lead.phone;
  }
  if (field === 'address') {
    // Address lookup deferred — Lead.addressId joins on Address which is
    // currently plaintext. Phase 1.4 wraps Address.street/postal.
    return null;
  }
  if (field === 'paymentLast4') return null;
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Re-export the EncryptedField type via Prisma's Json shape for callers
// ───────────────────────────────────────────────────────────────────────────

export type EncryptedFieldJson = Prisma.JsonValue;
