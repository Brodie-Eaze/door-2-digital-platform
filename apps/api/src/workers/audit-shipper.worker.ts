/**
 * Audit-shipper worker — drains unshipped AuditEvent rows to S3 as
 * newline-delimited JSON (NDJSON).
 *
 * Runs every 60 seconds via BullMQ's built-in repeat scheduler. The S3 bucket
 * (`S3_BUCKET_AUDIT`) must have Object Lock COMPLIANCE mode configured via
 * Terraform; the SDK upload is a plain PutObject — no explicit Object Lock API
 * call is required here.
 *
 * Invariant: `shippedToS3At` is set in a single Prisma updateMany AFTER a
 * confirmed S3 upload. If the process dies between upload and updateMany, the
 * next run re-uploads the same rows (idempotent — S3 PUT is idempotent by key,
 * and the key embeds a timestamp so duplicate uploads produce distinct objects
 * rather than clobbering each other; the audit log keeps both, which is safe).
 *
 * Export pattern: `startAuditShipper()` rather than top-level side-effects so
 * test environments that have no real Redis can import this module without
 * crashing.
 */
import { Worker, Queue } from 'bullmq';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { env } from '../config/env';

const QUEUE_NAME = 'audit-ship';
const BATCH_SIZE = 1000;

function buildS3Key(regionCode: string, now: Date): string {
  const year = now.getUTCFullYear();
  // Zero-pad month and day to maintain lexicographic sort order in S3.
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `audit/${regionCode}/${year}/${month}/${day}/${timestamp}.ndjson`;
}

async function shipBatch(): Promise<void> {
  const log = logger().child({ worker: 'audit-shipper' });

  const rows = await prisma().auditEvent.findMany({
    where: { shippedToS3At: null },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
  });

  if (rows.length === 0) {
    log.debug('audit-shipper: nothing to ship');
    return;
  }

  // Group by regionCode so each upload is region-partitioned. This keeps S3
  // prefix structure clean for per-region compliance queries.
  const byRegion = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = byRegion.get(row.regionCode) ?? [];
    bucket.push(row);
    byRegion.set(row.regionCode, bucket);
  }

  const e = env();
  // S3Client is constructed per-invocation rather than as a module-level
  // singleton so the region can be sourced from the validated env (not from
  // ambient AWS SDK environment resolution, which can differ in test).
  const s3 = new S3Client({ region: e.AWS_REGION });
  const shippedIds: bigint[] = [];

  for (const [regionCode, regionRows] of byRegion) {
    const now = new Date();
    const key = buildS3Key(regionCode, now);
    const body = regionRows.map((r) => JSON.stringify(r)).join('\n');

    await s3.send(
      new PutObjectCommand({
        Bucket: e.S3_BUCKET_AUDIT,
        Key: key,
        Body: body,
        ContentType: 'application/x-ndjson',
      }),
    );

    log.info(
      { region: regionCode, count: regionRows.length, s3Key: key },
      'audit-shipper: uploaded batch to S3',
    );

    for (const r of regionRows) shippedIds.push(r.id);
  }

  // Mark shipped only after all uploads succeed. If a partial failure occurs
  // mid-loop, unshipped rows will be retried on the next tick — safe because
  // S3 PutObject is idempotent per unique key.
  await prisma().auditEvent.updateMany({
    where: { id: { in: shippedIds } },
    data: { shippedToS3At: new Date() },
  });

  log.info({ count: shippedIds.length }, 'audit-shipper: marked shipped');
}

export function startAuditShipper(): void {
  const connection = redis();

  // Register the repeat job. BullMQ deduplicates by jobId so restarting the
  // process does not queue duplicate cron entries.
  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'ship',
    {},
    {
      repeat: { pattern: '*/60 * * * * *' },
      jobId: 'audit-ship-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await shipBatch();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'audit-shipper: job failed');
  });
}
