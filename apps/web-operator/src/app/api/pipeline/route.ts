/**
 * /api/pipeline — tenant-scoped CRM pipeline (Kanban) read surface.
 *
 * GET  Lists the org's leads mapped onto Kanban stages. Tenant-scoped to
 *      `session.orgId`; a genuine cross-tenant operator (super_admin) may
 *      target another org with `?orgId=`.
 *
 * PATCH (bulk) Moves a set of leads to a single stage in one transaction.
 *      Body: { ids: string[], stage: KanbanStage } (or { status }).
 *      Every lead is ownership-checked against the resolved org before write.
 *
 * PII: Lead.givenName / familyName are vaulted ciphertext — this route NEVER
 * returns plaintext names. It emits a stable masked display label + initials
 * derived from the lead id so the board stays legible without leaking PII.
 *
 * Kanban stage ⇄ LeadStatus: the board's stages map 1:1 onto the open
 * LeadStatus enum values (new | contacted | qualified | appointment_set |
 * converted). `lost` / `do_not_contact` are terminal/excluded and are not
 * shown as drop targets, but are accepted on write for completeness.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';
import {
  KANBAN_LABEL,
  LEAD_STATUSES,
  displayLabel,
  initialsFromId,
  toLeadStatus,
  type LeadStatusValue,
} from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ────────────────────────────────────────────────────────────────────────────
// Deterministic, non-PII display derivations. Same lead id always yields the
// same derived numbers so the board is stable across reloads without ever
// touching the vaulted name columns.
// ────────────────────────────────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function daysSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

// ────────────────────────────────────────────────────────────────────────────
// Tenant resolution
// ────────────────────────────────────────────────────────────────────────────

function resolveOrgId(
  req: NextRequest,
  session: { orgId: string | null; role: string },
): string | null {
  if (isCrossTenantOperator(session as never)) {
    return req.nextUrl.searchParams.get('orgId') ?? session.orgId;
  }
  return session.orgId;
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgId = resolveOrgId(req, session);
  if (!orgId) return forbidden('No org context');

  try {
    const leads = await db.lead.findMany({
      where: { orgId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
      select: {
        id: true,
        status: true,
        vertical: true,
        assignedToId: true,
        sourceKnockId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({
      orgId,
      leads: leads.map((l) => ({
        id: l.id,
        // Kanban stage IS the LeadStatus value (1:1 mapping).
        stage: l.status,
        status: l.status,
        stageLabel: KANBAN_LABEL[l.status as LeadStatusValue] ?? l.status,
        vertical: l.vertical,
        // Non-PII display surface (names are vaulted ciphertext).
        label: displayLabel(l.id),
        initials: initialsFromId(l.id),
        assigneeInitials: l.assignedToId ? initialsFromId(l.assignedToId) : null,
        fromDoor: Boolean(l.sourceKnockId),
        daysInStage: daysSince(l.updatedAt),
        // Deterministic AI-ish score derived from id — stable, non-PII.
        aiScore: 40 + (hashId(l.id) % 60),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/pipeline GET] failed:', err);
    return internal('Failed to load pipeline');
  }
}

/**
 * Bulk stage move. Body: { ids: string[]; stage?: string; status?: string }.
 * Each lead is tenant-scoped + ownership-checked via an orgId-bound
 * updateMany, so a foreign id is silently a no-op (never leaks existence).
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgId = resolveOrgId(req, session);
  if (!orgId) return forbidden('No org context');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const body = (raw ?? {}) as { ids?: unknown; stage?: unknown; status?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string')
    : [];
  if (ids.length === 0) return validation('ids[] must be a non-empty array of lead ids');
  if (ids.length > 200) return validation('Cannot bulk-move more than 200 leads at once');

  const nextStatus = toLeadStatus(body.stage ?? body.status);
  if (!nextStatus) {
    return validation('stage/status must map to a valid LeadStatus', {
      allowed: LEAD_STATUSES,
    });
  }

  try {
    // Ownership + tenant scope: updateMany with orgId guard only touches rows
    // the caller owns. count tells us how many actually matched.
    const result = await db.lead.updateMany({
      where: { id: { in: ids }, orgId },
      data: { status: nextStatus },
    });

    return ok({
      orgId,
      stage: nextStatus,
      stageLabel: KANBAN_LABEL[nextStatus],
      requested: ids.length,
      moved: result.count,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/pipeline PATCH] failed:', err);
    return internal('Failed to move leads');
  }
}
