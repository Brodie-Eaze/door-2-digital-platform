/**
 * /api/orgs/[slug]/roster/shifts — roster a real knocker to a real territory.
 *
 * GET   List KnockerShift rows for the org, optionally scoped to a single
 *       `?weekStart=YYYY-MM-DD`, so the roster grid renders real shifts
 *       instead of a generated planning seed.
 *
 * POST  Create a KnockerShift assigned to a specific `userId` (a real knocker)
 *       and a `territoryId`, so the iOS app's `GET /v1/roster/shifts/mine`
 *       returns it and can open the map onto the rostered territory.
 *
 * This is the web BFF twin of the Fastify `POST /v1/roster/shifts` (apps/api
 * domains/roster/service.createShift): it resolves the target user + territory
 * inside the org, denormalises the rep name/initials + territory name onto the
 * plan row, writes the SAME KnockerShift columns (incl. userId + territoryId),
 * and appends the SAME `roster.shift_created` audit event.
 *
 * The legacy roster write (/api/shifts) creates a KnockerShift with only
 * repInitials/repName/territory STRINGS and no userId — those rows never reach
 * a rep's phone. THIS route is the one that wires a shift to a knocker's app.
 *
 * Tenant scope: resolveAccountOrg pins the org; both the user and the territory
 * must resolve inside that org or the write 404s.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  canWriteRoster,
  forbidden,
  internal,
  notFound,
  ok,
  requireSession,
  resolveAccountOrg,
  validation,
} from '@/lib/api-helpers';
import { newShiftId, writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  const weekStart = req.nextUrl.searchParams.get('weekStart');

  try {
    const shifts = await db.knockerShift.findMany({
      where: { orgId: org.id, ...(weekStart ? { weekStart } : {}) },
      orderBy: [{ weekStart: 'asc' }, { day: 'asc' }, { start: 'asc' }],
      select: {
        id: true,
        userId: true,
        territoryId: true,
        repInitials: true,
        repName: true,
        territory: true,
        weekStart: true,
        day: true,
        start: true,
        end: true,
        lunch: true,
        status: true,
      },
    });

    return ok({ orgId: org.id, shifts });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/roster/shifts GET] failed:', err);
    return internal('Failed to load shifts');
  }
}

// Field names + validators mirror apps/api domains/roster/schemas.createShiftRequestSchema.
const createShiftSchema = z
  .object({
    userId: z.string().trim().min(1, 'userId is required'),
    territoryId: z.string().trim().min(1).optional(),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
    day: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'start must be HH:MM'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'end must be HH:MM'),
    lunch: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, 'lunch must be HH:MM-HH:MM')
      .optional(),
    account: z.string().trim().min(1).max(120).optional(),
    territory: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

/** "Jordan M." + "JM" — same convention as the Fastify roster repDisplay. */
function repDisplay(givenName: string, familyName: string): { name: string; initials: string } {
  const name = familyName ? `${givenName} ${familyName.charAt(0)}.` : givenName;
  const initials = `${givenName.charAt(0)}${familyName.charAt(0) ?? ''}`.toUpperCase();
  return { name, initials };
}

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  if (!canWriteRoster(session)) {
    return forbidden('Your role may not roster shifts');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = createShiftSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid shift payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const id = newShiftId();

  try {
    // Resolve the knocker inside this org — fills the denormalised rep fields.
    const user = await db.user.findFirst({
      where: { id: input.userId, orgId: org.id },
      select: { id: true, givenName: true, familyName: true, role: true },
    });
    if (!user) return notFound('User', input.userId);

    const { name, initials } = repDisplay(user.givenName, user.familyName);

    // territoryId is optional; when present it must resolve to an in-org
    // territory whose name we denormalise onto the plan row. An explicit
    // `territory` label in the body wins, else the resolved name, else ''.
    let territoryName = input.territory ?? '';
    if (input.territoryId) {
      const territory = await db.territory.findFirst({
        where: { id: input.territoryId, orgId: org.id },
        select: { name: true },
      });
      if (!territory) return notFound('Territory', input.territoryId);
      territoryName = input.territory ?? territory.name;
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.knockerShift.create({
        data: {
          id,
          orgId: org.id,
          weekStart: input.weekStart,
          repInitials: initials,
          repName: name,
          account: input.account ?? org.tradingName,
          day: input.day,
          start: input.start,
          end: input.end,
          territory: territoryName,
          lunch: input.lunch ?? null,
          status: 'scheduled',
          userId: input.userId,
          territoryId: input.territoryId ?? null,
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'roster.shift_created',
        resourceType: 'KnockerShift',
        resourceId: id,
        afterJson: {
          userId: input.userId,
          territoryId: input.territoryId ?? null,
          weekStart: input.weekStart,
          day: input.day,
          start: input.start,
          end: input.end,
        },
        metadata: { via: 'web-operator.account-roster' },
      });
      return row;
    });

    return ok(
      {
        shift: {
          id: created.id,
          userId: created.userId,
          territoryId: created.territoryId,
          repInitials: created.repInitials,
          repName: created.repName,
          territory: created.territory,
          account: created.account,
          weekStart: created.weekStart,
          day: created.day,
          start: created.start,
          end: created.end,
          lunch: created.lunch,
          status: created.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/roster/shifts POST] failed:', err);
    return internal('Failed to create shift');
  }
}
