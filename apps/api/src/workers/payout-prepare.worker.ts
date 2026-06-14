/**
 * Payout preparation worker — automatically generates draft payout batches
 * on the 1st of each month for every org with a commission plan.
 *
 * THE PLATFORM NEVER AUTO-PAYS (ADR-0019).
 * The worker creates a DRAFT batch with a CSV instruction file uploaded to S3.
 * Brodie (or the org admin) reviews the batch and manually executes the
 * transfers in their bank portal. The batch moves from draft → instructed
 * only when the operator explicitly approves.
 *
 * Why monthly on the 1st?
 *   - The previous calendar month's commissions are fully settled by then.
 *   - Org admins receive the instruction file on the 1st, can review + pay
 *     on the 2nd–3rd business day.
 *   - Fortnightly orgs: a second run fires on the 15th using a 1–14 period.
 *     Current implementation covers monthly only; fortnightly can be added
 *     by checking `OrgBilling.payoutFrequency` once that field is added.
 *
 * CSV format (NACHA-compatible, US focus for Phase 1):
 *   userId, name, amountCents, currency, reference, periodStart, periodEnd
 *
 * Design:
 *   - Idempotent: checks for an existing non-archived batch for the same period
 *     before generating; skips if one already exists.
 *   - Per-org: iterates all orgs with ≥1 accrued commission in the period.
 *   - S3 upload: instruction file lands in S3_BUCKET_EXPORTS under
 *     `payouts/{orgId}/{year}/{month}/batch-{date}.csv`
 *   - Audit: records a `payout_prepare.batch_created` event per org.
 *
 * Export pattern: `startPayoutPrepareWorker()` — no top-level side-effects.
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Worker, Queue } from 'bullmq';
import { newId } from '@d2d/shared-utils';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { AuditService } from '../domains/audit/service';

const QUEUE_NAME = 'payout-prepare';

function priorMonthBounds(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const label = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { start, end, label };
}

type CommissionRow = {
  userId: string;
  _sum: { amountCents: bigint | null };
};

function buildCsv(
  lines: Array<{
    userId: string;
    givenName: string | null;
    familyName: string | null;
    totalCents: bigint;
    currency: string;
  }>,
  periodStart: Date,
  periodEnd: Date,
): string {
  const header = 'userId,name,amountCents,currency,reference,periodStart,periodEnd';
  const rows = lines.map((l) => {
    const name = [l.givenName, l.familyName].filter(Boolean).join(' ') || l.userId;
    const ref = `PAY-${l.userId.slice(-6).toUpperCase()}-${periodStart.toISOString().slice(0, 7)}`;
    return [
      l.userId,
      `"${name.replace(/"/g, '""')}"`,
      l.totalCents.toString(),
      l.currency,
      ref,
      periodStart.toISOString().slice(0, 10),
      periodEnd.toISOString().slice(0, 10),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

async function prepareMonthlyBatches(): Promise<void> {
  const log = logger().child({ worker: 'payout-prepare' });
  const { start, end, label } = priorMonthBounds();

  log.info(
    { periodStart: start.toISOString(), periodEnd: end.toISOString() },
    'payout-prepare: starting monthly run',
  );

  const e = env();
  const s3 = new S3Client({ region: e.AWS_REGION });

  // Find orgs that have at least one accrued commission in the period.
  const orgsWithCommissions = await prisma().commission.groupBy({
    by: ['orgId', 'currency'],
    where: {
      periodStart: { gte: start },
      periodEnd: { lte: end },
      status: { in: ['accrued', 'included'] },
    },
    _count: { id: true },
    having: { id: { _count: { gt: 0 } } },
  });

  let batchCount = 0;

  for (const { orgId, currency } of orgsWithCommissions) {
    try {
      // Idempotency: skip if a non-archived batch already exists for this period.
      const existing = await prisma().payoutBatch.findFirst({
        where: {
          orgId,
          periodStart: start,
          periodEnd: end,
          status: { not: 'archived' },
        },
        select: { id: true },
      });
      if (existing) {
        log.debug(
          { orgId, batchId: existing.id },
          'payout-prepare: batch already exists — skipping',
        );
        continue;
      }

      // Aggregate commissions per user.
      const byUser = (await prisma().commission.groupBy({
        by: ['userId'],
        where: {
          orgId,
          currency,
          periodStart: { gte: start },
          periodEnd: { lte: end },
          status: { in: ['accrued', 'included'] },
        },
        _sum: { amountCents: true },
      })) as unknown as CommissionRow[];

      if (byUser.length === 0) continue;

      const totalCents = byUser.reduce((acc, r) => acc + (r._sum.amountCents ?? 0n), 0n);

      // Load user display names.
      const userIds = byUser.map((r) => r.userId);
      const users = await prisma().user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, givenName: true, familyName: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const lines = byUser
        .filter((r) => (r._sum.amountCents ?? 0n) > 0n)
        .map((r) => ({
          userId: r.userId,
          givenName: userMap.get(r.userId)?.givenName ?? null,
          familyName: userMap.get(r.userId)?.familyName ?? null,
          totalCents: r._sum.amountCents ?? 0n,
          currency,
        }));

      if (lines.length === 0) continue;

      const csv = buildCsv(lines, start, end);
      const batchId = newId('pyb');
      const now = new Date();
      const s3Key = `payouts/${orgId}/${label}/batch-${batchId}.csv`;

      // Upload instruction file to S3.
      await s3.send(
        new PutObjectCommand({
          Bucket: e.S3_BUCKET_EXPORTS,
          Key: s3Key,
          Body: csv,
          ContentType: 'text/csv',
        }),
      );

      // Get org region for audit.
      const org = await prisma().org.findUnique({
        where: { id: orgId },
        select: { regionCode: true },
      });

      // Create the draft batch row.
      await prisma().$transaction(async (tx) => {
        await tx.payoutBatch.create({
          data: {
            id: batchId,
            orgId,
            regionCode: org?.regionCode ?? 'US',
            periodStart: start,
            periodEnd: end,
            status: 'draft',
            totalCents,
            currency,
            instructionFileKey: s3Key,
          },
        });

        // Mark included commissions as 'included' so they don't get double-counted.
        await tx.commission.updateMany({
          where: {
            orgId,
            currency,
            periodStart: { gte: start },
            periodEnd: { lte: end },
            status: 'accrued',
          },
          data: { status: 'included', payoutBatchId: batchId },
        });

        await AuditService.recordEvent(tx, {
          orgId,
          regionCode: org?.regionCode ?? 'US',
          actorUserId: null,
          action: 'payout_prepare.batch_created',
          resourceType: 'PayoutBatch',
          resourceId: batchId,
          afterJson: {
            periodLabel: label,
            totalCents: totalCents.toString(),
            currency,
            lineCount: lines.length,
            instructionFileKey: s3Key,
            createdAt: now.toISOString(),
          },
        });
      });

      log.info(
        { orgId, batchId, totalCents: totalCents.toString(), lineCount: lines.length },
        'payout-prepare: draft batch created',
      );
      batchCount++;
    } catch (err) {
      log.error({ orgId, err }, 'payout-prepare: error preparing batch for org');
    }
  }

  log.info({ batchCount, periodLabel: label }, 'payout-prepare: monthly run complete');
}

export function startPayoutPrepareWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  // Fire at 03:00 UTC on the 1st of each month.
  void queue.add(
    'prepare',
    {},
    {
      repeat: { pattern: '0 3 1 * *' },
      jobId: 'payout-prepare-monthly',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await prepareMonthlyBatches();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'payout-prepare: job failed');
  });
}
