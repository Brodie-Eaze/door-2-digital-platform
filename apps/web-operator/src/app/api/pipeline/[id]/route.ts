/**
 * /api/pipeline/[id] — move a single lead across the Kanban pipeline.
 *
 * PATCH Accepts { stage } OR { status }, maps the Kanban stage back to a
 *       LeadStatus enum value, and persists `Lead.status`. The lead is
 *       ownership-checked (findFirst where id + orgId) BEFORE the update so a
 *       cross-tenant id can never be mutated (defence-in-depth over RLS).
 *
 * Next 15 App Router: dynamic route params are ASYNC — `{ params }` is a
 * Promise and must be awaited before reading.
 *
 * PII: returns the persisted status + a non-PII display label only. Names are
 * vaulted ciphertext and are never echoed.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import {
  canOperate,
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';
import { KANBAN_LABEL, displayLabel, initialsFromId, toLeadStatus } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Authz: moving a CRM lead is an operator action.
  if (!canOperate(session)) {
    return forbidden('Insufficient role to move pipeline leads');
  }

  const id = params.id;
  if (!id) return validation('Lead id is required');

  // Tenant scope: own org by default; super_admin may target ?orgId=.
  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;
  if (!targetOrgId) return forbidden('No org context');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const body = (raw ?? {}) as { stage?: unknown; status?: unknown };
  const nextStatus = toLeadStatus(body.stage ?? body.status);
  if (!nextStatus) {
    return validation('stage/status must map to a valid LeadStatus value');
  }

  try {
    // Ownership check first (belt-and-suspenders over RLS): the lead must
    // belong to the resolved org. A foreign id → 404, never a cross-tenant write.
    const existing = await db.lead.findFirst({
      where: { id, orgId: targetOrgId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const updated = await db.lead.update({
      where: { id },
      data: { status: nextStatus },
      select: {
        id: true,
        status: true,
        vertical: true,
        assignedToId: true,
        sourceKnockId: true,
        updatedAt: true,
      },
    });

    return ok({
      lead: {
        id: updated.id,
        stage: updated.status,
        status: updated.status,
        stageLabel: KANBAN_LABEL[updated.status] ?? updated.status,
        vertical: updated.vertical,
        label: displayLabel(updated.id),
        initials: initialsFromId(updated.id),
        assigneeInitials: updated.assignedToId ? initialsFromId(updated.assignedToId) : null,
        fromDoor: Boolean(updated.sourceKnockId),
        previousStage: existing.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/pipeline/[id] PATCH] failed:', err);
    return internal('Failed to move lead');
  }
}
