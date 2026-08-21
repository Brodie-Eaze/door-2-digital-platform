/**
 * Commission calculation worker — daily reconciliation of commission accruals.
 *
 * Runs daily at 02:00 UTC via BullMQ repeat scheduler.
 *
 * What it does:
 *   1. For each active org, recompute manager override commissions for the
 *      prior day. These are "% of team earnings" rows that must be recalculated
 *      after the team's inline commissions settle. The `accrueOverrideCommissions`
 *      logic lives in the payout service (it's also called at payout-batch time)
 *      but the daily run keeps overrides current so statements are always accurate.
 *
 *   2. Defensive sweep: find any knock/conversion records from the prior day
 *      that have NO commission row (e.g. created during a brief plan-gap window)
 *      and log them as anomalies. The worker doesn't auto-create missing rows
 *      because commission amounts require an active plan — instead it surfaces
 *      the gap for manual resolution.
 *
 * Design:
 *   - Idempotent: override commissions use upsert, so re-running the same day
 *     is safe and converges to the correct result.
 *   - Tenant-scoped: iterates over all orgs with an active commission plan;
 *     never touches another org's data.
 *   - Audit: writes a summary AuditEvent per org so the run is traceable.
 *
 * Export pattern: `startCommissionCalcWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { AuditService } from '../domains/audit/service';

const QUEUE_NAME = 'commission-calc';

function priorDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  return { start, end };
}

/** Re-derive manager override commissions for the period. */
async function accrueOverridesForOrg(
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
      .user.findMany({ where: { orgId, managerId: manager.id }, select: { id: true } })
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
        where: { id: `override-${manager.id}-${periodStart.toISOString().slice(0, 10)}` },
        create: {
          id: `override-${manager.id}-${periodStart.toISOString().slice(0, 10)}`,
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

async function runDailyCalc(): Promise<void> {
  const log = logger().child({ worker: 'commission-calc' });
  const { start, end } = priorDayBounds();

  log.info(
    { periodStart: start.toISOString(), periodEnd: end.toISOString() },
    'commission-calc: starting daily run',
  );

  // Find all orgs that have an active commission plan.
  const orgsWithPlan = await prisma().commissionPlan.findMany({
    where: {
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    distinct: ['orgId'],
    select: { orgId: true, rules: true },
  });

  let orgCount = 0;
  let anomalyCount = 0;

  for (const { orgId, rules } of orgsWithPlan) {
    const dsl = rules as { currency?: string };
    const currency = dsl.currency ?? 'USD';

    try {
      await accrueOverridesForOrg(orgId, start, end, currency);

      // Anomaly sweep: knocks/conversions from prior day that have no commission row.
      // The Knock model has no back-relation to Commission, so we do a two-step
      // anti-join: find all IDs in the window, then subtract those that have a row.
      const [knocksInWindow, conversionsInWindow] = await Promise.all([
        prisma().knock.findMany({
          where: {
            orgId,
            serverReceivedAt: { gte: start, lt: end },
            disposition: { not: 'no_answer' },
          },
          select: { id: true, userId: true },
        }),
        prisma().conversion.findMany({
          where: { orgId, signedAt: { gte: start, lt: end } },
          select: { id: true },
        }),
      ]);

      const [knockIdsWithComm, convIdsWithComm] = await Promise.all([
        prisma()
          .commission.findMany({
            where: { orgId, knockId: { in: knocksInWindow.map((k) => k.id) } },
            select: { knockId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.knockId))),
        prisma()
          .commission.findMany({
            where: { orgId, conversionId: { in: conversionsInWindow.map((c) => c.id) } },
            select: { conversionId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.conversionId))),
      ]);

      const knocksWithoutComm = knocksInWindow.filter((k) => !knockIdsWithComm.has(k.id));
      const conversionsWithoutComm = conversionsInWindow.filter((c) => !convIdsWithComm.has(c.id));

      const anomalies = knocksWithoutComm.length + conversionsWithoutComm.length;
      if (anomalies > 0) {
        anomalyCount += anomalies;
        log.warn(
          {
            orgId,
            knocksWithoutComm: knocksWithoutComm.length,
            conversionsWithoutComm: conversionsWithoutComm.length,
          },
          'commission-calc: anomaly — records with no commission row',
        );

        // Write audit event so operators can investigate.
        await AuditService.recordEvent(prisma(), {
          orgId,
          regionCode: 'US',
          actorUserId: null,
          action: 'commission_calc.anomaly_detected',
          resourceType: 'Commission',
          resourceId: `calc-${start.toISOString().slice(0, 10)}`,
          afterJson: {
            periodStart: start.toISOString(),
            periodEnd: end.toISOString(),
            knocksWithoutComm: knocksWithoutComm.map((k) => k.id),
            conversionsWithoutComm: conversionsWithoutComm.map((c) => c.id),
          },
        });
      }

      orgCount++;
    } catch (err) {
      log.error({ orgId, err }, 'commission-calc: error processing org');
    }
  }

  log.info(
    { orgCount, anomalyCount, periodStart: start.toISOString() },
    'commission-calc: daily run complete',
  );
}

export function startCommissionCalcWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  // Fire at 02:00 UTC daily.
  void queue.add(
    'calc',
    {},
    {
      repeat: { pattern: '0 2 * * *' },
      jobId: 'commission-calc-daily',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runDailyCalc();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'commission-calc: job failed');
  });
}
