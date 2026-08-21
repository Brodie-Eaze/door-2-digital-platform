/**
 * /api/shifts/[id] — update or delete a single KnockerShift.
 *
 * PATCH  Partial update — any subset of mutable fields.
 * DELETE Removes the shift row.
 *
 * Both operations assert the shift belongs to the session's orgId before acting
 * (tenant isolation, defence-in-depth over the RLS belt).
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  canWriteRoster,
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const shiftStatusEnum = z.enum(['scheduled', 'active', 'lunch', 'missed', 'completed']);

const patchShiftSchema = z.object({
  repInitials: z.string().min(1).max(8).optional(),
  repName: z.string().min(1).max(100).optional(),
  account: z.string().min(1).max(100).optional(),
  day: z.number().int().min(0).max(6).optional(),
  start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  territory: z.string().min(1).max(100).optional(),
  lunch: z.string().nullable().optional(),
  status: shiftStatusEnum.optional(),
});

// Next 15: dynamic route params are async and must be awaited.
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  if (!canWriteRoster(session)) {
    return forbidden('Insufficient role to modify roster shifts');
  }

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = patchShiftSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid patch payload', parsed.error.flatten());
  }
  const patch = parsed.data;

  // Resolve target org scope for cross-tenant operators.
  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context');
  }

  try {
    // Verify ownership before mutating (belt-and-suspenders over RLS).
    const existing = await db.knockerShift.findFirst({
      where: { id, orgId: targetOrgId },
      select: { id: true },
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const updated = await db.knockerShift.update({
      where: { id },
      data: {
        ...(patch.repInitials !== undefined && { repInitials: patch.repInitials }),
        ...(patch.repName !== undefined && { repName: patch.repName }),
        ...(patch.account !== undefined && { account: patch.account }),
        ...(patch.day !== undefined && { day: patch.day }),
        ...(patch.start !== undefined && { start: patch.start }),
        ...(patch.end !== undefined && { end: patch.end }),
        ...(patch.territory !== undefined && { territory: patch.territory }),
        ...(patch.lunch !== undefined && { lunch: patch.lunch }),
        ...(patch.status !== undefined && { status: patch.status }),
      },
    });

    return ok({ shift: updated });
  } catch (err) {
    console.error('[api/shifts/[id] PATCH] failed:', err);
    return internal('Failed to update shift');
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  if (!canWriteRoster(session)) {
    return forbidden('Insufficient role to modify roster shifts');
  }

  const { id } = await ctx.params;

  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context');
  }

  try {
    // Ownership check first.
    const existing = await db.knockerShift.findFirst({
      where: { id, orgId: targetOrgId },
      select: { id: true },
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    await db.knockerShift.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    console.error('[api/shifts/[id] DELETE] failed:', err);
    return internal('Failed to delete shift');
  }
}
