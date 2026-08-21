/**
 * Planet Labs satellite intelligence worker.
 *
 * Queue: 'planet-intel'
 * Producers:
 *   - territory/service.ts (fires after createTerritory, when PLANET_API_KEY is set)
 *   - inbound/planet.ts (fires when Planet delivers a subscription event webhook)
 *
 * Each job carries { territoryId, subscriptionId }.
 * Worker queries Planet construction-detection API for the territory polygon,
 * derives a satellite score, and writes back to PropensityScore + territory.metadata.
 */

import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis';
import { prisma } from '../config/db';
import {
  wktToGeoJSON,
  queryConstructionDetection,
  applyTerritoryIntel,
} from '../domains/satellite/service';
import { logger } from '../config/logger';
import type { RegionCode } from '@prisma/client';

const QUEUE_NAME = 'planet-intel';

export const planetIntelQueue = new Queue(QUEUE_NAME, { connection: redis() });

export interface PlanetIntelPayload {
  territoryId: string;
  subscriptionId: string;
}

export function startPlanetIntelWorker(): Worker {
  const worker = new Worker<PlanetIntelPayload>(
    QUEUE_NAME,
    async (job) => {
      const { territoryId, subscriptionId } = job.data;
      const log = logger().child({ worker: 'planet-intel', territoryId });
      log.info('planet-intel: start');

      const territory = await prisma().territory.findUnique({
        where: { id: territoryId },
        select: { id: true, orgId: true, polygon: true, regionCode: true },
      });

      if (!territory) {
        log.warn('planet-intel: territory not found — skipping');
        return;
      }

      if (!territory.polygon) {
        log.warn('planet-intel: territory has no polygon — skipping');
        return;
      }

      const geoPolygon = wktToGeoJSON(territory.polygon);
      const features = await queryConstructionDetection(geoPolygon);

      await applyTerritoryIntel(territoryId, features, subscriptionId, {
        orgId: territory.orgId,
        userId: 'system',
        regionCode: territory.regionCode as RegionCode,
        role: 'super_admin',
      });

      log.info({ features }, 'planet-intel: done');
    },
    { connection: redis(), concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, data: job?.data, err }, 'planet-intel: job failed');
  });

  return worker;
}

export async function enqueuePlanetIntel(payload: PlanetIntelPayload): Promise<void> {
  await planetIntelQueue.add('scan', payload, {
    jobId: `planet-${payload.territoryId}`,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 86_400 * 7 },
  });
}
