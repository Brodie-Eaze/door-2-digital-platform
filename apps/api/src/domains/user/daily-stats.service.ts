/**
 * Daily-stats service — read model for the native Knocker "Me" screen.
 *
 * Surfaces a knocker's today-so-far activity (knocks, conversions, commission,
 * revenue) plus an in-org leaderboard. All figures are queried live from
 * Postgres for the caller's org — never mocked. A field that has no source
 * table returns an honest zero, not a fabricated number.
 *
 * "Today" is the UTC calendar day. The native app renders in the user's TZ;
 * a UTC boundary keeps the leaderboard a single consistent window across a
 * distributed field team rather than per-device-local windows that wouldn't
 * be comparable. Revisit if charities demand a campaign-local cutover.
 */
import type { RegionCode } from '@prisma/client';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
  /** The actor's own role — gates reading another user's stats. */
  role: string;
}

/** Roles permitted to read *another* user's daily stats within the org. */
const STATS_ADMIN_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

export interface LeaderboardEntry {
  userId: string;
  name: string;
  knocks: number;
  conversions: number;
  isYou: boolean;
}

export interface DailyStats {
  knocksToday: number;
  conversionsToday: number;
  commissionCentsToday: number;
  revenueCentsToday: number | null;
  knocksYesterday: number | null;
  leaderboardRank: number | null;
  leaderboard: LeaderboardEntry[] | null;
}

const LEADERBOARD_SIZE = 10;

/** Start of the current/previous UTC calendar day. */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * In-org leaderboard name. Mirrors the staff-directory read boundary
 * (user/service.ts): full given name + family initial. Identifiable enough
 * for an in-org board without emitting a full surname; full PII still requires
 * an audited pii-vault unmask grant.
 */
function leaderboardName(givenName: string, familyName: string): string {
  return familyName ? `${givenName} ${familyName.charAt(0)}.` : givenName;
}

export async function getDailyStats(
  targetUserId: string,
  actor: ActorContext,
): Promise<DailyStats> {
  // The caller may only read their OWN stats unless they hold an admin role.
  if (targetUserId !== actor.userId && !STATS_ADMIN_ROLES.has(actor.role)) {
    throw new ProblemError(Problems.forbidden('You may only read your own daily stats'));
  }

  const db = prisma();

  // Confirm the target lives in the caller's org (and exists). Scoped read so a
  // cross-tenant userId can't probe another org's activity.
  const target = await db.user.findFirst({
    where: { id: targetUserId, orgId: actor.orgId },
    select: { id: true },
  });
  if (!target) throw new ProblemError(Problems.notFound('User', targetUserId));

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // Per-user today counters + yesterday knocks, queried live for the org.
  const [knocksToday, conversionsToday, knocksYesterday, commissionAgg, revenueAgg] =
    await Promise.all([
      db.knock.count({
        where: { orgId: actor.orgId, userId: targetUserId, capturedAt: { gte: todayStart } },
      }),
      db.conversion.count({
        where: { orgId: actor.orgId, knockerId: targetUserId, signedAt: { gte: todayStart } },
      }),
      db.knock.count({
        where: {
          orgId: actor.orgId,
          userId: targetUserId,
          capturedAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
      // Commission accrues asynchronously (per-conversion plan) — there may be
      // no rows yet for today; SUM over an empty set yields null → coerce to 0.
      db.commission.aggregate({
        where: { orgId: actor.orgId, userId: targetUserId, periodStart: { gte: todayStart } },
        _sum: { amountCents: true },
      }),
      db.conversion.aggregate({
        where: { orgId: actor.orgId, knockerId: targetUserId, signedAt: { gte: todayStart } },
        _sum: { amountCents: true },
      }),
    ]);

  // Money is BigInt cents in the DB; the iOS DTO expects Int cents.
  const commissionCentsToday = Number(commissionAgg._sum.amountCents ?? 0n);
  const revenueCentsToday = Number(revenueAgg._sum.amountCents ?? 0n);

  // Org leaderboard by conversionsToday. Conversions carry the door
  // attribution on `knockerId`, so the board credits the knocker. We build it
  // from today's conversions then hydrate knock counts + names per ranked user.
  const convByKnocker = await db.conversion.groupBy({
    by: ['knockerId'],
    where: { orgId: actor.orgId, signedAt: { gte: todayStart }, knockerId: { not: null } },
    _count: { _all: true },
  });

  const rankedUserIds = convByKnocker
    .filter((g): g is typeof g & { knockerId: string } => g.knockerId !== null)
    .map((g) => ({ userId: g.knockerId, conversions: g._count._all }))
    .sort((a, b) => b.conversions - a.conversions);

  // 1-based rank of the target within the org by conversionsToday. Absent from
  // the board (zero conversions today) → null, matching the optional DTO field.
  const rankIdx = rankedUserIds.findIndex((r) => r.userId === targetUserId);
  const leaderboardRank = rankIdx === -1 ? null : rankIdx + 1;

  const topIds = rankedUserIds.slice(0, LEADERBOARD_SIZE).map((r) => r.userId);
  let leaderboard: LeaderboardEntry[] | null = null;
  if (topIds.length > 0) {
    const [users, knocksByUser] = await Promise.all([
      db.user.findMany({
        where: { orgId: actor.orgId, id: { in: topIds } },
        select: { id: true, givenName: true, familyName: true },
      }),
      db.knock.groupBy({
        by: ['userId'],
        where: { orgId: actor.orgId, userId: { in: topIds }, capturedAt: { gte: todayStart } },
        _count: { _all: true },
      }),
    ]);
    const nameById = new Map(users.map((u) => [u.id, leaderboardName(u.givenName, u.familyName)]));
    const knocksById = new Map(knocksByUser.map((k) => [k.userId, k._count._all]));
    leaderboard = rankedUserIds.slice(0, LEADERBOARD_SIZE).map((r) => ({
      userId: r.userId,
      name: nameById.get(r.userId) ?? '',
      knocks: knocksById.get(r.userId) ?? 0,
      conversions: r.conversions,
      isYou: r.userId === targetUserId,
    }));
  }

  return {
    knocksToday,
    conversionsToday,
    commissionCentsToday,
    revenueCentsToday,
    knocksYesterday,
    leaderboardRank,
    leaderboard,
  };
}
