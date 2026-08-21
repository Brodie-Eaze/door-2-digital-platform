/**
 * Knock-sync worker — deferred batch reconciliation of offline knock uploads.
 *
 * Queue name: `knock-sync`
 * Cron repeat: every 60 seconds (`* * * * *`) — catches any jobs the mobile
 * app enqueued while the worker was briefly offline.
 *
 * Job payload: `{ orgId: string; batchId: string; knockIds: string[] }`
 *
 * What it does:
 *   1. Loads all Knock rows for the batch (up to 200; extras warned + skipped).
 *   2. For each knock with disposition `callback` or `appointment` that has no
 *      linked Lead yet, creates a Lead row (status=new, vertical from the org).
 *   3. Writes a `knock_sync.batch_reconciled` AuditEvent with counts.
 *
 * Idempotency: skips lead creation if `knock.leadId IS NOT NULL` even when
 * disposition warrants it — the lead already exists from a prior run.
 *
 * Export pattern: `startKnockSyncWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { newId } from '@d2d/shared-utils';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { AuditService } from '../domains/audit/service';

const QUEUE_NAME = 'knock-sync';
const MAX_KNOCKS_PER_JOB = 200;

/** Dispositions that trigger Lead creation. */
const LEAD_DISPOSITIONS = new Set(['callback', 'appointment']);

export interface KnockSyncJobPayload {
  orgId: string;
  batchId: string;
  knockIds: string[];
}

async function processBatch(payload: KnockSyncJobPayload): Promise<void> {
  const log = logger().child({
    worker: 'knock-sync',
    orgId: payload.orgId,
    batchId: payload.batchId,
  });

  let ids = payload.knockIds;
  if (ids.length > MAX_KNOCKS_PER_JOB) {
    log.warn(
      { total: ids.length, cap: MAX_KNOCKS_PER_JOB },
      'knock-sync: knockIds exceeds cap — processing first 200 only',
    );
    ids = ids.slice(0, MAX_KNOCKS_PER_JOB);
  }

  // Load knock rows that belong to this batch + org.
  const knocks = await prisma().knock.findMany({
    where: {
      orgId: payload.orgId,
      syncBatchId: payload.batchId,
      id: { in: ids },
    },
    select: {
      id: true,
      orgId: true,
      regionCode: true,
      addressId: true,
      disposition: true,
      leadId: true,
      userId: true,
    },
  });

  if (knocks.length === 0) {
    log.info('knock-sync: no knocks found for batch — nothing to do');
    return;
  }

  // Fetch the org to get vertical for Lead creation.
  const org = await prisma().org.findUnique({
    where: { id: payload.orgId },
    select: { vertical: true, regionCode: true },
  });

  if (!org) {
    log.warn({ orgId: payload.orgId }, 'knock-sync: org not found — aborting batch');
    return;
  }

  let processed = 0;
  let leadsCreated = 0;

  for (const knock of knocks) {
    processed++;

    // Skip if disposition doesn't warrant lead creation.
    if (!LEAD_DISPOSITIONS.has(knock.disposition)) {
      continue;
    }

    // Idempotency: skip if a lead was already created in a prior run.
    if (knock.leadId !== null) {
      continue;
    }

    // Create the lead and link it back to the knock in one transaction.
    const leadId = newId('lead');

    await prisma().$transaction(async (tx) => {
      await tx.lead.create({
        data: {
          id: leadId,
          orgId: knock.orgId,
          regionCode: knock.regionCode,
          status: 'new',
          vertical: org.vertical,
          sourceKnockId: knock.id,
          addressId: knock.addressId ?? null,
          // Placeholder PII — the inside-sales team enriches via CRM after routing.
          givenName: '',
          familyName: '',
        },
      });

      await tx.knock.update({
        where: { id: knock.id },
        data: { leadId },
      });
    });

    leadsCreated++;
    log.debug(
      { knockId: knock.id, leadId, disposition: knock.disposition },
      'knock-sync: lead created',
    );
  }

  // Audit event — use prisma() directly (outside tx) as the audit service
  // takes a TransactionClient; pass the raw client here.
  await prisma().$transaction(async (tx) => {
    await AuditService.recordEvent(tx, {
      orgId: payload.orgId,
      regionCode: org.regionCode,
      actorUserId: null,
      action: 'knock_sync.batch_reconciled',
      resourceType: 'Knock',
      resourceId: payload.batchId,
      afterJson: {
        batchId: payload.batchId,
        processed,
        leadsCreated,
        knockCount: knocks.length,
      },
    });
  });

  log.info({ batchId: payload.batchId, processed, leadsCreated }, 'knock-sync: batch reconciled');
}

export function startKnockSyncWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  // Cron: every minute. Picks up any enqueued batch jobs.
  void queue.add(
    'reconcile',
    {},
    {
      repeat: { pattern: '*/1 * * * *' },
      jobId: 'knock-sync-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // The cron tick carries no payload — skip gracefully.
      const payload = job.data as Partial<KnockSyncJobPayload>;
      if (!payload.orgId || !payload.batchId || !Array.isArray(payload.knockIds)) {
        logger()
          .child({ worker: 'knock-sync' })
          .debug({ jobId: job.id }, 'knock-sync: cron tick — no payload, skipping');
        return;
      }
      await processBatch(payload as KnockSyncJobPayload);
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, data: job?.data, err }, 'knock-sync: job failed');
  });
}
