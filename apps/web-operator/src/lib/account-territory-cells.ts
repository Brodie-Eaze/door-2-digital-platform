/**
 * Per-account territory cell registry.
 *
 * Mirrors the shape/scoring of `territoryCells.ts` (HQ Texas-wide) but scopes
 * cells to each sub-account's operating region:
 *   - hope-forward         → full Texas span (re-use ALL_CELLS, broad filter)
 *   - pestmax              → Dallas-FW + Houston + Phoenix
 *   - world-vision         → Sydney + Melbourne + Brisbane
 *   - gold-coast-hospital  → tight zoom on Gold Coast suburbs
 *
 * Each account gets a Leaflet-friendly center/zoom + scope label that the
 * <TerritoryHeatmap> wrapper uses to render the same interactive map HQ has.
 */

import { ALL_CELLS, type ZoneSelection, type CellStatus } from '@/components/territoryCells';

export type Cell = ZoneSelection;

export interface AccountTerritoryData {
  cells: Cell[];
  center: [number, number];
  defaultZoom: number;
  scopeLabel: string;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function deterministicNoise(i: number, j: number): number {
  const v = 0.5 + 0.5 * Math.sin(i * 0.7 + 0.3) * Math.cos(j * 0.31 + 0.7);
  return Math.min(1, Math.max(0, v));
}

type Metro = {
  name: string;
  lat: number;
  lng: number;
  radius: number; // degrees
  density: 'high' | 'med' | 'low';
  maxCells: number;
  zipPrefix: string;
  /** Currency: 'usd' or 'aud' — controls median income scale. */
  currency: 'usd' | 'aud';
};

type Neighbourhood = {
  name: string;
  lat: number;
  lng: number;
  basePropensity: number;
  /** Optional override of the metro's median income center (cents). */
  incomeOverrideCents?: number;
};

const COMPASS = ['North', 'South', 'East', 'West', 'Central', 'NW', 'NE', 'SW', 'SE'];

/** Build a set of cells for a metro list + matching neighbourhood map. */
function generateMetroCells(opts: {
  metros: Metro[];
  neighbourhoods: Record<string, Neighbourhood[]>;
  cellLat: number;
  cellLng: number;
  idPrefix: string;
  /** Optional lat/lng bounding box to clip outside cells. */
  clipBounds?: { south: number; north: number; west: number; east: number };
}): Cell[] {
  const { metros, neighbourhoods, cellLat, cellLng, idPrefix, clipBounds } = opts;
  const cells: Cell[] = [];
  const seen = new Set<string>();
  const usedNeighbourhoods = new Set<string>();
  let counter = 0;

  for (const metro of metros) {
    let metroCount = 0;

    for (let lat = metro.lat - metro.radius; lat <= metro.lat + metro.radius; lat += cellLat) {
      for (let lng = metro.lng - metro.radius; lng <= metro.lng + metro.radius; lng += cellLng) {
        if (metroCount >= metro.maxCells) break;

        const lat0 = Math.round(lat * 1000) / 1000;
        const lng0 = Math.round(lng * 1000) / 1000;
        const id = `${lat0.toFixed(3)}_${lng0.toFixed(3)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const cLat = lat0 + cellLat / 2;
        const cLng = lng0 + cellLng / 2;

        if (clipBounds) {
          if (cLat < clipBounds.south || cLat > clipBounds.north) continue;
          if (cLng < clipBounds.west || cLng > clipBounds.east) continue;
        }

        const distToCenter = Math.hypot(cLat - metro.lat, cLng - metro.lng);
        if (distToCenter > metro.radius) continue;

        // Deterministic noise indices stable across reloads
        const i = Math.round((cLat - (clipBounds?.south ?? metro.lat - 5)) * 100);
        const j = Math.round((cLng - (clipBounds?.west ?? metro.lng - 5)) * 100);

        // Snap to a known neighbourhood if close enough
        const list = neighbourhoods[metro.name] ?? [];
        let bestNeighbourhood: { n: Neighbourhood; dist: number } | null = null;
        for (const n of list) {
          const d = Math.hypot(n.lat - cLat, n.lng - cLng);
          if (!bestNeighbourhood || d < bestNeighbourhood.dist) bestNeighbourhood = { n, dist: d };
        }
        const matched =
          bestNeighbourhood && bestNeighbourhood.dist <= Math.max(cellLat, cellLng) * 2
            ? bestNeighbourhood.n
            : null;

        let name: string;
        let propensity: number;
        let incomeOverride: number | undefined;
        if (matched && !usedNeighbourhoods.has(`${metro.name}:${matched.name}`)) {
          usedNeighbourhoods.add(`${metro.name}:${matched.name}`);
          name = matched.name;
          const jitter = (deterministicNoise(i, j) - 0.5) * 0.1;
          propensity = Math.min(0.97, Math.max(0.05, matched.basePropensity + jitter));
          incomeOverride = matched.incomeOverrideCents;
        } else {
          const compass = COMPASS[(i + j + counter) % COMPASS.length];
          const zipSuffix = ((i * 13 + j * 7) % 90) + 10;
          name = `${metro.name} ${compass} · ${metro.zipPrefix}${zipSuffix}`;
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

        // USD baseline ≈ $40k–$200k; AUD baseline ≈ A$55k–A$220k (slightly higher)
        const incomeBaseCents = metro.currency === 'aud' ? 5_500_000 : 4_000_000;
        const incomeMaxLiftCents = metro.currency === 'aud' ? 17_000_000 : 16_000_000;
        const medianIncomeCents =
          incomeOverride ??
          incomeBaseCents +
            Math.round(propensity * incomeMaxLiftCents + ((i * 11 + j * 17) % 30) * 100_000);

        const knockableDoors = Math.round(900 + propensity * 4200 + ((i * 5 + j * 9) % 50) * 30);
        const estLiftPp = status === 'ai_suggested' ? Math.round(8 + propensity * 12) : null;

        cells.push({
          id: `${idPrefix}-${counter++}`,
          name,
          bounds: [
            [lat0, lng0],
            [lat0 + cellLat, lng0 + cellLng],
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
      if (metroCount >= metro.maxCells) break;
    }
  }

  // Promote two deterministic active cells to 'blocked' so the filter pill has data
  const blockedCandidates = cells
    .filter((c) => c.status === 'active' && c.propensity > 0.55 && c.propensity < 0.75)
    .slice(0, 2);
  for (const c of blockedCandidates) c.status = 'blocked';

  return cells;
}

// ─── PestMax · TX (Dallas + Houston) + AZ (Phoenix) ─────────────────────────

function generatePestMaxCells(): Cell[] {
  // Filter HQ Texas cells to just Dallas-FW + Houston (drop Austin/SA/El Paso/Corpus)
  const txCells = ALL_CELLS.filter((c) => {
    const [[s, w]] = c.bounds;
    const cLat = s + 0.06; // half of CELL_LAT
    const cLng = w + 0.075; // half of CELL_LNG
    // Dallas-FW box ~32.1–33.5N, 97.5–96.1W ; Houston box ~29.1–30.5N, 96.1–94.7W
    const inDallas = cLat >= 32.1 && cLat <= 33.5 && cLng >= -97.55 && cLng <= -96.1;
    const inHouston = cLat >= 29.1 && cLat <= 30.5 && cLng >= -96.1 && cLng <= -94.7;
    return inDallas || inHouston;
  });

  // Phoenix metro cells
  const azCells = generateMetroCells({
    metros: [
      {
        name: 'Phoenix',
        lat: 33.4484,
        lng: -112.074,
        radius: 0.4,
        density: 'high',
        maxCells: 24,
        zipPrefix: '852',
        currency: 'usd',
      },
    ],
    neighbourhoods: {
      Phoenix: [
        { name: 'Scottsdale · 85254', lat: 33.6248, lng: -111.9252, basePropensity: 0.78 },
        { name: 'Tempe · 85281', lat: 33.4255, lng: -111.94, basePropensity: 0.71 },
        { name: 'Mesa · 85201', lat: 33.4152, lng: -111.8315, basePropensity: 0.66 },
        { name: 'Chandler · 85224', lat: 33.3062, lng: -111.8413, basePropensity: 0.74 },
        { name: 'Gilbert · 85234', lat: 33.3528, lng: -111.789, basePropensity: 0.77 },
        { name: 'Glendale · 85301', lat: 33.5387, lng: -112.186, basePropensity: 0.61 },
      ],
    },
    cellLat: 0.1,
    cellLng: 0.12,
    idPrefix: 'pm-az',
    clipBounds: { south: 33.0, north: 33.9, west: -112.6, east: -111.5 },
  });

  return [...txCells, ...azCells];
}

// ─── World Vision · AU (Sydney + Melbourne + Brisbane) ──────────────────────

function generateAuCells(): Cell[] {
  return generateMetroCells({
    metros: [
      {
        name: 'Sydney',
        lat: -33.8688,
        lng: 151.2093,
        radius: 0.5,
        density: 'high',
        maxCells: 42,
        zipPrefix: '20',
        currency: 'aud',
      },
      {
        name: 'Melbourne',
        lat: -37.8136,
        lng: 144.9631,
        radius: 0.5,
        density: 'high',
        maxCells: 42,
        zipPrefix: '30',
        currency: 'aud',
      },
      {
        name: 'Brisbane',
        lat: -27.4698,
        lng: 153.0251,
        radius: 0.45,
        density: 'high',
        maxCells: 35,
        zipPrefix: '40',
        currency: 'aud',
      },
    ],
    neighbourhoods: {
      Sydney: [
        {
          name: 'Parramatta · 2150',
          lat: -33.815,
          lng: 151.0,
          basePropensity: 0.79,
          incomeOverrideCents: 9_400_000,
        },
        {
          name: 'Bondi · 2026',
          lat: -33.8915,
          lng: 151.2767,
          basePropensity: 0.74,
          incomeOverrideCents: 12_800_000,
        },
        {
          name: 'Mosman · 2088',
          lat: -33.8273,
          lng: 151.2435,
          basePropensity: 0.58,
          incomeOverrideCents: 18_400_000,
        },
        {
          name: 'Newtown · 2042',
          lat: -33.8978,
          lng: 151.1794,
          basePropensity: 0.77,
          incomeOverrideCents: 8_900_000,
        },
        {
          name: 'Chatswood · 2067',
          lat: -33.7969,
          lng: 151.1828,
          basePropensity: 0.72,
          incomeOverrideCents: 11_200_000,
        },
        {
          name: 'Manly · 2095',
          lat: -33.7969,
          lng: 151.2858,
          basePropensity: 0.66,
          incomeOverrideCents: 13_600_000,
        },
        {
          name: 'Liverpool · 2170',
          lat: -33.9215,
          lng: 150.9239,
          basePropensity: 0.68,
          incomeOverrideCents: 7_200_000,
        },
        {
          name: 'Penrith · 2750',
          lat: -33.7507,
          lng: 150.6877,
          basePropensity: 0.64,
          incomeOverrideCents: 7_800_000,
        },
      ],
      Melbourne: [
        {
          name: 'Brunswick · 3056',
          lat: -37.7693,
          lng: 144.9598,
          basePropensity: 0.82,
          incomeOverrideCents: 8_800_000,
        },
        {
          name: 'Carlton · 3053',
          lat: -37.7989,
          lng: 144.967,
          basePropensity: 0.71,
          incomeOverrideCents: 9_200_000,
        },
        {
          name: 'Toorak · 3142',
          lat: -37.8417,
          lng: 145.0148,
          basePropensity: 0.48,
          incomeOverrideCents: 19_800_000,
        },
        {
          name: 'St Kilda · 3182',
          lat: -37.8676,
          lng: 144.9786,
          basePropensity: 0.74,
          incomeOverrideCents: 9_600_000,
        },
        {
          name: 'Footscray · 3011',
          lat: -37.7997,
          lng: 144.9011,
          basePropensity: 0.76,
          incomeOverrideCents: 7_400_000,
        },
        {
          name: 'Dandenong · 3175',
          lat: -37.9806,
          lng: 145.2147,
          basePropensity: 0.69,
          incomeOverrideCents: 6_800_000,
        },
        {
          name: 'Frankston · 3199',
          lat: -38.143,
          lng: 145.1226,
          basePropensity: 0.65,
          incomeOverrideCents: 7_100_000,
        },
        {
          name: 'Box Hill · 3128',
          lat: -37.8194,
          lng: 145.1224,
          basePropensity: 0.73,
          incomeOverrideCents: 10_400_000,
        },
      ],
      Brisbane: [
        {
          name: 'Chermside · 4032',
          lat: -27.3854,
          lng: 153.0341,
          basePropensity: 0.76,
          incomeOverrideCents: 8_400_000,
        },
        {
          name: 'Fortitude Valley · 4006',
          lat: -27.4564,
          lng: 153.0344,
          basePropensity: 0.78,
          incomeOverrideCents: 9_800_000,
        },
        {
          name: 'West End · 4101',
          lat: -27.482,
          lng: 153.0084,
          basePropensity: 0.75,
          incomeOverrideCents: 9_400_000,
        },
        {
          name: 'Indooroopilly · 4068',
          lat: -27.5022,
          lng: 152.9737,
          basePropensity: 0.7,
          incomeOverrideCents: 10_200_000,
        },
        {
          name: 'Mt Gravatt · 4122',
          lat: -27.5331,
          lng: 153.0813,
          basePropensity: 0.67,
          incomeOverrideCents: 7_900_000,
        },
        {
          name: 'Sandgate · 4017',
          lat: -27.3196,
          lng: 153.0654,
          basePropensity: 0.62,
          incomeOverrideCents: 7_600_000,
        },
        {
          name: 'Sunnybank · 4109',
          lat: -27.5814,
          lng: 153.0577,
          basePropensity: 0.71,
          incomeOverrideCents: 8_100_000,
        },
      ],
    },
    cellLat: 0.1,
    cellLng: 0.12,
    idPrefix: 'wv-au',
    clipBounds: { south: -38.5, north: -27.0, west: 144.4, east: 153.6 },
  });
}

// ─── Gold Coast Hospital · QLD (tight suburb zoom) ──────────────────────────

function generateGoldCoastCells(): Cell[] {
  return generateMetroCells({
    metros: [
      {
        name: 'Gold Coast',
        lat: -28.02,
        lng: 153.4,
        radius: 0.18,
        density: 'high',
        maxCells: 38,
        zipPrefix: '42',
        currency: 'aud',
      },
    ],
    neighbourhoods: {
      'Gold Coast': [
        {
          name: 'Surfers Paradise · 4217',
          lat: -28.0033,
          lng: 153.4297,
          basePropensity: 0.81,
          incomeOverrideCents: 9_600_000,
        },
        {
          name: 'Broadbeach · 4218',
          lat: -28.029,
          lng: 153.4351,
          basePropensity: 0.78,
          incomeOverrideCents: 9_200_000,
        },
        {
          name: 'Burleigh Heads · 4220',
          lat: -28.0995,
          lng: 153.4503,
          basePropensity: 0.74,
          incomeOverrideCents: 8_700_000,
        },
        {
          name: 'Robina · 4226',
          lat: -28.0815,
          lng: 153.3899,
          basePropensity: 0.77,
          incomeOverrideCents: 10_400_000,
        },
        {
          name: 'Southport · 4215',
          lat: -27.9667,
          lng: 153.4034,
          basePropensity: 0.69,
          incomeOverrideCents: 7_800_000,
        },
        {
          name: 'Mermaid Waters · 4218',
          lat: -28.04,
          lng: 153.42,
          basePropensity: 0.78,
          incomeOverrideCents: 11_200_000,
        },
        {
          name: 'Tweed Heads · 2485',
          lat: -28.18,
          lng: 153.55,
          basePropensity: 0.66,
          incomeOverrideCents: 7_400_000,
        },
        {
          name: 'Nerang · 4211',
          lat: -28.0,
          lng: 153.34,
          basePropensity: 0.71,
          incomeOverrideCents: 7_900_000,
        },
      ],
    },
    cellLat: 0.02,
    cellLng: 0.025,
    idPrefix: 'gc-qld',
    clipBounds: { south: -28.25, north: -27.85, west: 153.25, east: 153.6 },
  });
}

// ─── Registry ──────────────────────────────────────────────────────────────

export const ACCOUNT_TERRITORY: Record<string, AccountTerritoryData> = {
  // Hope Forward — full Texas span (charity, big operation)
  'hope-forward': {
    cells: ALL_CELLS.filter((c) => {
      const [[s, w]] = c.bounds;
      return s >= 25 && s <= 35 && w >= -107 && w <= -93;
    }),
    center: [31.0, -97.5],
    defaultZoom: 6,
    scopeLabel: 'Hope Forward · Texas',
  },
  pestmax: {
    cells: generatePestMaxCells(),
    center: [33.0, -100.0],
    defaultZoom: 5,
    scopeLabel: 'PestMax · TX + AZ',
  },
  'world-vision': {
    cells: generateAuCells(),
    center: [-30.0, 144.0],
    defaultZoom: 5,
    scopeLabel: 'World Vision · AU',
  },
  'gold-coast-hospital': {
    cells: generateGoldCoastCells(),
    center: [-28.02, 153.4],
    defaultZoom: 11,
    scopeLabel: 'Gold Coast Hospital · QLD',
  },
};

export function getAccountTerritory(slug: string): AccountTerritoryData | undefined {
  return ACCOUNT_TERRITORY[slug];
}
