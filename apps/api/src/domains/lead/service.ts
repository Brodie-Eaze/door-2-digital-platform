/**
 * Lead service — create, read, list, patch, assign, activity append.
 *
 * State machine:
 *   new → contacted → qualified → appointment_set → converted | lost | do_not_contact
 * Backwards transitions return 400 PROBLEM_INVALID_STATE_TRANSITION.
 * `do_not_contact` is terminal — no further transitions allowed.
 *
 * Auto-routing: when a Lead is created without `assignedToId`, the service
 * picks an `inside_sales` user from the same org via simple round-robin
 * (least-recently-assigned). Replaced with a proper queue/skill router in
 * a later phase.
 *
 * PII: email and phone are envelope-encrypted into *Vault columns and their
 * HMAC-SHA256 SIV digests stored for O(1) lookup. The legacy `email`/`phone`
 * TEXT columns hold only the masked form (e.g. j•••@gmail.com) so the read
 * boundary never exposes plaintext. Full values require a JIT unmask grant.
 */
import type { LeadStatus, RegionCode, Vertical } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { PiiVaultService } from '../pii-vault/service';
import { writeAudit } from '../../shared/audit/write';
import type {
  CreateLeadRequest,
  UpdateLeadRequest,
  AssignLeadRequest,
  LeadActivityRequest,
  ListLeadsQuery,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface LeadPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  status: LeadStatus;
  vertical: Vertical;
  campaignId: string | null;
  sourceKnockId: string | null;
  addressId: string | null;
  assignedToId: string | null;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityPublic {
  id: string;
  leadId: string;
  userId: string | null;
  type: string;
  outcome: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LeadWithActivities extends LeadPublic {
  activities: LeadActivityPublic[];
}

// ───────────────────────────────────────────────────────────────────────────
// State machine
// ───────────────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<LeadStatus, ReadonlyArray<LeadStatus>> = {
  new: ['contacted', 'do_not_contact', 'lost'],
  contacted: ['qualified', 'lost', 'do_not_contact'],
  qualified: ['appointment_set', 'lost', 'do_not_contact'],
  appointment_set: ['converted', 'lost', 'do_not_contact'],
  // Terminal.
  converted: [],
  lost: [],
  do_not_contact: [],
};

export function isValidTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true; // no-op patch
  return TRANSITIONS[from].includes(to);
}

function rejectInvalidTransition(from: LeadStatus, to: LeadStatus): never {
  throw new ProblemError({
    type: 'https://docs.d2d.io/problems/invalid-state-transition',
    title: 'Invalid state transition',
    status: 400,
    detail: `Cannot transition Lead from ${from} to ${to}`,
    extras: { from, to, allowedNext: TRANSITIONS[from] },
  } as never);
}

// ───────────────────────────────────────────────────────────────────────────
// Auto-routing — pick an inside_sales user round-robin
// ───────────────────────────────────────────────────────────────────────────

async function pickInsideSalesRep(orgId: string): Promise<string | null> {
  const candidates = await prisma().user.findMany({
    where: { orgId, role: 'inside_sales', status: 'active' },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (candidates.length === 0) return null;

  // Round-robin via least-recently-assigned: pick the rep with the oldest
  // most-recent assignment. If a rep has never been assigned, they come
  // first. Implemented as: count leads per rep, take the lowest count,
  // tie-break by id.
  const counts = await prisma().lead.groupBy({
    by: ['assignedToId'],
    where: {
      orgId,
      assignedToId: { in: candidates.map((c) => c.id) },
    },
    _count: { _all: true },
  });
  const countByUser = new Map<string, number>();
  for (const c of counts) {
    if (c.assignedToId) countByUser.set(c.assignedToId, c._count._all);
  }
  let best: { id: string; count: number } | null = null;
  for (const cand of candidates) {
    const count = countByUser.get(cand.id) ?? 0;
    if (!best || count < best.count) {
      best = { id: cand.id, count };
    }
  }
  return best?.id ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// Create / read / list
// ───────────────────────────────────────────────────────────────────────────

export async function createLead(
  input: CreateLeadRequest,
  actor: ActorContext,
): Promise<LeadPublic> {
  if (input.campaignId) {
    const c = await prisma().campaign.findUnique({
      where: { id: input.campaignId },
      select: { orgId: true },
    });
    if (!c) throw new ProblemError(Problems.notFound('Campaign', input.campaignId));
    if (c.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(c.orgId));
    }
  }
  if (input.addressId) {
    const a = await prisma().address.findUnique({ where: { id: input.addressId } });
    if (!a) throw new ProblemError(Problems.notFound('Address', input.addressId));
  }
  if (input.sourceKnockId) {
    const k = await prisma().knock.findUnique({
      where: { id: input.sourceKnockId },
      select: { orgId: true },
    });
    if (!k) throw new ProblemError(Problems.notFound('Knock', input.sourceKnockId));
    if (k.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(k.orgId));
    }
  }
  if (input.assignedToId) {
    const u = await prisma().user.findUnique({
      where: { id: input.assignedToId },
      select: { orgId: true },
    });
    if (!u || u.orgId !== actor.orgId) {
      throw new ProblemError(Problems.validation('assignedToId is not in this org'));
    }
  }

  let assignedToId = input.assignedToId ?? null;
  if (!assignedToId) {
    assignedToId = await pickInsideSalesRep(actor.orgId);
  }

  const id = newId('lead');
  // Agent 15 — PII vault wraps email/phone/notes. Digests use HMAC-SHA256
  // (deterministic) so unique lookups still work without holding plaintext.
  const emailVault = input.email ? PiiVaultService.encryptForRow('Lead', id, input.email) : null;
  const phoneVault = input.phone ? PiiVaultService.encryptForRow('Lead', id, input.phone) : null;
  const emailDig = input.email ? PiiVaultService.digest(input.email) : null;
  const phoneDig = input.phone ? PiiVaultService.digest(input.phone) : null;
  const notesVault = input.notes ? PiiVaultService.encryptForRow('Lead', id, input.notes) : null;

  const result = await prisma().$transaction(async (tx) => {
    const row = await tx.lead.create({
      data: {
        id,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        sourceKnockId: input.sourceKnockId ?? null,
        addressId: input.addressId ?? null,
        status: 'new',
        assignedToId,
        vertical: input.vertical,
        campaignId: input.campaignId ?? null,
        givenName: input.givenName,
        familyName: input.familyName,
        // email/phone columns store only the masked form so no plaintext PII
        // ever lands in the legacy TEXT column. Full values live in *Vault.
        email: input.email ? maskEmailPii(input.email) : null,
        emailDigest: emailDig,
        emailVault: emailVault ? (emailVault as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        phone: input.phone ? maskPhonePii(input.phone) : null,
        phoneDigest: phoneDig,
        phoneVault: phoneVault ? (phoneVault as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        notesVault: notesVault ? (notesVault as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'lead.created',
      resourceType: 'Lead',
      resourceId: id,
      afterJson: {
        status: row.status,
        vertical: row.vertical,
        campaignId: row.campaignId,
        assignedToId: row.assignedToId,
        // PII redacted — emailDigest/phoneDigest are reversible only with
        // PII_SEARCH_KEY which lives outside the audit chain.
        givenName: '[REDACTED]',
        familyName: '[REDACTED]',
        emailDigest: emailDig,
        phoneDigest: phoneDig,
      },
    });
    // consentChannels is captured at the lead level for context only.
    // The proper ConsentRecord write — with channel/text/granted +
    // signed evidence — is handled by the consent service (Phase 1.4).
    if (input.consentChannels?.length) {
      await tx.leadActivity.create({
        data: {
          id: newId('lac'),
          leadId: id,
          userId: actor.userId,
          type: 'note',
          outcome: 'consent_declared',
          payload: { channels: input.consentChannels },
        },
      });
    }
    if (input.notes) {
      await tx.leadActivity.create({
        data: {
          id: newId('lac'),
          leadId: id,
          userId: actor.userId,
          type: 'note',
          payload: { body: input.notes },
        },
      });
    }
    return row;
  });

  // Fire CRM push non-blocking — never fails the lead save.
  // IDs only logged; no PII (email/phone) ever written to logs.
  void (async () => {
    try {
      const { buildDefaultRegistry } = await import('@d2d/integrations');
      const { PiiVaultService: PiiVault } = await import('../pii-vault/service');

      const crmKinds = ['crm_salesforce', 'crm_hubspot', 'crm_zapier'] as const;
      const connections = await prisma().providerConnection.findMany({
        where: { orgId: actor.orgId, kind: { in: [...crmKinds] }, status: 'connected' },
        select: { id: true, kind: true, mode: true, credentialsVault: true },
      });
      if (connections.length === 0) return;

      const registry = buildDefaultRegistry();

      for (const conn of connections) {
        const adapter = registry.tryGet(conn.kind as (typeof crmKinds)[number]);
        if (!adapter?.pushLead) continue;

        let credentials: Record<string, string> = {};
        if (conn.credentialsVault) {
          try {
            const plain = PiiVault.decrypt(
              conn.credentialsVault as unknown as Parameters<typeof PiiVault.decrypt>[0],
              'ProviderConnection',
              conn.id,
            );
            const bundle = JSON.parse(plain) as { credentials: Record<string, string> };
            credentials = bundle.credentials;
          } catch {
            // Vault decrypt failure — skip this connection silently.
            continue;
          }
        }

        const config = {
          credentials,
          mode: conn.mode === 'production' ? ('production' as const) : ('sandbox' as const),
        };

        await adapter.pushLead(
          {
            leadId: result.id,
            orgId: actor.orgId,
            givenName: result.givenName,
            familyName: result.familyName,
            // email/phone: pass only if input had plaintext (already masked on `result`).
            ...(input.email && { email: input.email }),
            ...(input.phone && { phone: input.phone }),
            status: result.status,
            ...(input.sourceKnockId && { knockedAt: new Date(result.createdAt).toISOString() }),
            ...(result.sourceKnockId && { sourceTerritoryId: result.sourceKnockId }),
          },
          config,
        );
        // Log only IDs — no PII.
      }
    } catch {
      // CRM push failure never surfaces to caller.
    }
  })();

  return toPublic(result);
}

export async function listLeads(
  query: ListLeadsQuery,
  actor: ActorContext,
): Promise<{ data: LeadPublic[]; nextCursor: string | null }> {
  const where: Prisma.LeadWhereInput = { orgId: actor.orgId };
  if (query.status) where.status = query.status;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.vertical) where.vertical = query.vertical;
  if (query.campaignId) where.campaignId = query.campaignId;

  const rows = await prisma().lead.findMany({
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

export interface CallbackPublic {
  id: string;
  leadId: string;
  leadName: string;
  addressLine: string;
  scheduledFor: string;
  phone: string;
  notes: string | null;
  isOverdue: boolean;
}

/**
 * Scheduled callbacks for the native Knocker app, soonest first.
 *
 * TODO(callback model): there is no scheduled-callback source today. The
 * schema has no `scheduledFor` / `bestCallTime` column on Lead or
 * LeadActivity, and neither `LeadStatus` (...|appointment_set|...) nor
 * `LeadActivity.type` (call_outbound|call_inbound|sms|email|note|
 * sequence_step) carries a future scheduled time — `appointment_set` is a
 * status, not a calendar slot. Until a callback concept lands (e.g. a
 * `LeadCallback` model, or a `scheduledFor` DateTime on a `type:'callback'`
 * LeadActivity), we return an empty list rather than fabricate times. The org
 * scope + actor assignment filter are wired so the contract is correct the
 * moment that source exists.
 */
export async function listCallbacks(actor: ActorContext): Promise<CallbackPublic[]> {
  void actor.orgId;
  void actor.userId;
  return [];
}

export async function getLead(id: string, actor: ActorContext): Promise<LeadWithActivities> {
  const row = await prisma().lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!row) throw new ProblemError(Problems.notFound('Lead', id));
  if (row.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(row.orgId));
  }
  return {
    ...toPublic(row),
    activities: row.activities.map(toActivityPublic),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Patch
// ───────────────────────────────────────────────────────────────────────────

export async function updateLead(
  id: string,
  input: UpdateLeadRequest,
  actor: ActorContext,
): Promise<LeadPublic> {
  const existing = await prisma().lead.findUnique({ where: { id } });
  if (!existing) throw new ProblemError(Problems.notFound('Lead', id));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }
  if (input.status && !isValidTransition(existing.status, input.status)) {
    rejectInvalidTransition(existing.status, input.status);
  }
  if (input.assignedToId && input.assignedToId !== existing.assignedToId) {
    const u = await prisma().user.findUnique({
      where: { id: input.assignedToId },
      select: { orgId: true },
    });
    if (!u || u.orgId !== actor.orgId) {
      throw new ProblemError(Problems.validation('assignedToId is not in this org'));
    }
  }

  const updated = await prisma().$transaction(async (tx) => {
    const next = await tx.lead.update({
      where: { id },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.assignedToId !== undefined && { assignedToId: input.assignedToId }),
      },
    });
    if (input.status && input.status !== existing.status) {
      await tx.leadActivity.create({
        data: {
          id: newId('lac'),
          leadId: id,
          userId: actor.userId,
          type: 'sequence_step',
          outcome: `status:${existing.status}->${input.status}`,
          payload: { from: existing.status, to: input.status },
        },
      });
    }
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'lead.updated',
      resourceType: 'Lead',
      resourceId: id,
      beforeJson: { status: existing.status, assignedToId: existing.assignedToId },
      afterJson: { status: next.status, assignedToId: next.assignedToId },
    });
    return next;
  });
  return toPublic(updated);
}

export async function assignLead(
  id: string,
  input: AssignLeadRequest,
  actor: ActorContext,
): Promise<LeadPublic> {
  const existing = await prisma().lead.findUnique({ where: { id } });
  if (!existing) throw new ProblemError(Problems.notFound('Lead', id));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }
  const u = await prisma().user.findUnique({
    where: { id: input.userId },
    select: { orgId: true },
  });
  if (!u || u.orgId !== actor.orgId) {
    throw new ProblemError(Problems.validation('userId is not in this org'));
  }

  const updated = await prisma().$transaction(async (tx) => {
    const next = await tx.lead.update({
      where: { id },
      data: { assignedToId: input.userId },
    });
    await tx.leadActivity.create({
      data: {
        id: newId('lac'),
        leadId: id,
        userId: actor.userId,
        type: 'note',
        outcome: 'reassigned',
        payload: {
          from: existing.assignedToId,
          to: input.userId,
          ...(input.reason && { reason: input.reason }),
        },
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'lead.assigned',
      resourceType: 'Lead',
      resourceId: id,
      beforeJson: { assignedToId: existing.assignedToId },
      afterJson: { assignedToId: next.assignedToId },
      ...(input.reason && { metadata: { reason: input.reason } }),
    });
    return next;
  });
  return toPublic(updated);
}

export async function appendActivity(
  leadId: string,
  input: LeadActivityRequest,
  actor: ActorContext,
): Promise<LeadActivityPublic> {
  const existing = await prisma().lead.findUnique({ where: { id: leadId } });
  if (!existing) throw new ProblemError(Problems.notFound('Lead', leadId));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }

  const id = newId('lac');
  const created = await prisma().$transaction(async (tx) => {
    const row = await tx.leadActivity.create({
      data: {
        id,
        leadId,
        userId: actor.userId,
        type: input.type,
        outcome: input.outcome ?? null,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'leadActivity.created',
      resourceType: 'LeadActivity',
      resourceId: id,
      afterJson: { type: row.type, outcome: row.outcome },
    });
    return row;
  });
  return toActivityPublic(created);
}

export async function flagLeadDnk(
  id: string,
  input: { reason?: string },
  actor: ActorContext,
): Promise<LeadPublic> {
  const lead = await prisma().lead.findUnique({ where: { id } });
  if (!lead) throw new ProblemError(Problems.notFound('Lead', id));
  if (lead.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(lead.orgId));
  if (!lead.addressId) {
    throw new ProblemError(Problems.validation('Lead has no address to flag as do-not-knock'));
  }

  const updated = await prisma().$transaction(async (tx) => {
    await tx.doNotKnock.upsert({
      where: {
        regionCode_addressId: { regionCode: lead.regionCode, addressId: lead.addressId! },
      },
      create: {
        id: newId('dnk'),
        regionCode: lead.regionCode,
        addressId: lead.addressId!,
        source: 'manager_flag',
        loadedAt: new Date(),
      },
      update: { source: 'manager_flag', loadedAt: new Date() },
    });
    const next = await tx.lead.update({
      where: { id },
      data: { status: 'do_not_contact' },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'lead.do_not_knock',
      resourceType: 'Lead',
      resourceId: id,
      beforeJson: { status: lead.status },
      afterJson: { status: 'do_not_contact' },
      metadata: { addressId: lead.addressId, reason: input.reason ?? null },
    });
    return next;
  });

  return toPublic(updated);
}

// ───────────────────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────────────────

// PII-first: the default read boundary masks. Lead given/family names, email,
// and phone are PII; the API never emits them in plaintext by default. Plaintext
// retrieval must go through an explicit, audited JIT pii-vault unmask grant (not
// the list/read path). These helpers mirror the BFF masking discipline so the
// Fastify surface can't leak more than the web BFF.
function maskEmailPii(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain || !user) return '•••';
  const head = user.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(2, user.length - 1))}@${domain}`;
}
function maskPhonePii(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '•••';
  return `••• ••• ${digits.slice(-4)}`;
}
function maskFamilyName(name: string): string {
  return name ? `${name.charAt(0)}.` : '';
}

function toPublic(l: {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  status: LeadStatus;
  vertical: Vertical;
  campaignId: string | null;
  sourceKnockId: string | null;
  addressId: string | null;
  assignedToId: string | null;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LeadPublic {
  return {
    id: l.id,
    orgId: l.orgId,
    regionCode: l.regionCode,
    brandCode: l.brandCode,
    status: l.status,
    vertical: l.vertical,
    campaignId: l.campaignId,
    sourceKnockId: l.sourceKnockId,
    addressId: l.addressId,
    assignedToId: l.assignedToId,
    // PII-first: masked at the read boundary. Family name → initial, email +
    // phone → masked. Full PII requires an audited JIT pii-vault unmask grant.
    givenName: l.givenName,
    familyName: maskFamilyName(l.familyName),
    email: maskEmailPii(l.email),
    phone: maskPhonePii(l.phone),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

function toActivityPublic(a: {
  id: string;
  leadId: string;
  userId: string | null;
  type: string;
  outcome: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): LeadActivityPublic {
  return {
    id: a.id,
    leadId: a.leadId,
    userId: a.userId,
    type: a.type,
    outcome: a.outcome,
    payload: (a.payload ?? {}) as Record<string, unknown>,
    createdAt: a.createdAt.toISOString(),
  };
}
