/**
 * Commission service — Phase 1.3 real.
 *
 * CommissionPlan.rules is a JSON DSL (v0.1):
 * {
 *   version: 'v0.1',
 *   currency: 'USD',
 *   rules: [
 *     { type: 'per_knock', amountCents: 100 },              // $1 per knock
 *     { type: 'per_conversion', amountCents: 5000 },        // $50 per conversion
 *     { type: 'per_conversion', percent: 3,                 // OR 3% of conversion amount
 *       conversionTypes: ['donation_recurring'] },           // optional filter
 *     { type: 'override', percent: 5 }                      // crew-lead: 5% of team commissions
 *   ]
 * }
 *
 * Accrual is inline (not a daily worker) for Phase 1.3. This makes the
 * Commission row immediately accurate and keeps the DB as the source of truth
 * for every Commissions screen and PayoutBatch generation.
 *
 * Override commissions (crew-leader earning on their team) are computed at
 * payout-batch generation time rather than inline, because they require the
 * full period's team earnings to be final.
 */
import { Prisma } from '@prisma/client';
import type { RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import type { ListCommissionsQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

// ── DSL types ──────────────────────────────────────────────────────────────

interface CommissionRule {
  type: 'per_knock' | 'per_conversion' | 'per_appointment' | 'override';
  amountCents?: number;
  percent?: number;
  conversionTypes?: string[];
}

interface CommissionRulesDSL {
  version: 'v0.1';
  currency: string;
  rules: CommissionRule[];
}

// ── Public shape ──────────────────────────────────────────────────────────

export interface CommissionPublic {
  id: string;
  orgId: string;
  userId: string;
  planId: string;
  type: string;
  conversionId: string | null;
  knockId: string | null;
  amountCents: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  payoutBatchId: string | null;
  status: string;
}

function toPublic(row: {
  id: string;
  orgId: string;
  userId: string;
  planId: string;
  type: string;
  conversionId: string | null;
  knockId: string | null;
  amountCents: bigint;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  payoutBatchId: string | null;
  status: string;
}): CommissionPublic {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    planId: row.planId,
    type: row.type,
    conversionId: row.conversionId,
    knockId: row.knockId,
    amountCents: row.amountCents.toString(),
    currency: row.currency,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    payoutBatchId: row.payoutBatchId,
    status: row.status,
  };
}

function currentPeriodBounds(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}

// ── Accrual helpers ────────────────────────────────────────────────────────

/**
 * Load the active commission plan for a given org + userId, or null if none.
 * Plans are matched by org; the user inherits their org's active plan.
 */
async function loadActivePlan(orgId: string): Promise<{
  id: string;
  rules: Prisma.JsonValue;
  currency: string;
} | null> {
  const now = new Date();
  const plan = await prisma().commissionPlan.findFirst({
    where: {
      orgId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { id: true, rules: true },
  });
  if (!plan) return null;
  const dsl = plan.rules as unknown as CommissionRulesDSL;
  return { id: plan.id, rules: plan.rules, currency: dsl.currency ?? 'USD' };
}

/**
 * Accrue per_knock commission inline when a knock is created.
 * Call from within the knock TX (pass `tx`).
 */
export async function accrueKnockCommission(
  opts: {
    orgId: string;
    userId: string;
    knockId: string;
  },
  tx: Prisma.TransactionClient,
): Promise<void> {
  const plan = await tx.commissionPlan.findFirst({
    where: {
      orgId: opts.orgId,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { id: true, rules: true },
  });
  if (!plan) return;

  const dsl = plan.rules as unknown as CommissionRulesDSL;
  const rules = dsl.rules ?? [];
  const knockRules = rules.filter((r) => r.type === 'per_knock' && r.amountCents);
  if (knockRules.length === 0) return;

  const { periodStart, periodEnd } = currentPeriodBounds();
  for (const rule of knockRules) {
    await tx.commission.create({
      data: {
        id: newId('com'),
        orgId: opts.orgId,
        userId: opts.userId,
        planId: plan.id,
        type: 'per_knock',
        knockId: opts.knockId,
        amountCents: BigInt(rule.amountCents ?? 0),
        currency: dsl.currency ?? 'USD',
        periodStart,
        periodEnd,
        status: 'accrued',
      },
    });
  }
}

/**
 * Accrue per_conversion commission inline when a conversion is finalised.
 * Call from within the conversion TX (pass `tx`).
 */
export async function accrueConversionCommission(
  opts: {
    orgId: string;
    userId: string;
    conversionId: string;
    conversionType: string;
    amountCents: bigint;
  },
  tx: Prisma.TransactionClient,
): Promise<void> {
  const plan = await tx.commissionPlan.findFirst({
    where: {
      orgId: opts.orgId,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { id: true, rules: true },
  });
  if (!plan) return;

  const dsl = plan.rules as unknown as CommissionRulesDSL;
  const rules = dsl.rules ?? [];
  const convRules = rules.filter(
    (r) =>
      r.type === 'per_conversion' &&
      (r.conversionTypes == null || r.conversionTypes.includes(opts.conversionType)),
  );
  if (convRules.length === 0) return;

  const { periodStart, periodEnd } = currentPeriodBounds();
  for (const rule of convRules) {
    let amountCents = 0n;
    if (rule.amountCents) {
      amountCents = BigInt(rule.amountCents);
    } else if (rule.percent) {
      amountCents = (opts.amountCents * BigInt(Math.round(rule.percent * 10))) / 1000n;
    }
    if (amountCents === 0n) continue;

    await tx.commission.create({
      data: {
        id: newId('com'),
        orgId: opts.orgId,
        userId: opts.userId,
        planId: plan.id,
        type: 'per_conversion',
        conversionId: opts.conversionId,
        amountCents,
        currency: dsl.currency ?? 'USD',
        periodStart,
        periodEnd,
        status: 'accrued',
      },
    });
  }
}

// ── Read API ───────────────────────────────────────────────────────────────

export async function listCommissions(
  query: ListCommissionsQuery,
  actor: ActorContext,
): Promise<{
  commissions: CommissionPublic[];
  nextCursor: string | null;
  totalCents: string;
}> {
  const limit = query.limit ?? 50;
  const where: Prisma.CommissionWhereInput = {
    orgId: actor.orgId,
    ...(query.userId && { userId: query.userId }),
    ...(query.status && { status: query.status }),
    ...(query.payoutBatchId && { payoutBatchId: query.payoutBatchId }),
    ...(query.from && { periodStart: { gte: new Date(query.from) } }),
    ...(query.to && { periodEnd: { lte: new Date(query.to) } }),
    ...(query.cursor && { id: { lt: query.cursor } }),
  };

  const [rows, agg] = await Promise.all([
    prisma().commission.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
    }),
    prisma().commission.aggregate({
      where: { ...where, id: undefined },
      _sum: { amountCents: true },
    }),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    commissions: page.map(toPublic),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    totalCents: (agg._sum.amountCents ?? 0n).toString(),
  };
}

export async function getCommission(id: string, actor: ActorContext): Promise<CommissionPublic> {
  const row = await prisma().commission.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('Commission', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(row.orgId));
  return toPublic(row);
}

export async function getProjection(actor: ActorContext): Promise<{
  periodStart: string;
  periodEnd: string;
  accruedCents: string;
  projectedCents: string;
  currency: string;
}> {
  const { periodStart, periodEnd } = currentPeriodBounds();
  const now = new Date();
  const elapsedMs = now.getTime() - periodStart.getTime();
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const elapsedFraction = Math.min(1, elapsedMs / totalMs);

  const [agg, plan] = await Promise.all([
    prisma().commission.aggregate({
      where: { orgId: actor.orgId, status: 'accrued', periodStart: { gte: periodStart } },
      _sum: { amountCents: true },
    }),
    loadActivePlan(actor.orgId),
  ]);

  const accrued = agg._sum.amountCents ?? 0n;
  const projected =
    elapsedFraction > 0 ? BigInt(Math.round(Number(accrued) / elapsedFraction)) : accrued;

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    accruedCents: accrued.toString(),
    projectedCents: projected.toString(),
    currency: plan?.currency ?? 'USD',
  };
}

export async function adjustCommission(
  id: string,
  adjustment: { amountCents: bigint; reason: string },
  actor: ActorContext,
): Promise<CommissionPublic> {
  const row = await prisma().commission.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('Commission', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(row.orgId));
  if (row.status !== 'accrued') {
    throw new ProblemError(Problems.conflict(`Commission ${id} is ${row.status} — cannot adjust`));
  }

  const updated = await prisma().commission.update({
    where: { id },
    data: { amountCents: adjustment.amountCents },
  });
  return toPublic(updated);
}
