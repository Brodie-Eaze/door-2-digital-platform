/**
 * Compliance service — Phase 1.2 real.
 *
 * Backs the paid-solicitor / state-clearance gate. D2D (the operator entity)
 * must register as a PAID SOLICITOR in each US state before its knockers may
 * solicit donations there. A charity conversion whose campaign is not cleared
 * for the donor's state is a regulatory liability, so `assertStateCleared`
 * hard-gates conversion creation.
 *
 * Clearance is two-tiered:
 *   - `PaidSolicitorRegistration` — the operator's filing for (entity, client,
 *     state). Drives the status state-machine (pending → submitted → approved
 *     → expired; any → rejected).
 *   - `CampaignStateClearance` — the per-(campaign, state) join that says
 *     "this campaign may solicit in this state, backed by THIS registration".
 *     Created/refreshed when a registration is approved.
 *
 * A state is "cleared" for a campaign iff a `CampaignStateClearance` row exists
 * AND its backing registration is `approved` AND not past `expiresAt`.
 *
 * Every mutation writes an AuditEvent in the SAME TX (ADR-0008).
 */
import { Prisma } from '@prisma/client';
import type { RegionCode, SolicitorStatus } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import type { PaidSolicitorRegistrationRequest } from '@d2d/shared-types';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/service';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface PaidSolicitorRegistrationPublic {
  id: string;
  regionCode: RegionCode;
  state: string;
  entityOrgId: string;
  clientOrgId: string;
  status: SolicitorStatus;
  filedAt: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  bondAmountCents: string;
  registrationNumber: string | null;
  evidenceKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StateClearanceCell {
  campaignId: string;
  campaignName: string;
  state: string;
  /** `cleared` only when backed by an approved, non-expired registration. */
  status: 'cleared' | 'expired' | 'pending_registration';
  clearedAt: string | null;
  registrationId: string | null;
  registrationStatus: SolicitorStatus | null;
  registrationExpiresAt: string | null;
}

/**
 * Valid status transitions for a `PaidSolicitorRegistration`.
 * - pending/submitted may move forward to approved, or be rejected.
 * - approved may lapse to expired (renewal lapse) or be revoked (rejected).
 * - expired/rejected are terminal — re-filing creates a NEW registration row.
 */
const STATUS_TRANSITIONS: Record<SolicitorStatus, readonly SolicitorStatus[]> = {
  pending: ['submitted', 'approved', 'rejected'],
  submitted: ['approved', 'rejected'],
  approved: ['expired', 'rejected'],
  expired: [],
  rejected: [],
} as const;

const AUDIT_ACTION: Record<'approved' | 'rejected' | 'expired', string> = {
  approved: 'compliance.registration_approved',
  rejected: 'compliance.registration_rejected',
  expired: 'compliance.registration_expired',
};

/**
 * Hard-gate: throw 409 PROBLEM_STATE_NOT_CLEARED unless the campaign is
 * cleared for `state`, backed by an approved + non-expired registration.
 * Resolves silently when cleared.
 *
 * Safe default when `campaignId` is absent: RESOLVE. Commercial sales carry no
 * campaign and are not paid-solicitor solicitations, so there is nothing to
 * gate. Charity donations are created WITH a campaignId, so the gate fires for
 * exactly the regulated path. Callers that book charity donations must pass the
 * campaignId (the conversion service does).
 */
export async function assertStateCleared(
  orgId: string,
  campaignId: string | null | undefined,
  state: string | null | undefined,
): Promise<void> {
  if (!campaignId) return;

  // A campaign-backed conversion with no resolvable donor state cannot be
  // proven cleared — fail closed rather than book an un-cleared solicitation.
  if (!state) {
    throw new ProblemError(
      Problems.stateNotCleared('UNKNOWN: donor state could not be determined'),
    );
  }

  const clearance = await prisma().campaignStateClearance.findUnique({
    where: { campaignId_state: { campaignId, state } },
    select: {
      registration: {
        select: { entityOrgId: true, clientOrgId: true, status: true, expiresAt: true },
      },
    },
  });

  const reg = clearance?.registration;
  const cleared =
    reg !== undefined &&
    reg.status === 'approved' &&
    (reg.expiresAt === null || reg.expiresAt > new Date());

  if (!cleared) {
    throw new ProblemError(Problems.stateNotCleared(state));
  }
}

/**
 * State-clearance matrix for the org: every campaign × cleared state, with the
 * effective status derived from the backing registration. Optionally narrowed
 * to a single campaign.
 */
export async function getStateClearanceMatrix(
  orgId: string,
  campaignId?: string,
): Promise<StateClearanceCell[]> {
  const where: Prisma.CampaignStateClearanceWhereInput = {
    campaign: { orgId, ...(campaignId ? { id: campaignId } : {}) },
  };

  const rows = await prisma().campaignStateClearance.findMany({
    where,
    select: {
      campaignId: true,
      state: true,
      clearedAt: true,
      campaign: { select: { name: true } },
      registration: {
        select: { id: true, status: true, expiresAt: true },
      },
    },
    orderBy: [{ campaignId: 'asc' }, { state: 'asc' }],
  });

  const now = new Date();
  return rows.map((r) => {
    const expired =
      r.registration.status === 'expired' ||
      (r.registration.expiresAt !== null && r.registration.expiresAt <= now);
    const status: StateClearanceCell['status'] =
      r.registration.status === 'approved' && !expired
        ? 'cleared'
        : expired
          ? 'expired'
          : 'pending_registration';
    return {
      campaignId: r.campaignId,
      campaignName: r.campaign.name,
      state: r.state,
      status,
      clearedAt: r.clearedAt.toISOString(),
      registrationId: r.registration.id,
      registrationStatus: r.registration.status,
      registrationExpiresAt: r.registration.expiresAt?.toISOString() ?? null,
    };
  });
}

/**
 * File a paid-solicitor registration for the org (the operator entity). The
 * request names the charity campaign + state; the campaign's org is the
 * client being solicited for. Idempotency at the API layer prevents replays;
 * the DB UNIQUE(entityOrgId, clientOrgId, state, regionCode) is belt+suspenders.
 *
 * Initial status defaults to `submitted` when a `filedAt`/evidence is supplied,
 * else `pending`; an explicit `status` in the request wins (a back-office may
 * record a registration already filed elsewhere).
 */
export async function fileRegistration(
  input: PaidSolicitorRegistrationRequest,
  actor: ActorContext,
): Promise<PaidSolicitorRegistrationPublic> {
  // Resolve the charity client org from the campaign + assert tenancy.
  const campaign = await prisma().campaign.findUnique({
    where: { id: input.campaignId },
    select: { orgId: true, regionCode: true },
  });
  if (!campaign) throw new ProblemError(Problems.notFound('Campaign', input.campaignId));
  if (campaign.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(campaign.orgId));
  }

  const filedAt = input.filedAt ? new Date(input.filedAt) : null;
  const status: SolicitorStatus =
    input.status ?? (filedAt || input.evidenceKey ? 'submitted' : 'pending');
  const registrationId = newId('psr');

  const row = await prisma().$transaction(async (tx) => {
    const created = await tx.paidSolicitorRegistration.create({
      data: {
        id: registrationId,
        regionCode: actor.regionCode,
        state: input.state,
        // The operator org files; the campaign's org is the charity client.
        entityOrgId: actor.orgId,
        clientOrgId: campaign.orgId,
        status,
        filedAt: status === 'pending' ? filedAt : (filedAt ?? new Date()),
        evidenceKey: input.evidenceKey ?? null,
      },
    });

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'compliance.registration_filed',
      resourceType: 'PaidSolicitorRegistration',
      resourceId: registrationId,
      afterJson: {
        state: input.state,
        campaignId: input.campaignId,
        clientOrgId: campaign.orgId,
        status,
      },
    });

    return created;
  });

  return toRegistrationPublic(row);
}

/**
 * Transition a registration's status. Guards to the state-machine moves in
 * `STATUS_TRANSITIONS`. On `approved`, create/refresh the
 * `CampaignStateClearance` rows for every campaign of the client org in that
 * state — so the conversion gate opens for exactly the cleared (campaign,
 * state) pairs.
 */
export async function transitionRegistration(
  registrationId: string,
  next: SolicitorStatus,
  actor: ActorContext,
): Promise<PaidSolicitorRegistrationPublic> {
  const current = await prisma().paidSolicitorRegistration.findUnique({
    where: { id: registrationId },
    select: { entityOrgId: true, clientOrgId: true, state: true, status: true, filedAt: true },
  });
  if (!current) {
    throw new ProblemError(Problems.notFound('PaidSolicitorRegistration', registrationId));
  }
  // The filing operator org owns the registration.
  if (current.entityOrgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(current.entityOrgId));
  }

  const allowed = STATUS_TRANSITIONS[current.status];
  if (!allowed.includes(next)) {
    throw new ProblemError(
      Problems.conflict(`Cannot transition registration from ${current.status} to ${next}`),
    );
  }

  const now = new Date();
  const row = await prisma().$transaction(async (tx) => {
    const updated = await tx.paidSolicitorRegistration.update({
      where: { id: registrationId },
      data: {
        status: next,
        ...(next === 'approved' && { approvedAt: now, filedAt: current.filedAt ?? now }),
      },
    });

    if (next === 'approved') {
      // Open clearance for every campaign the client org runs in this state.
      const campaigns = await tx.campaign.findMany({
        where: { orgId: current.clientOrgId },
        select: { id: true },
      });
      for (const c of campaigns) {
        await tx.campaignStateClearance.upsert({
          where: { campaignId_state: { campaignId: c.id, state: current.state } },
          update: { paidSolicitorRegistrationId: registrationId, clearedAt: now },
          create: {
            id: newId('csc'),
            campaignId: c.id,
            state: current.state,
            paidSolicitorRegistrationId: registrationId,
            clearedAt: now,
          },
        });
        await AuditService.recordEvent(tx, {
          orgId: actor.orgId,
          regionCode: actor.regionCode,
          actorUserId: actor.userId,
          action: 'compliance.state_clearance_changed',
          resourceType: 'CampaignStateClearance',
          resourceId: `${c.id}:${current.state}`,
          afterJson: {
            campaignId: c.id,
            state: current.state,
            registrationId,
            cleared: true,
          },
        });
      }
    }

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: AUDIT_ACTION[next as 'approved' | 'rejected' | 'expired'],
      resourceType: 'PaidSolicitorRegistration',
      resourceId: registrationId,
      beforeJson: { status: current.status },
      afterJson: { status: next, state: current.state },
    });

    return updated;
  });

  return toRegistrationPublic(row);
}

/**
 * Manual state-clearance override — links an existing campaign to an already-
 * approved registration for cases where the campaign was created AFTER the
 * registration was approved (the auto-upsert in transitionRegistration only
 * covers campaigns that existed at approval time).
 *
 * Asserts:
 *   - The registration exists and is `approved` + not expired.
 *   - The campaign belongs to the registration's `clientOrgId`.
 *   - The actor's org matches the registration's `entityOrgId` (operator only).
 */
export interface ManualClearanceInput {
  campaignId: string;
  state: string;
  paidSolicitorRegistrationId: string;
}

export interface CampaignStateClearancePublic {
  campaignId: string;
  state: string;
  clearedAt: string;
  registrationId: string;
}

export async function manualClearance(
  input: ManualClearanceInput,
  actor: ActorContext,
): Promise<CampaignStateClearancePublic> {
  const reg = await prisma().paidSolicitorRegistration.findUnique({
    where: { id: input.paidSolicitorRegistrationId },
    select: {
      entityOrgId: true,
      clientOrgId: true,
      state: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!reg) {
    throw new ProblemError(
      Problems.notFound('PaidSolicitorRegistration', input.paidSolicitorRegistrationId),
    );
  }
  // Only the operator entity that filed the registration may create clearances.
  if (reg.entityOrgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(reg.entityOrgId));
  }
  if (reg.status !== 'approved') {
    throw new ProblemError(
      Problems.conflict(
        `Registration is ${reg.status} — only approved registrations may grant clearance`,
      ),
    );
  }
  if (reg.expiresAt !== null && reg.expiresAt <= new Date()) {
    throw new ProblemError(Problems.conflict('Registration has expired'));
  }
  if (reg.state !== input.state) {
    throw new ProblemError(
      Problems.conflict(`Registration covers state ${reg.state}, not ${input.state}`),
    );
  }

  // Assert the campaign belongs to the charity client org on the registration.
  const campaign = await prisma().campaign.findUnique({
    where: { id: input.campaignId },
    select: { orgId: true },
  });
  if (!campaign) {
    throw new ProblemError(Problems.notFound('Campaign', input.campaignId));
  }
  if (campaign.orgId !== reg.clientOrgId) {
    throw new ProblemError(
      Problems.conflict('Campaign does not belong to the registration client org'),
    );
  }

  const now = new Date();
  const clearance = await prisma().$transaction(async (tx) => {
    const row = await tx.campaignStateClearance.upsert({
      where: { campaignId_state: { campaignId: input.campaignId, state: input.state } },
      update: {
        paidSolicitorRegistrationId: input.paidSolicitorRegistrationId,
        clearedAt: now,
      },
      create: {
        id: newId('csc'),
        campaignId: input.campaignId,
        state: input.state,
        paidSolicitorRegistrationId: input.paidSolicitorRegistrationId,
        clearedAt: now,
      },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'compliance.state_clearance_changed',
      resourceType: 'CampaignStateClearance',
      resourceId: `${input.campaignId}:${input.state}`,
      afterJson: {
        campaignId: input.campaignId,
        state: input.state,
        registrationId: input.paidSolicitorRegistrationId,
        cleared: true,
        manual: true,
      },
    });
    return row;
  });

  return {
    campaignId: clearance.campaignId,
    state: clearance.state,
    clearedAt: clearance.clearedAt.toISOString(),
    registrationId: clearance.paidSolicitorRegistrationId,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Mapper
// ───────────────────────────────────────────────────────────────────────────

function toRegistrationPublic(r: {
  id: string;
  regionCode: RegionCode;
  state: string;
  entityOrgId: string;
  clientOrgId: string;
  status: SolicitorStatus;
  filedAt: Date | null;
  approvedAt: Date | null;
  expiresAt: Date | null;
  bondAmountCents: bigint;
  registrationNumber: string | null;
  evidenceKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PaidSolicitorRegistrationPublic {
  return {
    id: r.id,
    regionCode: r.regionCode,
    state: r.state,
    entityOrgId: r.entityOrgId,
    clientOrgId: r.clientOrgId,
    status: r.status,
    filedAt: r.filedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    bondAmountCents: r.bondAmountCents.toString(),
    registrationNumber: r.registrationNumber,
    evidenceKey: r.evidenceKey,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
