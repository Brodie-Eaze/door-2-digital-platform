/**
 * Pure WKT/area helpers for the canvass-area BFF routes.
 *
 * These mirror apps/api domains/territory/service.ts (parseWktPolygon /
 * centroidOf / stubS2Covering) so an area written from the web operator console
 * stores byte-identical TEXT to one written via the Fastify API — the Knocker
 * iOS app decodes both the same way through GET /v1/territories/assigned.
 *
 * No PostGIS: the dev DB keeps `polygon`/`centroid` as TEXT, so all geometry
 * math lives in app code (Phase 1.1 placeholder, per the schema comment).
 */

export type AreaType = 'polygon' | 'radius';

export interface GeoValidationError {
  ok: false;
  message: string;
}

export interface PolygonResult {
  ok: true;
  /** Normalised, closed single-ring WKT — what we persist to Territory.polygon. */
  wkt: string;
  /** "lng lat" centroid string — what we persist to Territory.centroid. */
  centroid: string;
  s2CellIds: string[];
}

export interface RadiusResult {
  ok: true;
  /** "lng lat" center string — persisted to Territory.centroid. */
  centroid: string;
  radiusMeters: number;
  s2CellIds: string[];
}

function inWgs84(lng: number, lat: number): boolean {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Validate + normalise a single-ring WKT POLYGON. Accepts an open ring (we
 * close it) so the client can post raw drawn vertices. Returns the closed WKT,
 * the arithmetic centroid, and a stub S2 covering.
 */
export function validatePolygonWkt(wkt: string): PolygonResult | GeoValidationError {
  const m = /^POLYGON\s*\(\((.+)\)\)\s*$/i.exec(wkt.trim());
  if (!m || !m[1]) {
    return { ok: false, message: 'Polygon must be a single-ring WKT POLYGON((lng lat, …))' };
  }
  const verts: Array<[number, number]> = [];
  for (const pair of m[1].split(',')) {
    const parts = pair.trim().split(/\s+/);
    if (parts.length !== 2) {
      return { ok: false, message: 'Each polygon vertex must be "lng lat"' };
    }
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return { ok: false, message: 'Polygon vertices must be finite numbers' };
    }
    if (!inWgs84(lng, lat)) {
      return { ok: false, message: 'Polygon vertex out of WGS84 range' };
    }
    verts.push([lng, lat]);
  }

  // Close the ring if the client sent it open.
  const first = verts[0]!;
  const last = verts[verts.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1] ? verts : [...verts, first];
  if (closed.length < 4) {
    return { ok: false, message: 'A polygon needs at least 3 distinct vertices' };
  }

  const centroid = centroidOf(closed);
  const ringText = closed.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return {
    ok: true,
    wkt: `POLYGON((${ringText}))`,
    centroid: `${centroid.lng} ${centroid.lat}`,
    s2CellIds: stubS2Covering(centroid),
  };
}

/**
 * Validate a center+radius circle. Center is "lng lat"; radius is metres,
 * bounded to a sane canvass range (10 m … 50 km).
 */
export function validateRadius(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
): RadiusResult | GeoValidationError {
  if (
    !Number.isFinite(centerLng) ||
    !Number.isFinite(centerLat) ||
    !inWgs84(centerLng, centerLat)
  ) {
    return { ok: false, message: 'Center must be a valid WGS84 "lng lat"' };
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 50_000) {
    return { ok: false, message: 'Radius must be between 10 and 50000 metres' };
  }
  const rounded = Math.round(radiusMeters);
  return {
    ok: true,
    centroid: `${centerLng} ${centerLat}`,
    radiusMeters: rounded,
    s2CellIds: stubS2Covering({ lng: centerLng, lat: centerLat }),
  };
}

/** Arithmetic mean of the unique ring vertices (skip the duplicate close). */
export function centroidOf(ring: Array<[number, number]>): { lng: number; lat: number } {
  const unique = ring.slice(0, ring.length - 1);
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of unique) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lng: sumLng / unique.length, lat: sumLat / unique.length };
}

/**
 * Stub S2 covering — same deterministic single-cell tag as the Fastify
 * service so the column stays non-empty + greppable until @radarlabs/s2 lands.
 */
export function stubS2Covering(centroid: { lng: number; lat: number }): string[] {
  const bucket = (n: number): number => Math.round(n * 1e4) / 1e4;
  return [`S2L13_${bucket(centroid.lng)}_${bucket(centroid.lat)}`];
}
