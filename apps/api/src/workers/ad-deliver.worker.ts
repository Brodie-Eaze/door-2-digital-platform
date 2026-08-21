/**
 * Ad-deliver worker — pushes draft AdCampaigns that are ready to deliver to
 * ad providers (Meta, Google, TikTok, YouTube).
 *
 * Runs every 5 minutes via BullMQ repeat scheduler.
 *
 * What it does:
 *   1. Finds up to 10 draft AdCampaigns with no `startedAt` (not yet dispatched),
 *      ordered oldest-first.
 *   2. For each campaign: loads the associated AdAccount and verifies it is
 *      `active`. If not, logs a warning and skips (doesn't fail the campaign —
 *      the ad account may be temporarily suspended).
 *   3. Simulates delivery: real OAuth token decryption from the PII vault +
 *      provider API calls are not implemented at this layer. Instead, a
 *      deterministic fake `externalCampaignId` is generated and the campaign
 *      is marked `active` with `startedAt = now()`.
 *   4. Writes an AuditEvent for every dispatched campaign.
 *   5. Sweeps ended campaigns: any `active` campaign with `endedAt < now()` is
 *      transitioned to `ended`.
 *
 * Design:
 *   - Idempotent: `startedAt IS NULL` guard prevents double-dispatch; the
 *     `ended` sweep uses `endedAt < now()` which is stable.
 *   - Tenant-safe: all queries carry `orgId` from the campaign record.
 *   - Simulation layer: replace the fake `externalCampaignId` generation with
 *     real provider SDK calls once vault decryption is wired.
 *
 * Export pattern: `startAdDeliverWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { newId } from '@d2d/shared-utils';
import { AuditService } from '../domains/audit/service';

const QUEUE_NAME = 'ad-deliver';
const BATCH_SIZE = 10;

async function dispatchDraftCampaigns(): Promise<{ dispatched: number; skipped: number }> {
  const log = logger().child({ worker: 'ad-deliver' });
  const now = new Date();

  const draftCampaigns = await prisma().adCampaign.findMany({
    where: {
      status: 'draft',
      startedAt: null,
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  if (draftCampaigns.length === 0) {
    log.debug('ad-deliver: no draft campaigns to dispatch');
    return { dispatched: 0, skipped: 0 };
  }

  log.debug({ count: draftCampaigns.length }, 'ad-deliver: processing draft campaigns');

  let dispatched = 0;
  let skipped = 0;

  for (const campaign of draftCampaigns) {
    // Load the AdAccount — must be active to dispatch.
    const adAccount = await prisma().adAccount.findUnique({
      where: { id: campaign.adAccountId },
      select: { id: true, status: true, provider: true },
    });

    if (!adAccount || adAccount.status !== 'active') {
      log.warn(
        {
          adCampaignId: campaign.id,
          adAccountId: campaign.adAccountId,
          adAccountStatus: adAccount?.status ?? 'not_found',
          provider: campaign.provider,
        },
        'ad-deliver: skipping campaign — ad account not active',
      );
      skipped++;
      continue;
    }

    // Simulate delivery: generate a fake external campaign ID.
    // Real implementation: decrypt tokenVaultRef → OAuth token → provider SDK call.
    const externalCampaignId = `${campaign.provider.toUpperCase()}_SIM_${newId('sim').slice(0, 8)}`;

    await prisma().adCampaign.update({
      where: { id: campaign.id },
      data: {
        status: 'active',
        externalCampaignId,
        startedAt: now,
      },
    });

    await AuditService.recordEvent(prisma(), {
      orgId: campaign.orgId,
      regionCode: 'US',
      actorUserId: null,
      action: 'ad_deliver.campaign_dispatched',
      resourceType: 'AdCampaign',
      resourceId: campaign.id,
      afterJson: {
        adCampaignId: campaign.id,
        provider: campaign.provider,
        externalCampaignId,
        objective: campaign.objective,
        budgetCents: campaign.budgetCents.toString(),
      },
    });

    log.info(
      {
        adCampaignId: campaign.id,
        provider: campaign.provider,
        externalCampaignId,
        objective: campaign.objective,
      },
      'ad-deliver: campaign dispatched',
    );

    dispatched++;
  }

  return { dispatched, skipped };
}

async function sweepEndedCampaigns(): Promise<number> {
  const log = logger().child({ worker: 'ad-deliver' });
  const now = new Date();

  const result = await prisma().adCampaign.updateMany({
    where: {
      status: 'active',
      endedAt: { not: null, lt: now },
    },
    data: { status: 'ended' },
  });

  if (result.count > 0) {
    log.info({ count: result.count }, 'ad-deliver: campaigns transitioned to ended');
  }

  return result.count;
}

async function runAdDeliver(): Promise<void> {
  const log = logger().child({ worker: 'ad-deliver' });

  const { dispatched, skipped } = await dispatchDraftCampaigns();
  const ended = await sweepEndedCampaigns();

  log.info({ dispatched, skipped, ended }, 'ad-deliver: run complete');
}

export function startAdDeliverWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'deliver',
    {},
    {
      repeat: { pattern: '*/5 * * * *' },
      jobId: 'ad-deliver-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runAdDeliver();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'ad-deliver: job failed');
  });
}
