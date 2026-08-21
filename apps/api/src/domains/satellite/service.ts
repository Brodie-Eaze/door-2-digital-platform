/**
 * Satellite intelligence service — Planet Labs API.
 *
 * Two integration modes:
 *
 *   Mode A — Basemap tile URL swap (Day 1, zero pipeline)
 *     planetTileUrl() returns a Mapbox-compatible XYZ URL.
 *     No subscription needed. Used by the iOS Knocker map layer toggle.
 *
 *   Mode B — Push subscriptions + change detection (continuous)
 *     createPlanetSubscription() registers a push subscription for a territory
 *     polygon. Planet delivers imagery events to /inbound/planet. The webhook
 *     handler enqueues a planet-intel job that calls queryConstructionDetection()
 *     and writes a PropensityScore + territory metadata update.
 *
 * Required env vars: PLANET_API_KEY, PLANET_WEBHOOK_SECRET, API_BASE_URL
 */

import type { RegionCode } from '@prisma/client';
import { planetFetch, planetTileUrl as _planetTileUrl } from '../../config/planet';
import { writeScores } from '../propensity/service';
import type { ScoreInput } from '../propensity/schemas';
import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type { Prisma } from '@prisma/client';

export { _planetTileUrl as planetTileUrl };

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
  role: string;
}

// GeoJSON polygon (required by Planet API; converted from WKT by the worker).
interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface PlanetFeature {
  type: 'Feature';
  properties: {
    change_type?: string;
    acquired?: string;
    [key: string]: unknown;
  };
  geometry: object;
}

interface PlanetFeatureCollection {
  type: 'FeatureCollection';
  features: PlanetFeature[];
}

export interface ConstructionFeatures {
  activeConstruction: number;
  demolitions: number;
  totalChanges: number;
  capturedAt: string | null;
}

// ─── Mode A: basemap tile URL ────────────────────────────────────────────────

export function currentMonthTileUrl(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return _planetTileUrl(`${year}-${month}`);
}

// ─── Mode B: subscriptions ───────────────────────────────────────────────────

interface SubscriptionPayload {
  name: string;
  source: {
    type: string;
    parameters: {
      item_types: string[];
      asset_types: string[];
      geometry: GeoJSONPolygon;
      filter: {
        type: string;
        field_name: string;
        config: { lte: number };
      };
    };
  };
  delivery: {
    type: string;
    url: string;
    credentials: { api_key: string };
  };
}

export async function createPlanetSubscription(
  territoryId: string,
  polygon: GeoJSONPolygon,
): Promise<string> {
  // The webhook secret authenticates Planet's inbound delivery to /inbound/planet.
  // Creating a subscription without it would register an unauthenticated callback,
  // so refuse rather than coerce undefined into the payload.
  const webhookSecret = env().PLANET_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('PLANET_WEBHOOK_SECRET is not configured; cannot create subscription');
  }

  const payload: SubscriptionPayload = {
    name: `d2d-territory-${territoryId}`,
    source: {
      type: 'catalog',
      parameters: {
        item_types: ['PSScene'],
        asset_types: ['ortho_visual'],
        geometry: polygon,
        filter: {
          type: 'RangeFilter',
          field_name: 'cloud_cover',
          config: { lte: 0.15 },
        },
      },
    },
    delivery: {
      type: 'webhook',
      url: `${env().API_BASE_URL}/v1/inbound/planet`,
      credentials: { api_key: webhookSecret },
    },
  };

  const result = await planetFetch<{ id: string }>('/subscriptions/v1/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return result.id;
}

export async function cancelPlanetSubscription(subscriptionId: string): Promise<void> {
  await planetFetch(`/subscriptions/v1/${subscriptionId}/cancel`, { method: 'POST' });
}

export async function queryConstructionDetection(
  polygon: GeoJSONPolygon,
): Promise<ConstructionFeatures> {
  const geom = encodeURIComponent(JSON.stringify(polygon));
  const data = await planetFetch<PlanetFeatureCollection>(
    `/analytics/features/v0/collections/PSScene:construction_detection/items?geometry=${geom}&limit=500`,
  );

  const features = data.features ?? [];
  return {
    activeConstruction: features.filter((f) => f.properties.change_type === 'construction_start')
      .length,
    demolitions: features.filter((f) => f.properties.change_type === 'demolition').length,
    totalChanges: features.length,
    capturedAt: features[0]?.properties?.acquired ?? null,
  };
}

export function deriveSatelliteScore(f: ConstructionFeatures): number {
  // Construction starts = new movers → high conversion signal
  const constructionSignal = Math.min(f.activeConstruction / 10, 1) * 0.7;
  // Total change activity in the area
  const changeSignal = Math.min(f.totalChanges / 20, 1) * 0.3;
  return Math.min(constructionSignal + changeSignal, 1);
}

// ─── WKT → GeoJSON conversion (territories store WKT) ───────────────────────

export function wktToGeoJSON(wkt: string): GeoJSONPolygon {
  const match = wkt.match(/^POLYGON\s*\(\((.+)\)\)\s*$/i);
  if (!match?.[1]) throw new Error(`Cannot parse WKT polygon: ${wkt}`);
  const ring = match[1].split(',').map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat] as [number, number];
  });
  return { type: 'Polygon', coordinates: [ring] };
}

// ─── Satellite intel write-back (called by planet-intel worker) ──────────────

export async function applyTerritoryIntel(
  territoryId: string,
  features: ConstructionFeatures,
  subscriptionId: string,
  actor: ActorContext,
): Promise<void> {
  const score = deriveSatelliteScore(features);
  const log = logger().child({ worker: 'planet-intel', territoryId });

  // Territory-level score has no single centroid — the manager console reads it
  // by geoKey (territory id), not off the heatmap, so centroids are omitted.
  const scores: ScoreInput[] = [
    {
      geoType: 'territory',
      geoKey: territoryId,
      score,
      features: {
        activeConstruction: features.activeConstruction,
        demolitions: features.demolitions,
        totalChanges: features.totalChanges,
        capturedAt: features.capturedAt,
        subscriptionId,
      },
    },
  ];

  await writeScores(
    {
      scores,
      modelName: 'planet-satellite',
      modelVersion: 'v1',
    },
    actor,
  );

  // Write satellite summary into territory.metadata so the manager console
  // can surface it without a separate propensity query.
  const existing = await prisma().territory.findUnique({
    where: { id: territoryId },
    select: { metadata: true },
  });
  const meta = ((existing?.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  meta.satellite = {
    constructionCount: features.activeConstruction,
    demolitionCount: features.demolitions,
    totalChanges: features.totalChanges,
    lastCapture: features.capturedAt,
    subscriptionId,
    score,
  };

  await prisma().territory.update({
    where: { id: territoryId },
    data: { metadata: meta as Prisma.InputJsonValue },
  });

  log.info({ score, features }, 'satellite: territory intel applied');
}

// ─── GET /v1/territories/:id/satellite — read response shape ─────────────────

export interface TerritoryIntelPublic {
  territoryId: string;
  subscriptionId: string | null;
  constructionCount: number;
  demolitionCount: number;
  totalChanges: number;
  lastCapture: string | null;
  score: number;
  basemapTileUrl: string;
}

export async function getTerritoryIntel(
  territoryId: string,
  orgId: string,
): Promise<TerritoryIntelPublic> {
  const territory = await prisma().territory.findUnique({
    where: { id: territoryId },
    select: { orgId: true, metadata: true },
  });
  if (!territory || territory.orgId !== orgId) {
    throw Object.assign(new Error('not_found'), { statusCode: 404 });
  }

  const sat = ((territory.metadata as Record<string, unknown>)?.satellite ?? {}) as Record<
    string,
    unknown
  >;

  return {
    territoryId,
    subscriptionId: (sat.subscriptionId as string | null) ?? null,
    constructionCount: (sat.constructionCount as number) ?? 0,
    demolitionCount: (sat.demolitionCount as number) ?? 0,
    totalChanges: (sat.totalChanges as number) ?? 0,
    lastCapture: (sat.lastCapture as string | null) ?? null,
    score: (sat.score as number) ?? 0,
    basemapTileUrl: currentMonthTileUrl(),
  };
}
