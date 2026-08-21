/**
 * Webhook delivery worker — drains pending WebhookDelivery rows, signs each
 * payload with the endpoint's HMAC key, and POSTs to the customer URL.
 *
 * Design decisions:
 *   - Secret storage: the endpoint's signing secret is stored as AES-256-GCM
 *     ciphertext in `WebhookEndpoint.secretCipher` (using PII_ENCRYPTION_KEY).
 *     Decrypted here per delivery — never logged.
 *   - Payload storage: full event JSON is stored in S3 (EXPORTS bucket). The
 *     worker downloads it each attempt so the payload is always current-as-of-
 *     creation, not a snapshot that could drift.
 *   - SSRF re-validation: the endpoint URL is re-checked on EVERY attempt
 *     (not just registration) to defend against DNS rebinding attacks.
 *   - At-most-once dispatch per window: before fetching/POSTing, the worker
 *     claims the row by setting nextAttemptAt = now + 15 min. If the process
 *     dies mid-flight, the row becomes eligible for retry after 15 min.
 *   - Retry schedule: 30 s → 2 min → 10 min → 1 h → 6 h → 24 h → DLQ
 *     (6 retries max). After 6 failures the delivery moves to `dlq` and is
 *     never retried automatically.
 *
 * Export pattern: `startWebhookDeliverWorker()` — no top-level side-effects.
 */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { env } from '../config/env';
import {
  decryptWebhookSecret,
  assertSafeWebhookUrl,
  WebhookService,
} from '../domains/webhook/service';

const QUEUE_NAME = 'webhook-deliver';
const BATCH_SIZE = 20;
const CLAIM_LOCK_MS = 15 * 60 * 1000; // 15 min claim lock
const MAX_ATTEMPTS = 6;

// Exponential backoff delays in milliseconds (index = attempt count BEFORE this try)
const RETRY_DELAYS_MS = [
  30_000, // retry 1: 30 s
  2 * 60_000, // retry 2: 2 min
  10 * 60_000, // retry 3: 10 min
  60 * 60_000, // retry 4: 1 h
  6 * 60 * 60_000, // retry 5: 6 h
  24 * 60 * 60_000, // retry 6: 24 h
];

async function readS3Payload(payloadKey: string): Promise<string> {
  const e = env();
  const s3 = new S3Client({ region: e.AWS_REGION });
  const res = await s3.send(new GetObjectCommand({ Bucket: e.S3_BUCKET_EXPORTS, Key: payloadKey }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function deliverBatch(): Promise<void> {
  const log = logger().child({ worker: 'webhook-deliver' });
  const now = new Date();

  // Find pending deliveries whose nextAttemptAt is in the past (or null = never tried).
  const candidates = await prisma().webhookDelivery.findMany({
    where: {
      status: 'pending',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true },
  });

  if (candidates.length === 0) {
    log.debug('webhook-deliver: nothing to deliver');
    return;
  }

  // Claim the batch: set nextAttemptAt = now + 15 min to prevent double-dispatch.
  const ids = candidates.map((r) => r.id);
  const claimUntil = new Date(now.getTime() + CLAIM_LOCK_MS);
  await prisma().webhookDelivery.updateMany({
    where: { id: { in: ids }, status: 'pending' },
    data: { nextAttemptAt: claimUntil },
  });

  // Reload with endpoint details.
  const rows = await prisma().webhookDelivery.findMany({
    where: { id: { in: ids }, nextAttemptAt: claimUntil },
    include: {
      endpoint: {
        select: { id: true, url: true, secretCipher: true, status: true },
      },
    },
  });

  for (const row of rows) {
    const rowLog = log.child({ deliveryId: row.id, endpointId: row.endpointId });
    const attempt = row.attempts + 1;

    try {
      // Skip if endpoint was archived since the delivery was created.
      if (row.endpoint.status !== 'active') {
        rowLog.info(
          { endpointStatus: row.endpoint.status },
          'webhook-deliver: endpoint not active — moving to dlq',
        );
        await prisma().webhookDelivery.update({
          where: { id: row.id },
          data: { status: 'dlq', lastError: 'endpoint_not_active', attempts: attempt },
        });
        continue;
      }

      // Re-validate the URL on every attempt (DNS rebinding defense).
      await assertSafeWebhookUrl(row.endpoint.url);

      // Decrypt signing secret.
      const secret = decryptWebhookSecret(row.endpoint.secretCipher, row.endpoint.id);

      // Fetch payload from S3.
      const body = await readS3Payload(row.payloadKey);

      // Sign and deliver.
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = WebhookService.signPayload(secret, body, timestamp);

      const res = await fetch(row.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'D2D-Signature': signature,
          'User-Agent': 'D2D-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        await prisma().webhookDelivery.update({
          where: { id: row.id },
          data: {
            status: 'delivered',
            attempts: attempt,
            lastError: null,
            nextAttemptAt: null,
            deliveredAt: new Date(),
          },
        });
        rowLog.info({ attempt }, 'webhook-deliver: delivered');
        continue;
      }

      // Non-2xx from customer endpoint — treat as failure.
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '(unreadable body)')}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      rowLog.warn({ attempt, err: errMsg }, 'webhook-deliver: attempt failed');

      if (attempt >= MAX_ATTEMPTS) {
        await prisma().webhookDelivery.update({
          where: { id: row.id },
          data: { status: 'dlq', attempts: attempt, lastError: errMsg, nextAttemptAt: null },
        });
        rowLog.warn({ attempt }, 'webhook-deliver: max attempts reached — moved to dlq');
      } else {
        const delayMs =
          RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
        const nextAttemptAt = new Date(Date.now() + delayMs);
        await prisma().webhookDelivery.update({
          where: { id: row.id },
          data: { status: 'pending', attempts: attempt, lastError: errMsg, nextAttemptAt },
        });
        rowLog.info({ nextAttemptAt, delayMs }, 'webhook-deliver: retry scheduled');
      }
    }
  }

  log.info({ total: rows.length }, 'webhook-deliver: batch complete');
}

export function startWebhookDeliverWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'deliver',
    {},
    {
      repeat: { pattern: '*/30 * * * * *' },
      jobId: 'webhook-deliver-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await deliverBatch();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'webhook-deliver: job failed');
  });
}
