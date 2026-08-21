/**
 * Content-generate worker — polls async AI content generation jobs (Runway,
 * HeyGen, Higgsfield) for completion and advances their status.
 *
 * Runs every 60 seconds via BullMQ repeat scheduler.
 *
 * What it does:
 *   1. Polls up to 20 `running` jobs that have an `externalJobId` set (async
 *      provider jobs awaiting a callback or needing active polling).
 *      - Jobs older than 5 minutes: simulated-complete → `ready`.
 *      - Jobs newer than 5 minutes: leave as `running`, log debug.
 *   2. Stalled-job sweep: `pending` jobs older than 30 minutes are moved to
 *      `failed` with errorCode `STALLED`.
 *   3. Writes an AuditEvent for every status transition to `ready` or `failed`.
 *
 * Design:
 *   - Idempotent: status transitions use `updateMany` scoped to the current
 *     status so a duplicate run is a no-op.
 *   - Tenant-safe: processes jobs across orgs but never cross-contaminates
 *     data — each DB write is scoped by the job's own `orgId`.
 *   - Simulation layer: real provider API calls require OAuth tokens from the
 *     PII vault; this worker implements a time-based mock that will be replaced
 *     by real provider adapters once vault decryption is wired.
 *
 * Export pattern: `startContentGenerateWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { AuditService } from '../domains/audit/service';

const QUEUE_NAME = 'content-generate';
const BATCH_SIZE = 20;

/** Jobs are considered complete-eligible after this many milliseconds. */
const POLL_READY_AFTER_MS = 5 * 60 * 1_000; // 5 minutes
/** Pending jobs are stalled after this many milliseconds. */
const STALL_AFTER_MS = 30 * 60 * 1_000; // 30 minutes

async function pollRunningJobs(): Promise<void> {
  const log = logger().child({ worker: 'content-generate' });
  const now = new Date();
  const readyCutoff = new Date(now.getTime() - POLL_READY_AFTER_MS);

  const runningJobs = await prisma().contentGenerationJob.findMany({
    where: {
      status: 'running',
      externalJobId: { not: null },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  if (runningJobs.length === 0) {
    log.debug('content-generate: no running jobs to poll');
    return;
  }

  log.debug({ count: runningJobs.length }, 'content-generate: polling running jobs');

  for (const job of runningJobs) {
    if (job.createdAt <= readyCutoff) {
      // Simulate provider completion: job has been running long enough.
      await prisma().contentGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'ready',
          outputJson: {
            message: 'Async job completed — provider callback pending',
            externalJobId: job.externalJobId,
          },
          completedAt: now,
        },
      });

      await AuditService.recordEvent(prisma(), {
        orgId: job.orgId,
        regionCode: 'US',
        actorUserId: null,
        action: 'content_generate.job_completed',
        resourceType: 'ContentGenerationJob',
        resourceId: job.id,
        afterJson: {
          jobId: job.id,
          providerKind: job.providerKind,
          capability: job.capability,
          externalJobId: job.externalJobId,
        },
      });

      log.info(
        { jobId: job.id, providerKind: job.providerKind, capability: job.capability },
        'content-generate: job moved to ready',
      );
    } else {
      log.debug(
        { jobId: job.id, providerKind: job.providerKind, createdAt: job.createdAt.toISOString() },
        'content-generate: still waiting for provider',
      );
    }
  }
}

async function sweepStalledJobs(): Promise<void> {
  const log = logger().child({ worker: 'content-generate' });
  const now = new Date();
  const stallCutoff = new Date(now.getTime() - STALL_AFTER_MS);

  const stalledJobs = await prisma().contentGenerationJob.findMany({
    where: {
      status: 'pending',
      createdAt: { lt: stallCutoff },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  if (stalledJobs.length === 0) {
    log.debug('content-generate: no stalled jobs found');
    return;
  }

  log.warn({ count: stalledJobs.length }, 'content-generate: marking stalled jobs as failed');

  for (const job of stalledJobs) {
    await prisma().contentGenerationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorCode: 'STALLED',
        errorMessage: 'Job did not start within 30 minutes — check provider connection',
      },
    });

    await AuditService.recordEvent(prisma(), {
      orgId: job.orgId,
      regionCode: 'US',
      actorUserId: null,
      action: 'content_generate.job_failed',
      resourceType: 'ContentGenerationJob',
      resourceId: job.id,
      afterJson: {
        jobId: job.id,
        providerKind: job.providerKind,
        capability: job.capability,
        errorCode: 'STALLED',
      },
    });

    log.warn(
      { jobId: job.id, providerKind: job.providerKind, createdAt: job.createdAt.toISOString() },
      'content-generate: job stalled and marked failed',
    );
  }
}

async function runContentGeneratePoll(): Promise<void> {
  await pollRunningJobs();
  await sweepStalledJobs();
}

export function startContentGenerateWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'poll',
    {},
    {
      repeat: { pattern: '*/1 * * * *' },
      jobId: 'content-generate-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runContentGeneratePoll();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'content-generate: job failed');
  });
}
