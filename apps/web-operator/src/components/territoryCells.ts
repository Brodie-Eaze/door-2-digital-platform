/**
 * Pure-data module for Territory Intel propensity cells.
 *
 * Lives outside TerritoryHeatmapImpl.tsx so the page can import cell counts /
 * filter state without pulling in react-leaflet (which is client-only and gets
 * dynamic-loaded). Both modules read from this shared source of truth.
 */

export type CellStatus = 'ai_suggested' | 'active' | 'blocked' | 'low_yield';

export type ZoneSelection = {
  id: string;
  name: string;
  bounds: [[number, number], [number, number]];
  propensity: number;
  medianIncomeCents: number;
  estLiftPp: number | null;
  knockableDoors: number;
  saturationPercent: number;
  status: CellStatus;
  densityLabel: 'High' | 'Medium' | 'Low';
};

export const STATUS_LABEL: Record<CellStatus, string> = {
  ai_suggested: 'AI suggested',
  active: 'Active',
  blocked: 'Blocked',
  low_yield: 'Low-yield',
};

// ----- Texas metro definitions ----------------------------------------------

type Metro = {
  name: string;
  lat: number;
  lng: number;
  radius: number; // degrees
  density: 'high' | 'med' | 'low';
};

const TX_METROS: Metro[] = [
  { name: 'Austin', lat: 30.27, lng: -97.74, radius: 0.55, density: 'high' },
  { name: 'Dallas-FW', lat: 32.78, lng: -96.8, radius: 0.65, density: 'high' },
  { name: 'Houston', lat: 29.76, lng: -95.37, radius: 0.65, density: 'high' },
  { name: 'San Antonio', lat: 29.42, lng: -98.49, radius: 0.5, density: 'med' },
  { name: 'El Paso', lat: 31.76, lng: -106.49, radius: 0.4, density: 'med' },
  { name: 'Corpus Christi', lat: 27.8, lng: -97.4, radius: 0.3, density: 'low' },
];

type Neighbourhood = {
  name: string;
  lat: number;
  lng: number;
  basePropensity: number;
};

const NEIGHBOURHOODS: Record<string, Neighbourhood[]> = {
  Austin: [
    { name: 'Austin South · 78704', lat: 30.24, lng: -97.77, basePropensity: 0.81 },
    { name: 'East Austin · 78702', lat: 30.27, lng: -97.7, basePropensity: 0.62 },
    { name: 'Cedar Park · 78613', lat: 30.5, lng: -97.82, basePropensity: 0.74 },
    { name: 'Round Rock · 78664', lat: 30.5, lng: -97.66, basePropensity: 0.71 },
    { name: 'Pflugerville · 78660', lat: 30.44, lng: -97.62, basePropensity: 0.68 },
    { name: 'Westlake Hills · 78746', lat: 30.29, lng: -97.82, basePropensity: 0.42 },
    { name: 'Mueller · 78723', lat: 30.3, lng: -97.7, basePropensity: 0.77 },
    { name: 'Domain · 78758', lat: 30.4, lng: -97.72, basePropensity: 0.79 },
  ],
  'Dallas-FW': [
    { name: 'Plano · 75024', lat: 33.08, lng: -96.8, basePropensity: 0.78 },
    { name: 'Frisco · 75034', lat: 33.15, lng: -96.83, basePropensity: 0.82 },
    { name: 'Highland Park · 75205', lat: 32.84, lng: -96.79, basePropensity: 0.42 },
    { name: 'Dallas Uptown · 75201', lat: 32.79, lng: -96.79, basePropensity: 0.59 },
    { name: 'Arlington · 76012', lat: 32.75, lng: -97.13, basePropensity: 0.71 },
    { name: 'Garland · 75040', lat: 32.91, lng: -96.63, basePropensity: 0.67 },
    { name: 'Mesquite · 75150', lat: 32.78, lng: -96.6, basePropensity: 0.55 },
    { name: 'Fort Worth West · 76107', lat: 32.74, lng: -97.38, basePropensity: 0.69 },
  ],
  Houston: [
    { name: 'Sugar Land · 77479', lat: 29.58, lng: -95.63, basePropensity: 0.74 },
    { name: 'The Woodlands · 77381', lat: 30.16, lng: -95.46, basePropensity: 0.81 },
    { name: 'Katy · 77494', lat: 29.78, lng: -95.83, basePropensity: 0.79 },
    { name: 'Pearland · 77584', lat: 29.55, lng: -95.32, basePropensity: 0.72 },
    { name: 'Houston SE · 77033', lat: 29.66, lng: -95.33, basePropensity: 0.48 },
    { name: 'Cypress · 77433', lat: 29.97, lng: -95.7, basePropensity: 0.76 },
    { name: 'Spring · 77379', lat: 30.05, lng: -95.5, basePropensity: 0.73 },
    { name: 'Friendswood · 77546', lat: 29.52, lng: -95.2, basePropensity: 0.7 },
  ],
  'San Antonio': [
    { name: 'Stone Oak · 78258', lat: 29.62, lng: -98.47, basePropensity: 0.76 },
    { name: 'Alamo Heights · 78209', lat: 29.47, lng: -98.46, basePropensity: 0.54 },
    { name: 'Helotes · 78023', lat: 29.57, lng: -98.69, basePropensity: 0.72 },
    { name: 'Schertz · 78154', lat: 29.6, lng: -98.27, basePropensity: 0.65 },
  ],
  'El Paso': [
    { name: 'El Paso West · 79912', lat: 31.85, lng: -106.55, basePropensity: 0.61 },
    { name: 'El Paso East · 79936', lat: 31.76, lng: -106.31, basePropensity: 0.53 },
    { name: 'Sunland Park · 88063', lat: 31.79, lng: -106.55, basePropensity: 0.45 },
  ],
  'Corpus Christi': [
    { name: 'Corpus North · 78410', lat: 27.82, lng: -97.55, basePropensity: 0.58 },
    { name: 'Corpus Bay · 78411', lat: 27.72, lng: -97.4, basePropensity: 0.62 },
  ],
};

const CELL_LAT = 0.12;
const CELL_LNG = 0.15;

function deterministicNoise(i: number, j: number): number {
  const v = 0.5 + 0.5 * Math.sin(i * 0.7 + 0.3) * Math.cos(j * 0.31 + 0.7);
  return Math.min(1, Math.max(0, v));
}

function findNearestNeighbourhood(metro: string, cLat: number, cLng: number): Neighbourhood | null {
  const list = NEIGHBOURHOODS[metro] ?? [];
  let best: { n: Neighbourhood; dist: number } | null = null;
  for (const n of list) {
    const d = Math.hypot(n.lat - cLat, n.lng - cLng);
    if (!best || d < best.dist) best = { n, dist: d };
  }
  if (!best) return null;
  if (best.dist <= Math.max(CELL_LAT, CELL_LNG) * 2) return best.n;
  return null;
}

function metroZipPrefix(metro: string): string {
  switch (metro) {
    case 'Austin':
      return '787';
    case 'Dallas-FW':
      return '752';
    case 'Houston':
      return '770';
    case 'San Antonio':
      return '782';
    case 'El Paso':
      return '799';
    case 'Corpus Christi':
      return '784';
    default:
      return '750';
  }
}

const COMPASS = ['North', 'South', 'East', 'West', 'Central', 'NW', 'NE', 'SW', 'SE'];

function buildCells(): ZoneSelection[] {
  const cells: ZoneSelection[] = [];
  const seen = new Set<string>();
  const usedNeighbourhoods = new Set<string>();
  let counter = 0;

  for (const metro of TX_METROS) {
    let metroCount = 0;
    const maxPerMetro = metro.density === 'high' ? 60 : metro.density === 'med' ? 35 : 18;

    for (let lat = metro.lat - metro.radius; lat <= metro.lat + metro.radius; lat += CELL_LAT) {
      for (let lng = metro.lng - metro.radius; lng <= metro.lng + metro.radius; lng += CELL_LNG) {
        if (metroCount >= maxPerMetro) break;

        const lat0 = Math.round(lat * 1000) / 1000;
        const lng0 = Math.round(lng * 1000) / 1000;
        const id = `${lat0.toFixed(3)}_${lng0.toFixed(3)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const cLat = lat0 + CELL_LAT / 2;
        const cLng = lng0 + CELL_LNG / 2;

        if (cLat < 25.8 || cLat > 36.6) continue;
        if (cLng < -107.0 || cLng > -93.5) continue;

        const distToCenter = Math.hypot(cLat - metro.lat, cLng - metro.lng);
        if (distToCenter > metro.radius) continue;

        const i = Math.round((cLat - 25.8) * 100);
        const j = Math.round((cLng - -107.0) * 100);

        const neighbourhood = findNearestNeighbourhood(metro.name, cLat, cLng);
        let name: string;
        let propensity: number;
        if (neighbourhood && !usedNeighbourhoods.has(`${metro.name}:${neighbourhood.name}`)) {
          usedNeighbourhoods.add(`${metro.name}:${neighbourhood.name}`);
          name = neighbourhood.name;
          const jitter = (deterministicNoise(i, j) - 0.5) * 0.1;
          propensity = Math.min(0.97, Math.max(0.05, neighbourhood.basePropensity + jitter));
        } else {
          const compass = COMPASS[(i + j) % COMPASS.length];
          const zipSuffix = ((i * 13 + j * 7) % 90) + 10;
          name = `${metro.name} ${compass} · ${metroZipPrefix(metro.name)}${zipSuffix}`;
          propensity = deterministicNoise(i, j);
        }

        const saturationSeed = (i * 17 + j * 11) % 100;
        let saturationPercent = 0;
        let status: CellStatus;
        if (propensity >= 0.75 && saturationSeed < 60) {
          status = 'ai_suggested';
          saturationPercent = 0;
        } else if (propensity < 0.35) {
          status = 'low_yield';
          saturationPercent = saturationSeed % 25;
        } else {
          status = 'active';
          saturationPercent = 15 + (saturationSeed % 60);
        }

        const densityLabel: 'High' | 'Medium' | 'Low' =
          metro.density === 'high'
            ? propensity > 0.55
              ? 'High'
              : 'Medium'
            : metro.density === 'med'
              ? propensity > 0.55
                ? 'Medium'
                : 'Low'
              : 'Low';

        const medianIncomeCents =
          4_000_000 + Math.round(propensity * 16_000_000 + ((i * 11 + j * 17) % 30) * 100_000);
        const knockableDoors = Math.round(900 + propensity * 4200 + ((i * 5 + j * 9) % 50) * 30);
        const estLiftPp = status === 'ai_suggested' ? Math.round(8 + propensity * 12) : null;

        cells.push({
          id: `cell-${counter++}`,
          name,
          bounds: [
            [lat0, lng0],
            [lat0 + CELL_LAT, lng0 + CELL_LNG],
          ],
          propensity,
          medianIncomeCents,
          estLiftPp,
          knockableDoors,
          saturationPercent,
          status,
          densityLabel,
        });
        metroCount += 1;
      }
      if (metroCount >= maxPerMetro) break;
    }
  }

  // Tag a couple deterministic cells as 'blocked' so the filter pill has data
  const blockedCandidates = cells
    .filter((c) => c.status === 'active' && c.propensity > 0.55 && c.propensity < 0.75)
    .slice(0, 2);
  for (const c of blockedCandidates) c.status = 'blocked';

  return cells;
}

export const ALL_CELLS: ZoneSelection[] = buildCells();

export function getCellCountsByStatus(): Record<CellStatus, number> {
  return ALL_CELLS.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    { ai_suggested: 0, active: 0, blocked: 0, low_yield: 0 } as Record<CellStatus, number>,
  );
}
