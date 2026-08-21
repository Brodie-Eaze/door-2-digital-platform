/**
 * Roster service — read model + mutations for the native Knocker app's shift
 * board and clock-in/out, plus the platform's "roster a knocker" write.
 *
 * A KnockerShift is a *plan* (which rep works which territory, when). A
 * KnockSession is the *actual* clocked-in working session that field captures
 * (knocks) hang off. Clock-in flips the shift to `active` AND opens a session;
 * clock-out flips the shift to `completed` AND closes the open session.
 *
 * Everything is scoped to the authenticated principal's org — the orgId is
 * NEVER read from the request body. Reads use the tenant-scoped `prisma()`
 * extension; mutations run inside a `tenantTx` (RLS belt) with an audit row.
 */
import type { RegionCode } from '@prisma/client';
import { newId, problem, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import { emitAnalyticsEvent } from '../analytics/service';
import type { ClockInRequest, CreateShiftRequest } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

/** iOS decodes this exact shape (a JSON array at GET /shifts/mine). */
export interface MyShift {
  id: string;
  weekStart: string; // "YYYY-MM-DD"
  day: number; // 0 = Mon … 6 = Sun
  date: string; // "YYYY-MM-DD" = weekStart + day days
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  lunch: string | null;
  territory: string; // territory name
  territoryId: string | null;
  account: string;
  status: 'scheduled' | 'active' | 'lunch' | 'missed' | 'completed';
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The Monday (UTC) of the week containing `now`. We anchor the roster week in
 * UTC — not the rep's local TZ — so a distributed field team shares ONE week
 * boundary; per-device-local weeks would put two reps in different "this weeks"
 * near midnight. The native app renders the wall-clock times in local TZ.
 */
function mondayOfUtcWeek(now: Date): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: 0 = Sun … 6 = Sat. Shift so Monday = 0, Sunday = 6.
  const isoDow = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - isoDow * MS_PER_DAY);
}

/** "YYYY-MM-DD" of a UTC date. */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** weekStart ("YYYY-MM-DD" Monday) + `day` days, as a "YYYY-MM-DD" string. */
function shiftDate(weekStart: string, day: number): string {
  const monday = new Date(`${weekStart}T00:00:00.000Z`);
  return toIsoDate(new Date(monday.getTime() + day * MS_PER_DAY));
}

/**
 * In-org display name. Mirrors daily-stats / staff-directory: full given name +
 * family initial — identifiable enough for the roster without emitting a full
 * surname into a plan row.
 */
function repDisplay(givenName: string, familyName: string): { name: string; initials: string } {
  const name = familyName ? `${givenName} ${familyName.charAt(0)}.` : givenName;
  const initials = `${givenName.charAt(0)}${familyName.charAt(0) ?? ''}`.toUpperCase();
  return { name, initials };
}

/**
 * The caller's own shifts for the current + next UTC roster week, ordered by
 * weekStart, day, start. `userId` is the authenticated principal — never the
 * request — so a rep can only ever see their own roster.
 */
export async function listMyShifts(actor: ActorContext): Promise<MyShift[]> {
  const thisMonday = mondayOfUtcWeek(new Date());
  const nextMonday = new Date(thisMonday.getTime() + 7 * MS_PER_DAY);

  const rows = await prisma().knockerShift.findMany({
    where: {
      orgId: actor.orgId,
      userId: actor.userId,
      weekStart: { in: [toIsoDate(thisMonday), toIsoDate(nextMonday)] },
    },
    orderBy: [{ weekStart: 'asc' }, { day: 'asc' }, { start: 'asc' }],
  });

  return rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    day: r.day,
    date: shiftDate(r.weekStart, r.day),
    start: r.start,
    end: r.end,
    lunch: r.lunch,
    territory: r.territory,
    territoryId: r.territoryId,
    account: r.account,
    status: r.status,
  }));
}

/**
 * Roster a specific knocker (manager/admin path). Resolves the target user
 * (must live in the caller's org) to fill the denormalised rep name/initials,
 * and — when a territoryId is given — its name for the `territory` string.
 */
export async function createShift(
  input: CreateShiftRequest,
  actor: ActorContext,
): Promise<{ id: string }> {
  const id = newId('ksft');

  const result = await tenantTx(actor.orgId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: input.userId, orgId: actor.orgId },
      select: { id: true, givenName: true, familyName: true },
    });
    if (!user) throw new ProblemError(Problems.notFound('User', input.userId));

    const { name, initials } = repDisplay(user.givenName, user.familyName);

    // territoryId is optional; when present it must resolve to an in-org
    // territory whose name we denormalise onto the plan row. An explicit
    // `territory` string in the body wins (manager-typed label), else the
    // resolved name, else an empty label.
    let territoryName = input.territory ?? '';
    if (input.territoryId) {
      const territory = await tx.territory.findFirst({
        where: { id: input.territoryId, orgId: actor.orgId },
        select: { name: true },
      });
      if (!territory) throw new ProblemError(Problems.notFound('Territory', input.territoryId));
      territoryName = input.territory ?? territory.name;
    }

    await tx.knockerShift.create({
      data: {
        id,
        orgId: actor.orgId,
        weekStart: input.weekStart,
        repInitials: initials,
        repName: name,
        account: input.account ?? '',
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

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
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
    });

    return { id };
  });

  return result;
}

/**
 * Load a shift the caller owns. A shift whose `userId` is not the caller (or
 * that lives in another tenant) is indistinguishable from a 404 to the
 * caller via the tenant-scoped read; ownership mismatch is an explicit 403.
 */
async function loadOwnedShift(
  shiftId: string,
  actor: ActorContext,
): Promise<{ id: string; userId: string | null; territoryId: string | null }> {
  const shift = await prisma().knockerShift.findFirst({
    where: { id: shiftId, orgId: actor.orgId },
    select: { id: true, userId: true, territoryId: true },
  });
  if (!shift) throw new ProblemError(Problems.notFound('KnockerShift', shiftId));
  if (shift.userId !== actor.userId) {
    throw new ProblemError(Problems.forbidden('This shift is not rostered to you'));
  }
  return shift;
}

/**
 * Clock in: flip the shift to `active` and open the actual KnockSession that
 * field capture hangs off. The session's territory comes from the SHIFT's
 * territoryId — a shift with no territory can't open a session (422).
 */
export async function clockIn(
  shiftId: string,
  input: ClockInRequest,
  actor: ActorContext,
): Promise<{ shiftId: string; sessionId: string }> {
  const shift = await loadOwnedShift(shiftId, actor);
  if (!shift.territoryId) {
    throw new ProblemError(
      problem('shift-no-territory', 'Shift has no territory', {
        status: 422,
        detail: 'Shift has no territory; cannot open a knock session',
      }),
    );
  }
  const territoryId = shift.territoryId;

  // Capture the start position as a "lat,long" string only when BOTH are given
  // (a half-pair is not a coordinate). PostGIS TEXT placeholder, same as Knock.
  const startGeo =
    input.latitude !== undefined && input.longitude !== undefined
      ? `${input.latitude},${input.longitude}`
      : null;

  const sessionId = newId('sess');
  // One `now` shared by the session's startedAt and the analytics occurredAt so
  // the warehouse "session_start" time matches the session row exactly.
  const now = new Date();

  await tenantTx(actor.orgId, async (tx) => {
    await tx.knockerShift.update({
      where: { id: shiftId },
      data: { status: 'active' },
    });

    await tx.knockSession.create({
      data: {
        id: sessionId,
        orgId: actor.orgId,
        userId: actor.userId,
        territoryId,
        regionCode: actor.regionCode,
        startedAt: now,
        startGeo,
        deviceId: input.deviceId,
        appVersion: input.appVersion ?? null,
        osVersion: input.osVersion ?? null,
        attestationToken: input.attestationToken ?? null,
      },
    });

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'roster.clock_in',
      resourceType: 'KnockerShift',
      resourceId: shiftId,
      afterJson: { sessionId, territoryId, deviceId: input.deviceId, hasGeo: startGeo !== null },
    });

    // Real-time warehouse outbox: emit "session_start" in the SAME tenantTx as
    // the KnockSession insert so the event commits atomically with it.
    await emitAnalyticsEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      userId: actor.userId,
      eventType: 'session_start',
      entityType: 'KnockSession',
      entityId: sessionId,
      occurredAt: now,
      payload: { shiftId, territoryId },
    });
  });

  return { shiftId, sessionId };
}

/**
 * Clock out: flip the shift to `completed` and close the most recent OPEN
 * KnockSession for this rep on the shift's territory. There may legitimately be
 * no open session (clock-out without a prior clock-in) — that returns a null
 * sessionId rather than erroring, so the field flow is forgiving.
 */
export async function clockOut(
  shiftId: string,
  actor: ActorContext,
): Promise<{ shiftId: string; sessionId: string | null }> {
  const shift = await loadOwnedShift(shiftId, actor);

  return tenantTx(actor.orgId, async (tx) => {
    await tx.knockerShift.update({
      where: { id: shiftId },
      data: { status: 'completed' },
    });

    const open = await tx.knockSession.findFirst({
      where: {
        orgId: actor.orgId,
        userId: actor.userId,
        ...(shift.territoryId ? { territoryId: shift.territoryId } : {}),
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    // One `now` shared by the session's endedAt and the analytics occurredAt.
    const now = new Date();
    if (open) {
      await tx.knockSession.update({
        where: { id: open.id },
        data: { endedAt: now },
      });
    }

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'roster.clock_out',
      resourceType: 'KnockerShift',
      resourceId: shiftId,
      afterJson: { sessionId: open?.id ?? null, territoryId: shift.territoryId },
    });

    // Real-time warehouse outbox: emit "session_end" in the SAME tenantTx as the
    // session close, only when a session was actually closed (clock-out without a
    // prior clock-in legitimately closes nothing — no session entity to emit for).
    if (open) {
      await emitAnalyticsEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        userId: actor.userId,
        eventType: 'session_end',
        entityType: 'KnockSession',
        entityId: open.id,
        occurredAt: now,
        payload: { shiftId, sessionId: open.id },
      });
    }

    return { shiftId, sessionId: open?.id ?? null };
  });
}
