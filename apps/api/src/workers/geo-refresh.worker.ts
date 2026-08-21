/**
 * Geo-refresh worker — weekly re-ingestion of US ACS (Census) demographic
 * data into PropensityScore rows for all active territories.
 *
 * Runs Monday 03:00 UTC via BullMQ repeat scheduler.
 *
 * In production this worker will call the Census API. This implementation is
 * a structured stub that produces deterministic, audit-able placeholder scores
 * so the downstream heatmap / propensity surfaces have real rows to work with
 * before the Census integration ships.
 *
 * Processing:
 *   1. Find all active territories (status='active') across all orgs, capped
 *      at TERRITORY_LIMIT to avoid OOM on large installs.
 *   2. For each territory, delete any existing PropensityScore rows for
 *      (orgId, geoType='h3', geoKey derived from territory.id) then insert a
 *      fresh row. deleteMany + createMany is used because the schema has no
 *      unique constraint on (orgId, geoType, geoKey) alone.
 *   3. Compute a deterministic pseudo-score from the org+territory seed so the
 *      same run produces the same values (stable for testing / visual review).
 *   4. Write a single platform-level AuditEvent `geo_refresh.completed`.
 *
 * Idempotency: deleteMany + create means re-running replaces rows cleanly.
 *
 * Export pattern: `startGeoRefreshWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { newId } from '@d2d/shared-utils';
import { AuditService } from '../domains/audit/service';
import type { RegionCode } from '@prisma/client';

const QUEUE_NAME = 'geo-refresh';
const TERRITORY_LIMIT = 1000;
const MODEL_NAME = 'census-acs-v1';
const MODEL_VERSION = '2026-01';

/**
 * Deterministic pseudo-random score from an org+territory seed string.
 * Same seed → same score within a run.
 * Returns a value in [0.30, 0.79].
 */
function pseudoScore(seed: string): number {
  let h = 5381;
  for (const c of seed) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return 0.3 + (h % 100) / 200;
}

function scoreToBand(score: number): string {
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * Derive a stable H3-style geoKey from a territory id.
 * In production this will be the actual H3 cell covering centroid.
 */
function geoKeyForTerritory(territoryId: string): string {
  return `stub_h3_${territoryId}`;
}

/**
 * Parse centroid string "lng lat" → { lat, lng } or null.
 */
function parseCentroid(centroid: string | null): { lat: number; lng: number } | null {
  if (!centroid) return null;
  const parts = centroid.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const lng = parseFloat(parts[0]!);
  const lat = parseFloat(parts[1]!);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

async function runGeoRefresh(): Promise<void> {
  const log = logger().child({ worker: 'geo-refresh' });

  log.info('geo-refresh: starting weekly ACS ingest');

  const territories = await prisma().territory.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      orgId: true,
      regionCode: true,
      name: true,
      centroid: true,
    },
    take: TERRITORY_LIMIT,
  });

  if (territories.length === 0) {
    log.info('geo-refresh: no active territories — nothing to do');
    return;
  }

  log.info({ count: territories.length }, 'geo-refresh: territories found');

  let rowsWritten = 0;
  let territoriesProcessed = 0;

  // Track first org+regionCode for the audit event.
  let auditOrgId: string | null = null;
  let auditRegionCode: RegionCode | null = null;

  for (const territory of territories) {
    const geoKey = geoKeyForTerritory(territory.id);
    const seed = `${territory.orgId}:${territory.id}`;
    const score = pseudoScore(seed);
    const band = scoreToBand(score);
    const centroidParsed = parseCentroid(territory.centroid);
    const now = new Date();

    try {
      // Delete existing rows for this org + geoType + geoKey before inserting
      // fresh, since PropensityScore has no unique constraint on (orgId, geoType, geoKey).
      await prisma().propensityScore.deleteMany({
        where: {
          orgId: territory.orgId,
          geoType: 'h3',
          geoKey,
        },
      });

      await prisma().propensityScore.create({
        data: {
          id: newId('pps'),
          orgId: territory.orgId,
          regionCode: territory.regionCode,
          geoType: 'h3',
          geoKey,
          centroidLat: centroidParsed?.lat ?? null,
          centroidLng: centroidParsed?.lng ?? null,
          score,
          band,
          modelName: MODEL_NAME,
          modelVersion: MODEL_VERSION,
          features: {
            stub: true,
            territoryId: territory.id,
            territoryName: territory.name,
            seed,
          },
          computedAt: now,
        },
      });

      rowsWritten += 1;
      territoriesProcessed += 1;

      if (auditOrgId === null) {
        auditOrgId = territory.orgId;
        auditRegionCode = territory.regionCode as RegionCode;
      }
    } catch (err) {
      log.error(
        { territoryId: territory.id, orgId: territory.orgId, err },
        'geo-refresh: failed to write PropensityScore row — continuing',
      );
    }
  }

  log.info({ territoriesProcessed, rowsWritten }, 'geo-refresh: ingest complete');

  // Write platform-level audit event. Skip if no territories were processed.
  if (auditOrgId !== null && auditRegionCode !== null) {
    await prisma().$transaction(async (tx) => {
      await AuditService.recordEvent(tx, {
        orgId: null,
        regionCode: auditRegionCode!,
        actorUserId: null,
        action: 'geo_refresh.completed',
        resourceType: 'PropensityScore',
        resourceId: 'batch',
        afterJson: {
          territoriesProcessed,
          rowsWritten,
          modelName: MODEL_NAME,
          modelVersion: MODEL_VERSION,
          territoriesFound: territories.length,
          limit: TERRITORY_LIMIT,
        },
      });
    });

    log.info({ territoriesProcessed, rowsWritten }, 'geo-refresh: audit event written');
  }
}

export function startGeoRefreshWorker(): void {
  const connection = redis();

  // Register the Monday 03:00 UTC cron job. BullMQ deduplicates by jobId so
  // restarting the process will not queue duplicate cron entries.
  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'refresh',
    {},
    {
      repeat: { pattern: '0 3 * * 1' },
      jobId: 'geo-refresh-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runGeoRefresh();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'geo-refresh: job failed');
  });

  worker.on('completed', (job) => {
    logger().child({ worker: 'geo-refresh' }).info({ jobId: job.id }, 'geo-refresh: job completed');
  });
}
