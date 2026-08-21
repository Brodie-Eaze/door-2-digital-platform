/**
 * DNK/DNC sync worker — nightly ingestion of do-not-knock and do-not-call
 * registry feeds into Prisma.
 *
 * Runs at 2am UTC via BullMQ's built-in repeat scheduler. Feed URLs are
 * optional env vars; if absent, the sync for that feed is skipped with a
 * structured log rather than failing the job.
 *
 * Phone numbers are stored as HMAC-SHA256 digests (never plaintext) using
 * `hmacSha256(PII_HASH_SECRET, normalisedE164)` — the same derivation used
 * by `Lead.phoneDigest` and `User.phoneDigest` so cross-entity lookups stay
 * consistent.
 *
 * Upsert conflict key: `@@unique([regionCode, phoneDigest])` for DoNotCall
 * and `@@unique([regionCode, addressId])` for DoNotKnock — these are enforced
 * in the DB schema as the last line of defence against duplicates on retry.
 *
 * Export pattern: `startDnkSync()` rather than top-level side-effects so test
 * environments without real Redis can import without crashing.
 */
import { Worker, Queue } from 'bullmq';
import { hmacSha256, newId } from '@d2d/shared-utils';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { env } from '../config/env';

const QUEUE_NAME = 'dnk-sync';

/**
 * Fetch a feed URL and return lines. The feed is assumed to be a plain-text
 * file with one E.164 phone number per line (US DNC / AU DNCR format).
 * Returns an empty array if the URL is not set or the fetch fails non-fatally.
 */
async function fetchLines(url: string, label: string): Promise<string[]> {
  const log = logger().child({ worker: 'dnk-sync', feed: label });
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (err) {
    log.warn({ err, url }, 'dnk-sync: feed fetch failed — skipping');
    return [];
  }
  if (!res.ok) {
    log.warn({ status: res.status, url }, 'dnk-sync: feed returned non-2xx — skipping');
    return [];
  }
  const text = await res.text();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

async function syncDncUs(): Promise<void> {
  const log = logger().child({ worker: 'dnk-sync', region: 'US', source: 'FTC_DNC' });
  const feedUrl = process.env['FTC_DNC_FEED_URL'];

  if (!feedUrl) {
    log.info('FTC_DNC_FEED_URL not configured — skipping US DNC sync');
    return;
  }

  const lines = await fetchLines(feedUrl, 'FTC_DNC');
  const secret = env().PII_HASH_SECRET;
  let added = 0;
  let skipped = 0;

  for (const line of lines) {
    // Normalise to E.164: strip everything except digits and leading +
    const norm = line.replace(/[^\d+]/g, '');
    if (!norm) {
      skipped++;
      continue;
    }

    const digest = hmacSha256(secret, norm);

    const existing = await prisma().doNotCall.findFirst({
      where: { regionCode: 'US', phoneDigest: digest },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma().doNotCall.create({
      data: {
        id: newId('dnc'),
        regionCode: 'US',
        phoneDigest: digest,
        source: 'FTC_DNC',
      },
    });
    added++;
  }

  log.info({ region: 'US', source: 'FTC_DNC', added, skipped }, 'dnk-sync: US DNC sync complete');
}

async function syncDnkFeed(): Promise<void> {
  const log = logger().child({ worker: 'dnk-sync', region: 'US', source: 'DNK_FEED' });
  const feedUrl = process.env['DNK_FEED_URL'];

  if (!feedUrl) {
    log.info('DNK_FEED_URL not configured — skipping DNK feed sync');
    return;
  }

  // DNK feed format: one addressId (UUID) per line.
  // The feed owner is responsible for pre-hashing/normalising addresses to
  // their canonical addressId before publishing the feed.
  const lines = await fetchLines(feedUrl, 'DNK_FEED');
  let added = 0;
  let skipped = 0;

  for (const addressId of lines) {
    if (!addressId) {
      skipped++;
      continue;
    }

    const existing = await prisma().doNotKnock.findFirst({
      where: { regionCode: 'US', addressId },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma().doNotKnock.create({
      data: {
        id: newId('dnk'),
        regionCode: 'US',
        addressId,
        source: 'DNK_FEED',
      },
    });
    added++;
  }

  log.info(
    { region: 'US', source: 'DNK_FEED', added, skipped },
    'dnk-sync: DNK feed sync complete',
  );
}

async function runSync(): Promise<void> {
  await syncDncUs();
  await syncDnkFeed();
}

export function startDnkSync(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'sync',
    {},
    {
      repeat: { pattern: '0 2 * * *' },
      jobId: 'dnk-sync-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runSync();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'dnk-sync: job failed');
  });
}
