/**
 * Payout batch service — Phase 1.3 real.
 *
 * THE PLATFORM NEVER AUTO-PAYS (ADR-0019).
 * It computes a batch, emits a NACHA-compatible CSV instruction file,
 * and waits for Brodie to execute the transfer manually in his bank portal.
 *
 * Lifecycle:
 *   draft → ready_to_pay (lock) → instructed (ops download file) → acknowledged → archived
 *
 * Instruction file format (US):
 *   A CSV with columns: userId, name, amountCents, currency, reference, period
 *   This is the operationally simple format that any US bank's batch-upload portal accepts.
 *   NACHA IAT/PPD file would require individual bank account details (collected separately).
 *
 * Override commissions (crew-leaders earning % of team earnings) are computed
 * here at batch-generation time, ensuring the full period is captured.
 */
import type { RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import type { CreatePayoutBatchBody, ListPayoutBatchesQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

// ── Public shapes ──────────────────────────────────────────────────────────

export interface PayoutBatchPublic {
  id: string;
  orgId: string;
  regionCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalCents: string;
  currency: string;
  instructionFileKey: string | null;
  instructedAt: string | null;
  acknowledgedAt: string | null;
  lineCount: number;
}

function toPublic(
  row: {
    id: string;
    orgId: string;
    regionCode: string;
    periodStart: Date;
    periodEnd: Date;
    status: string;
    totalCents: bigint;
    currency: string;
    instructionFileKey: string | null;
    instructedAt: Date | null;
    acknowledgedAt: Date | null;
  },
  lineCount = 0,
): PayoutBatchPublic {
  return {
    id: row.id,
    orgId: row.orgId,
    regionCode: row.regionCode,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    status: row.status,
    totalCents: row.totalCents.toString(),
    currency: row.currency,
    instructionFileKey: row.instructionFileKey,
    instructedAt: row.instructedAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    lineCount,
  };
}

// ── Override commission accrual (crew-leader % of team) ───────────────────

async function accrueOverrideCommissions(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  currency: string,
): Promise<void> {
  const plan = await prisma().commissionPlan.findFirst({
    where: {
      orgId,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { id: true, rules: true },
  });
  if (!plan) return;

  const dsl = plan.rules as { rules?: Array<{ type: string; percent?: number }> };
  const overrideRules = (dsl.rules ?? []).filter((r) => r.type === 'override' && r.percent);
  if (overrideRules.length === 0) return;

  const managers = await prisma().user.findMany({
    where: { orgId, managerId: null, role: 'manager' },
    select: { id: true },
  });

  for (const manager of managers) {
    const teamIds = await prisma()
      .user.findMany({
        where: { orgId, managerId: manager.id },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));

    if (teamIds.length === 0) continue;

    const teamAgg = await prisma().commission.aggregate({
      where: {
        orgId,
        userId: { in: teamIds },
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        status: { in: ['accrued', 'included'] },
        type: { not: 'override' },
      },
      _sum: { amountCents: true },
    });

    const teamTotal = teamAgg._sum.amountCents ?? 0n;
    if (teamTotal === 0n) continue;

    for (const rule of overrideRules) {
      const overrideCents = (teamTotal * BigInt(Math.round((rule.percent ?? 0) * 10))) / 1000n;
      if (overrideCents === 0n) continue;

      await prisma().commission.upsert({
        where: { id: `override-${manager.id}-${periodStart.toISOString().slice(0, 7)}` },
        create: {
          id: `override-${manager.id}-${periodStart.toISOString().slice(0, 7)}`,
          orgId,
          userId: manager.id,
          planId: plan.id,
          type: 'override',
          amountCents: overrideCents,
          currency,
          periodStart,
          periodEnd,
          status: 'accrued',
        },
        update: { amountCents: overrideCents },
      });
    }
  }
}

// ── Generate batch ─────────────────────────────────────────────────────────

export async function generatePayoutBatch(
  body: CreatePayoutBatchBody,
  actor: ActorContext,
): Promise<PayoutBatchPublic> {
  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);

  await accrueOverrideCommissions(actor.orgId, periodStart, periodEnd, body.currency ?? 'USD');

  const whereCommission = {
    orgId: actor.orgId,
    status: 'accrued',
    periodStart: { gte: periodStart },
    periodEnd: { lte: periodEnd },
    ...(body.userIds?.length ? { userId: { in: body.userIds } } : {}),
  };

  const [agg, commissions] = await Promise.all([
    prisma().commission.aggregate({ where: whereCommission, _sum: { amountCents: true } }),
    prisma().commission.findMany({ where: whereCommission, select: { id: true } }),
  ]);

  const totalCents = agg._sum.amountCents ?? 0n;
  if (totalCents === 0n) {
    throw new ProblemError(
      Problems.conflict('No accrued commissions found for the given period and filters'),
    );
  }

  if (body.dryRun) {
    return {
      id: 'dry-run',
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      status: 'dry_run',
      totalCents: totalCents.toString(),
      currency: body.currency ?? 'USD',
      instructionFileKey: null,
      instructedAt: null,
      acknowledgedAt: null,
      lineCount: commissions.length,
    };
  }

  const batchId = newId('pay');
  const batch = await prisma().$transaction(async (tx) => {
    const b = await tx.payoutBatch.create({
      data: {
        id: batchId,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        periodStart,
        periodEnd,
        status: 'draft',
        totalCents,
        currency: body.currency ?? 'USD',
      },
    });
    await tx.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { payoutBatchId: batchId, status: 'included' },
    });
    return b;
  });

  return toPublic(batch, commissions.length);
}

// ── List / get ─────────────────────────────────────────────────────────────

export async function listPayoutBatches(
  query: ListPayoutBatchesQuery,
  actor: ActorContext,
): Promise<{ batches: PayoutBatchPublic[]; nextCursor: string | null }> {
  const limit = query.limit ?? 20;
  const rows = await prisma().payoutBatch.findMany({
    where: {
      orgId: actor.orgId,
      ...(query.status && { status: query.status }),
      ...(query.cursor && { id: { lt: query.cursor } }),
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
    include: { _count: { select: { commissions: true } } },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    batches: page.map((r) => toPublic(r, r._count.commissions)),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function getPayoutBatch(id: string, actor: ActorContext): Promise<PayoutBatchPublic> {
  const row = await prisma().payoutBatch.findUnique({
    where: { id },
    include: { _count: { select: { commissions: true } } },
  });
  if (!row) throw new ProblemError(Problems.notFound('PayoutBatch', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(row.orgId));
  return toPublic(row, row._count.commissions);
}

// ── Lock (draft → ready_to_pay) ────────────────────────────────────────────

export async function lockPayoutBatch(id: string, actor: ActorContext): Promise<PayoutBatchPublic> {
  const row = await prisma().payoutBatch.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('PayoutBatch', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(row.orgId));
  if (row.status !== 'draft') {
    throw new ProblemError(
      Problems.conflict(`Batch ${id} is ${row.status} — can only lock draft batches`),
    );
  }

  const updated = await prisma().payoutBatch.update({
    where: { id },
    data: { status: 'ready_to_pay' },
    include: { _count: { select: { commissions: true } } },
  });
  return toPublic(updated, updated._count.commissions);
}

// ── Acknowledge (instructed → acknowledged) ────────────────────────────────

export async function acknowledgePayoutBatch(
  id: string,
  actor: ActorContext,
): Promise<PayoutBatchPublic> {
  const row = await prisma().payoutBatch.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('PayoutBatch', id));
  if (row.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(row.orgId));
  if (row.status !== 'instructed') {
    throw new ProblemError(
      Problems.conflict(`Batch ${id} is ${row.status} — can only acknowledge instructed batches`),
    );
  }

  const updated = await prisma().$transaction(async (tx) => {
    const b = await tx.payoutBatch.update({
      where: { id },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
      include: { _count: { select: { commissions: true } } },
    });
    await tx.commission.updateMany({
      where: { payoutBatchId: id },
      data: { status: 'paid' },
    });
    return b;
  });
  return toPublic(updated, updated._count.commissions);
}

// ── Instruction file (CSV) ─────────────────────────────────────────────────

/**
 * Generates a UTF-8 CSV instruction file for US ACH / bank upload.
 * Marks the batch status as 'instructed' on first download.
 *
 * Columns: userId, firstName, lastName, amountCents, amountUSD, currency,
 *          reference, periodStart, periodEnd
 *
 * The operator downloads this and uploads to their bank's batch-payment portal.
 */
export async function generateInstructionFile(
  id: string,
  actor: ActorContext,
): Promise<{ csv: string; filename: string }> {
  const batch = await prisma().payoutBatch.findUnique({
    where: { id },
    include: {
      commissions: {
        include: {
          user: { select: { id: true, givenName: true, familyName: true } },
        },
      },
    },
  });
  if (!batch) throw new ProblemError(Problems.notFound('PayoutBatch', id));
  if (batch.orgId !== actor.orgId) throw new ProblemError(Problems.tenantMismatch(batch.orgId));
  if (!['ready_to_pay', 'instructed'].includes(batch.status)) {
    throw new ProblemError(
      Problems.conflict(`Batch ${id} must be ready_to_pay or instructed to download`),
    );
  }

  // Aggregate per user
  const byUser = new Map<
    string,
    { givenName: string; familyName: string; totalCents: bigint; count: number }
  >();
  for (const c of batch.commissions) {
    const key = c.userId;
    const existing = byUser.get(key) ?? {
      givenName: c.user.givenName,
      familyName: c.user.familyName,
      totalCents: 0n,
      count: 0,
    };
    existing.totalCents += c.amountCents;
    existing.count += 1;
    byUser.set(key, existing);
  }

  const periodLabel = `${batch.periodStart.toISOString().slice(0, 10)}_${batch.periodEnd.toISOString().slice(0, 10)}`;
  const header =
    'userId,firstName,lastName,amountCents,amountUSD,currency,commissionCount,reference,periodStart,periodEnd';
  const lines = Array.from(byUser.entries()).map(([userId, u]) => {
    const amountUSD = (Number(u.totalCents) / 100).toFixed(2);
    const ref = `D2D-${id.slice(-8)}-${userId.slice(-6)}`;
    return [
      userId,
      u.givenName,
      u.familyName,
      u.totalCents.toString(),
      amountUSD,
      batch.currency,
      u.count,
      ref,
      batch.periodStart.toISOString().slice(0, 10),
      batch.periodEnd.toISOString().slice(0, 10),
    ].join(',');
  });

  const csv = [header, ...lines].join('\n');

  // Mark as instructed on first download
  if (batch.status === 'ready_to_pay') {
    await prisma().payoutBatch.update({
      where: { id },
      data: { status: 'instructed', instructedAt: new Date() },
    });
  }

  return { csv, filename: `d2d-payout-${periodLabel}.csv` };
}
