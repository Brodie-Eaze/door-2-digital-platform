/**
 * DSAR (Data Subject Access Request) service — Phase 1.4.
 *
 * Per-jurisdiction SLAs from time of filing:
 *   au_privacy_act: 30 days
 *   ccpa / cpra:    45 days
 *   gdpr:           30 days
 *   pdpa_sg:        30 days
 *   other:          30 days
 *
 * Deletion requests coordinate: anonymise lead/conversion/donation records
 * while preserving audit rows (audit is append-only and must never be deleted).
 *
 * ADR-0013: soft-delete only — DSAR deletion = anonymise PII, not hard delete.
 */
import type { RegionCode, Prisma } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { writeAudit } from '../../shared/audit/write';
import { PiiVaultService } from '../pii-vault/service';
import type { DsarRequestBody } from '@d2d/shared-types';

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain || !user) return '•••';
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '•••';
  return `••• ••• ${digits.slice(-4)}`;
}

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
  role?: string;
}

const SLA_DAYS: Record<string, number> = {
  au_privacy_act: 30,
  ccpa: 45,
  cpra: 45,
  gdpr: 30,
  pdpa_sg: 30,
  other: 30,
};

const ADMIN_ROLES = new Set(['super_admin', 'org_admin', 'auditor']);

export interface DsarRequestPublic {
  id: string;
  orgId: string;
  regionCode: string;
  kind: string;
  jurisdiction: string;
  subjectEmail: string | null;
  subjectPhone: string | null;
  subjectLeadId: string | null;
  proofOfIdentityKey: string | null;
  note: string | null;
  status: string;
  requestedByUserId: string | null;
  slaDueAt: string;
  fulfilledAt: string | null;
  responsePackageKey: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublic(row: {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  kind: string;
  jurisdiction: string;
  subjectEmail: string | null;
  subjectPhone: string | null;
  subjectLeadId: string | null;
  proofOfIdentityKey: string | null;
  note: string | null;
  status: string;
  requestedByUserId: string | null;
  slaDueAt: Date;
  fulfilledAt: Date | null;
  responsePackageKey: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DsarRequestPublic {
  return {
    id: row.id,
    orgId: row.orgId,
    regionCode: row.regionCode,
    kind: row.kind,
    jurisdiction: row.jurisdiction,
    subjectEmail: row.subjectEmail,
    subjectPhone: row.subjectPhone,
    subjectLeadId: row.subjectLeadId,
    proofOfIdentityKey: row.proofOfIdentityKey,
    note: row.note,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    slaDueAt: row.slaDueAt.toISOString(),
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    responsePackageKey: row.responsePackageKey,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function slaDueAt(jurisdiction: string): Date {
  const days = SLA_DAYS[jurisdiction] ?? 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ── File a DSAR ────────────────────────────────────────────────────────────

export async function fileDsar(
  body: DsarRequestBody,
  actor: ActorContext,
): Promise<DsarRequestPublic> {
  const id = newId('dsar');
  const due = slaDueAt(body.jurisdiction);

  const row = await prisma().$transaction(async (tx) => {
    const r = await tx.dsarRequest.create({
      data: {
        id,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        kind: body.kind,
        jurisdiction: body.jurisdiction,
        subjectEmail: body.subjectEmail ? maskEmail(body.subjectEmail) : null,
        subjectEmailVault: body.subjectEmail
          ? (PiiVaultService.encryptForRow(
              'DsarRequest',
              id,
              body.subjectEmail,
            ) as Prisma.JsonObject)
          : null,
        subjectPhone: body.subjectPhone ? maskPhone(body.subjectPhone) : null,
        subjectPhoneVault: body.subjectPhone
          ? (PiiVaultService.encryptForRow(
              'DsarRequest',
              id,
              body.subjectPhone,
            ) as Prisma.JsonObject)
          : null,
        subjectLeadId: body.subjectLeadId ?? null,
        proofOfIdentityKey: body.proofOfIdentityKey ?? null,
        note: body.note ?? null,
        status: 'pending',
        requestedByUserId: actor.userId,
        slaDueAt: due,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'dsar.filed',
      resourceType: 'DsarRequest',
      resourceId: id,
      afterJson: { kind: body.kind, jurisdiction: body.jurisdiction },
    });
    return r;
  });

  return toPublic(row);
}

// ── List DSARs (admin/auditor only) ───────────────────────────────────────

export async function listDsarRequests(
  query: { status?: string; cursor?: string; limit?: number },
  actor: ActorContext,
): Promise<{ requests: DsarRequestPublic[]; nextCursor: string | null }> {
  if (!actor.role || !ADMIN_ROLES.has(actor.role)) {
    throw new ProblemError(Problems.forbidden('Insufficient role to list DSAR requests'));
  }

  const limit = query.limit ?? 20;
  const rows = await prisma().dsarRequest.findMany({
    where: {
      orgId: actor.orgId,
      ...(query.status && { status: query.status }),
      ...(query.cursor && { id: { lt: query.cursor } }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    requests: page.map(toPublic),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

// ── Get single DSAR ────────────────────────────────────────────────────────

export async function getDsarRequest(id: string, actor: ActorContext): Promise<DsarRequestPublic> {
  if (!actor.role || !ADMIN_ROLES.has(actor.role)) {
    throw new ProblemError(Problems.forbidden('Insufficient role to read DSAR requests'));
  }

  const row = await prisma().dsarRequest.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('DsarRequest', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.notFound('DsarRequest', id));

  return toPublic(row);
}

// ── Fulfil ─────────────────────────────────────────────────────────────────

export async function fulfilDsarRequest(
  id: string,
  body: { responsePackageKey?: string },
  actor: ActorContext,
): Promise<DsarRequestPublic> {
  if (!actor.role || !ADMIN_ROLES.has(actor.role)) {
    throw new ProblemError(Problems.forbidden('Insufficient role to fulfil DSAR requests'));
  }

  const row = await prisma().dsarRequest.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('DsarRequest', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.notFound('DsarRequest', id));
  if (row.status === 'fulfilled') {
    throw new ProblemError(Problems.conflict('DSAR request is already fulfilled'));
  }
  if (row.status === 'rejected') {
    throw new ProblemError(Problems.conflict('Cannot fulfil a rejected DSAR request'));
  }

  const updated = await prisma().$transaction(async (tx) => {
    const r = await tx.dsarRequest.update({
      where: { id },
      data: {
        status: 'fulfilled',
        fulfilledAt: new Date(),
        responsePackageKey: body.responsePackageKey ?? null,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'dsar.fulfilled',
      resourceType: 'DsarRequest',
      resourceId: id,
      afterJson: { status: 'fulfilled', responsePackageKey: body.responsePackageKey ?? null },
    });
    return r;
  });

  return toPublic(updated);
}

// ── Reject ─────────────────────────────────────────────────────────────────

export async function rejectDsarRequest(
  id: string,
  body: { reason: string },
  actor: ActorContext,
): Promise<DsarRequestPublic> {
  if (!actor.role || !ADMIN_ROLES.has(actor.role)) {
    throw new ProblemError(Problems.forbidden('Insufficient role to reject DSAR requests'));
  }

  const row = await prisma().dsarRequest.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('DsarRequest', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.notFound('DsarRequest', id));
  if (['fulfilled', 'rejected'].includes(row.status)) {
    throw new ProblemError(Problems.conflict(`DSAR request is already ${row.status}`));
  }

  const updated = await prisma().$transaction(async (tx) => {
    const r = await tx.dsarRequest.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: body.reason },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'dsar.rejected',
      resourceType: 'DsarRequest',
      resourceId: id,
      afterJson: { status: 'rejected', reason: body.reason },
    });
    return r;
  });

  return toPublic(updated);
}
