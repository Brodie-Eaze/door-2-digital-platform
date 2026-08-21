/**
 * POST /api/territories/assign — reassign a territory to a different rep.
 *
 * The write half of the Command Centre signature interaction. An operator
 * clicks "Reassign" on an offline-rep coverage gap, picks a nearby available
 * rep, and this route records the move.
 *
 * Body (zod-validated):
 *   { territoryId?: string;        // preferred — explicit Territory row
 *     territoryName?: string;      // fallback lookup by name within the org
 *     toUserId: string;            // rep receiving the territory
 *     fromUserId?: string;         // offline rep being covered for (audit only)
 *     anomalyId?: string }         // the anomaly that triggered this (audit only)
 *
 * HONEST DEGRADATION (critical): the demo runs on seed FleetReps whose ids may
 * not map to real User rows, and territory labels that may not map to Territory
 * rows. Rather than 500 on a foreign-key miss, this route:
 *   - resolves the Territory (by id if given + org-owned, else by name in org);
 *   - confirms the receiving user exists in the org;
 *   - ONLY when BOTH resolve does it archive prior active assignments + create
 *     a new TerritoryAssignment inside a TX (+ audit row);
 *   - otherwise returns { assigned: true, persisted: false } so the UI flow
 *     (fly + drawer + toast) still completes truthfully.
 *
 * Tenant scope: pinned to session.orgId; cross-tenant operators (super_admin)
 * may target a sub-account with ?orgId=.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
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
import { newAssignmentId, writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const assignSchema = z
  .object({
    territoryId: z.string().trim().min(1).optional(),
    territoryName: z.string().trim().min(1).max(120).optional(),
    toUserId: z.string().trim().min(1, 'toUserId is required'),
    fromUserId: z.string().trim().min(1).optional(),
    anomalyId: z.string().trim().min(1).optional(),
  })
  .strict();

export interface AssignResult {
  assigned: true;
  /** True only when a real TerritoryAssignment row was written. */
  persisted: boolean;
  /** Present only when persisted. */
  assignmentId?: string;
  /** Why the write was skipped, when persisted=false (honest signal). */
  reason?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Authz: reassigning a territory is an operator action — a viewer/knocker
  // with a valid session must NOT be able to move coverage. requireSession is
  // authn only; this is the authz gate.
  if (!canOperate(session)) {
    return forbidden('Insufficient role to reassign territory');
  }

  const requestedOrgId = req.nextUrl.searchParams.get('orgId');
  const targetOrgId: string | null = isCrossTenantOperator(session)
    ? (requestedOrgId ?? session.orgId ?? null)
    : (session.orgId ?? null);

  if (!targetOrgId) {
    return forbidden('No org context — cannot reassign territory');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be valid JSON');
  }

  const parsed = assignSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid assignment payload', parsed.error.flatten().fieldErrors);
  }
  const { territoryId, territoryName, toUserId, fromUserId, anomalyId } = parsed.data;

  try {
    // 1. Resolve the territory, org-scoped. Explicit id wins; else best-effort
    //    by name. A miss is NOT an error — we degrade honestly below.
    let territory: { id: string; regionCode: 'US' | 'AU' | 'SG'; name: string } | null = null;
    if (territoryId) {
      const t = await db.territory.findFirst({
        where: { id: territoryId, orgId: targetOrgId },
        select: { id: true, regionCode: true, name: true },
      });
      if (t) territory = { id: t.id, regionCode: t.regionCode, name: t.name };
    }
    if (!territory && territoryName) {
      const t = await db.territory.findFirst({
        where: { orgId: targetOrgId, name: territoryName },
        select: { id: true, regionCode: true, name: true },
      });
      if (t) territory = { id: t.id, regionCode: t.regionCode, name: t.name };
    }

    if (!territory) {
      // Demo fleet rep territory isn't backed by a Territory row — succeed
      // honestly without writing.
      const body: AssignResult = {
        assigned: true,
        persisted: false,
        reason: 'territory_not_found',
      };
      return ok(body);
    }

    // 2. Confirm the receiving user is a real User in this org. Seed rep ids
    //    (e.g. "hope-forward_kn_003") won't be — degrade honestly rather than
    //    FK-failing the assignment write.
    const toUser = await db.user.findFirst({
      where: { id: toUserId, orgId: targetOrgId },
      select: { id: true },
    });
    if (!toUser) {
      const body: AssignResult = {
        assigned: true,
        persisted: false,
        reason: 'rep_not_persisted',
      };
      return ok(body);
    }

    // 3. Real territory + real user → write the assignment in a TX:
    //    archive prior active assignments on this territory, create the new
    //    one, and append an audit row. Const aliases keep the non-null
    //    narrowing alive inside the async closure.
    const resolvedTerritory = territory;
    const resolvedUser = toUser;
    const now = new Date();
    const assignmentId = newAssignmentId();

    await db.$transaction(async (tx) => {
      await tx.territoryAssignment.updateMany({
        where: { territoryId: resolvedTerritory.id, expiresAt: null },
        data: { expiresAt: now },
      });

      await tx.territoryAssignment.create({
        data: {
          id: assignmentId,
          territoryId: resolvedTerritory.id,
          userId: resolvedUser.id,
          assignedAt: now,
        },
      });

      await writeAudit(tx, {
        orgId: targetOrgId,
        regionCode: resolvedTerritory.regionCode,
        actorUserId: session.userId,
        action: 'territory.reassigned',
        resourceType: 'TerritoryAssignment',
        resourceId: assignmentId,
        afterJson: {
          territoryId: resolvedTerritory.id,
          territoryName: resolvedTerritory.name,
          toUserId: resolvedUser.id,
        },
        metadata: {
          fromUserId: fromUserId ?? null,
          anomalyId: anomalyId ?? null,
          via: 'command-centre.reassign-drawer',
        },
      });
    });

    const body: AssignResult = { assigned: true, persisted: true, assignmentId };
    return ok(body);
  } catch (err) {
    console.error('[api/territories/assign POST] failed:', err);
    return internal('Failed to reassign territory');
  }
}
