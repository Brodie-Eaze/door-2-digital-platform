/**
 * Address enrichment worker — Snowflake Data Marketplace.
 *
 * Queue: 'enrich-address'
 * Producer: knock/service.ts (fire-and-forget after knock saved)
 * Consumer: this worker, concurrency 3
 *
 * Each job carries { addressId, orgId, userId, regionCode }.
 * Jobs are keyed by addressId so re-knocking the same address does not
 * re-enrich unnecessarily (removeOnComplete keeps the queue clean).
 */

import { Worker, Queue } from 'bullmq';
import type { RegionCode } from '@prisma/client';
import { redis } from '../config/redis';
import { enrichAddresses } from '../domains/enrichment/service';
import { logger } from '../config/logger';

const QUEUE_NAME = 'enrich-address';

export const enrichQueue = new Queue(QUEUE_NAME, { connection: redis() });

export interface EnrichAddressPayload {
  addressId: string;
  orgId: string;
  userId: string;
  regionCode: RegionCode;
}

export function startAddressEnrichWorker(): Worker {
  const worker = new Worker<EnrichAddressPayload>(
    QUEUE_NAME,
    async (job) => {
      const { addressId, orgId, userId, regionCode } = job.data;
      const log = logger().child({ worker: 'enrich-address', addressId, orgId });
      log.info('enrich-address: start');
      await enrichAddresses([addressId], { orgId, userId, regionCode });
      log.info('enrich-address: done');
    },
    { connection: redis(), concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, data: job?.data, err }, 'enrich-address: job failed');
  });

  return worker;
}

export async function enqueueEnrichAddress(payload: EnrichAddressPayload): Promise<void> {
  await enrichQueue.add('enrich', payload, {
    jobId: `addr-${payload.addressId}`,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 86_400 * 3 },
  });
}
