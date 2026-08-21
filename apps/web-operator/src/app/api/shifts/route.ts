/**
 * /api/shifts — list + create knocker shifts for the weekly roster.
 *
 * GET  ?weekStart=YYYY-MM-DD  Returns all KnockerShift rows for the org + week.
 * POST                        Creates a new KnockerShift. Returns the created row.
 *
 * weekStart must be the ISO date of the Monday for the target week
 * (e.g. "2026-06-09"). The roster page computes this from its weekOffset state.
 *
 * All mutations are tenant-scoped to session.orgId. Cross-tenant operators
 * (super_admin) must pass an explicit orgId query param to target a sub-account
 * — for HQ-level roster management.
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
import { newShiftId } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const shiftStatusEnum = z.enum(['scheduled', 'active', 'lunch', 'missed', 'completed']);

const createShiftSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
  repInitials: z.string().min(1).max(8),
  repName: z.string().min(1).max(100),
  account: z.string().min(1).max(100),
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'start must be HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'end must be HH:MM'),
  territory: z.string().min(1).max(100),
  lunch: z.string().nullable().optional(),
  status: shiftStatusEnum.default('scheduled'),
});

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const weekStart = req.nextUrl.searchParams.get('weekStart');
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return validation('weekStart query param is required (YYYY-MM-DD)');
  }

  // Resolve org scope: cross-tenant ops can pass ?orgId= to target sub-accounts.
  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context — cannot load shifts');
  }

  try {
    const shifts = await db.knockerShift.findMany({
      where: { orgId: targetOrgId, weekStart },
      orderBy: [{ day: 'asc' }, { start: 'asc' }],
    });
    return ok({ shifts });
  } catch (err) {
    console.error('[api/shifts GET] failed:', err);
    return internal('Failed to load shifts');
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Roster creation requires at least org_admin or manager role.
  // Cross-tenant operators may create for any org.
  if (!canWriteRoster(session)) {
    return forbidden('Insufficient role to create roster shifts');
  }

  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context — cannot create shift');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = createShiftSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid shift payload', parsed.error.flatten());
  }
  const input = parsed.data;

  try {
    const shift = await db.knockerShift.create({
      data: {
        id: newShiftId(),
        orgId: targetOrgId,
        weekStart: input.weekStart,
        repInitials: input.repInitials,
        repName: input.repName,
        account: input.account,
        day: input.day,
        start: input.start,
        end: input.end,
        territory: input.territory,
        lunch: input.lunch ?? null,
        status: input.status,
      },
    });
    return ok({ shift }, { status: 201 });
  } catch (err) {
    console.error('[api/shifts POST] failed:', err);
    return internal('Failed to create shift');
  }
}
