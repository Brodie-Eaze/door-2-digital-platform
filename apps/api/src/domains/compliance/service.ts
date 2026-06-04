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
import { prisma, tenantPrismaTx, tenantTx } from '../../config/db';
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

  // CampaignStateClearance carries no orgId of its own (not RLS-enabled), but
  // this read JOINS to the RLS-enabled Campaign in BOTH the `where` relation-
  // filter and the `campaign` select. Under the non-owner `d2d_app` role, a join
  // to an RLS table with no `app.current_org_id` GUC set sees ZERO rows — so a
  // bare prisma() read would silently return an EMPTY matrix after cutover.
  // `tenantPrismaTx` can't fix this (it no-ops on non-orgScoped models like CSC),
  // so we run inside a GUC-pinned tx via tenantTx — the database then admits this
  // org's campaigns and the join resolves. The explicit `campaign: { orgId }`
  // app-layer filter stays (the suspenders). See docs/runbooks/rls-cutover.md §4b.
  const rows = await tenantTx(orgId, (tx) =>
    tx.campaignStateClearance.findMany({
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
    }),
  );

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
  // Resolve the charity client org from the campaign. Campaign is RLS-enabled, so
  // read it through the belt: tenantPrismaTx AND-injects `orgId = actor.orgId` and
  // sets the GUC, so a campaign owned by another org is simply invisible → 404.
  // (Pre-belt this was a found row + 403 tenantMismatch; post-belt the foreign row
  // never returns, so cross-tenant filing is a uniform notFound — the existence
  // oracle closes.) The returned campaign.orgId therefore always equals
  // actor.orgId. See docs/runbooks/rls-cutover.md §4b.
  const campaign = await tenantPrismaTx(actor.orgId).campaign.findUnique({
    where: { id: input.campaignId },
    select: { orgId: true, regionCode: true },
  });
  if (!campaign) throw new ProblemError(Problems.notFound('Campaign', input.campaignId));

  const filedAt = input.filedAt ? new Date(input.filedAt) : null;
  const status: SolicitorStatus =
    input.status ?? (filedAt || input.evidenceKey ? 'submitted' : 'pending');
  const registrationId = newId('psr');

  const row = await tenantTx(actor.orgId, async (tx) => {
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
  // PaidSolicitorRegistration carries no orgId and is NOT RLS-enabled (operator
  // filings keyed by entityOrgId/clientOrgId), so it stays on the owner prisma()
  // read — the belt can't scope it. The entityOrgId check below is therefore the
  // REAL (un-beltable) tenant guard. We fold a foreign-org match into notFound
  // rather than a 403 tenantMismatch so cross-tenant access is a uniform "does
  // not exist", matching fileRegistration's belt-driven 404 and closing the
  // existence oracle. See docs/runbooks/rls-cutover.md §4b.
  const current = await prisma().paidSolicitorRegistration.findUnique({
    where: { id: registrationId },
    select: { entityOrgId: true, clientOrgId: true, state: true, status: true, filedAt: true },
  });
  if (!current || current.entityOrgId !== actor.orgId) {
    throw new ProblemError(Problems.notFound('PaidSolicitorRegistration', registrationId));
  }

  const allowed = STATUS_TRANSITIONS[current.status];
  if (!allowed.includes(next)) {
    throw new ProblemError(
      Problems.conflict(`Cannot transition registration from ${current.status} to ${next}`),
    );
  }

  const now = new Date();
  const row = await tenantTx(actor.orgId, async (tx) => {
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
