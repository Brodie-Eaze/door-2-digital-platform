/**
 * Per-account geo banks — realistic city/state/postcode + neighbourhood
 * clusters so addresses, territories, and rep positions look like a real
 * field operation (Texas metro for US charity, Sydney/Mel/Bne for AU
 * charity, etc.).
 *
 * Coordinates are accurate to within ~0.05° so they pin to the right
 * suburb on a Leaflet map; address numbers are random within the metro's
 * conventional house-number range.
 *
 * FIXTURE — not real PII. Street names are realistic but house numbers are
 * synthetic; nothing here should be confused with a live address.
 */

import type { Rng } from './rng';

export interface GeoCluster {
  /** Pretty display name, e.g. "Austin East" or "Sydney CBD". */
  territory: string;
  /** Bounding lat/lng for rep + address generation. */
  lat: number;
  lng: number;
  /** Spread in degrees around the centroid (~0.03 ≈ 3km in metro lats). */
  jitter: number;
  /** Streets representative of the metro — used as the base for "{N} Foo St". */
  streets: readonly string[];
  /** US state code or AU state for the address suffix. */
  state: string;
  /** Postal code bank (varies within the suburb). */
  postcodes: readonly string[];
}

export interface AccountGeo {
  region: 'US' | 'AU';
  /** Country code prefix used to format phone numbers. */
  phoneCountry: '+1' | '+61';
  /** All clusters available for the account; territory generators sample. */
  clusters: readonly GeoCluster[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hope Forward — Texas-wide US charity. Austin / Dallas-Plano / Houston metro.
// ─────────────────────────────────────────────────────────────────────────────

const HOPE_FORWARD_GEO: AccountGeo = {
  region: 'US',
  phoneCountry: '+1',
  clusters: [
    {
      territory: 'Austin East',
      lat: 30.2672,
      lng: -97.7431,
      jitter: 0.03,
      state: 'TX',
      postcodes: ['78702', '78721', '78723', '78724', '78741'],
      streets: [
        'Manor Rd',
        'E 12th St',
        'Cesar Chavez St',
        'E 7th St',
        'Pleasant Valley Rd',
        'Springdale Rd',
        'Webberville Rd',
        'Lakeview Dr',
        'Bouldin Ave',
        'Linden St',
      ],
    },
    {
      territory: 'Austin South',
      lat: 30.2415,
      lng: -97.7689,
      jitter: 0.03,
      state: 'TX',
      postcodes: ['78704', '78745', '78748', '78749'],
      streets: [
        'S Lamar Blvd',
        'S Congress Ave',
        'Barton Springs Rd',
        'Oltorf St',
        'Travis Heights Blvd',
        'W Mary St',
        'Live Oak St',
        'Bluebonnet Ln',
      ],
    },
    {
      territory: 'Austin North',
      lat: 30.3398,
      lng: -97.7301,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['78751', '78752', '78753', '78757', '78758'],
      streets: [
        'N Lamar Blvd',
        'Burnet Rd',
        'Anderson Ln',
        'Rundberg Ln',
        'Rutherford Ln',
        'Braker Ln',
        'Walnut Creek Pkwy',
      ],
    },
    {
      territory: 'Dallas Metro',
      lat: 32.7821,
      lng: -96.8005,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['75201', '75202', '75204', '75206', '75219'],
      streets: [
        'McKinney Ave',
        'Greenville Ave',
        'Lemmon Ave',
        'Knox St',
        'Cedar Springs Rd',
        'Routh St',
        'Oak Lawn Ave',
        'Henderson Ave',
      ],
    },
    {
      territory: 'Dallas North',
      lat: 32.8651,
      lng: -96.7704,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['75230', '75231', '75240', '75243', '75251'],
      streets: [
        'Forest Ln',
        'Royal Ln',
        'Spring Valley Rd',
        'Belt Line Rd',
        'Preston Rd',
        'Hillcrest Rd',
        'Coit Rd',
        'Arapaho Rd',
      ],
    },
    {
      territory: 'Plano',
      lat: 33.0198,
      lng: -96.6989,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['75023', '75024', '75025', '75074', '75093'],
      streets: [
        'Legacy Dr',
        'Parker Rd',
        'Coit Rd',
        'Independence Pkwy',
        'Custer Rd',
        'Spring Creek Pkwy',
        'Plano Pkwy',
        '15th St',
      ],
    },
    {
      territory: 'Houston Central',
      lat: 29.7589,
      lng: -95.3676,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['77002', '77004', '77006', '77019'],
      streets: [
        'Westheimer Rd',
        'Montrose Blvd',
        'Shepherd Dr',
        'Kirby Dr',
        'Bagby St',
        'Smith St',
        'Travis St',
        'Lamar St',
      ],
    },
    {
      territory: 'Houston SE',
      lat: 29.685,
      lng: -95.295,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['77021', '77033', '77047', '77048', '77051'],
      streets: [
        'MLK Blvd',
        'Cullen Blvd',
        'OST',
        'Scott St',
        'Reed Rd',
        'Holmes Rd',
        'Tierwester St',
        'Sunnyside Dr',
      ],
    },
    {
      territory: 'Houston West',
      lat: 29.7782,
      lng: -95.4612,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['77024', '77055', '77063', '77079'],
      streets: [
        'Memorial Dr',
        'Westheimer Rd',
        'Voss Rd',
        'Fondren Rd',
        'Bunker Hill Rd',
        'Briar Forest Dr',
        'San Felipe St',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// World Vision — AU charity, three-capital footprint.
// ─────────────────────────────────────────────────────────────────────────────

const WORLD_VISION_GEO: AccountGeo = {
  region: 'AU',
  phoneCountry: '+61',
  clusters: [
    {
      territory: 'Sydney CBD',
      lat: -33.8688,
      lng: 151.2093,
      jitter: 0.02,
      state: 'NSW',
      postcodes: ['2000', '2007', '2010', '2011', '2017'],
      streets: [
        'George St',
        'Pitt St',
        'Castlereagh St',
        'Elizabeth St',
        'Crown St',
        'Bourke St',
        'Liverpool St',
        'Goulburn St',
      ],
    },
    {
      territory: 'Sydney Inner West',
      lat: -33.8915,
      lng: 151.1794,
      jitter: 0.03,
      state: 'NSW',
      postcodes: ['2037', '2038', '2040', '2042', '2049'],
      streets: [
        'King St',
        'Enmore Rd',
        'Parramatta Rd',
        'Marrickville Rd',
        'Glebe Point Rd',
        'Stanmore Rd',
        'Norton St',
        'Addison Rd',
      ],
    },
    {
      territory: 'Sydney East',
      lat: -33.8915,
      lng: 151.2767,
      jitter: 0.03,
      state: 'NSW',
      postcodes: ['2021', '2022', '2024', '2025', '2026'],
      streets: [
        'Bondi Rd',
        'Campbell Pde',
        'Oxford St',
        'Old South Head Rd',
        'Bronte Rd',
        'Macpherson St',
        'Edgecliff Rd',
      ],
    },
    {
      territory: 'Sydney West',
      lat: -33.815,
      lng: 151.0,
      jitter: 0.04,
      state: 'NSW',
      postcodes: ['2150', '2151', '2153', '2155', '2160'],
      streets: [
        'Church St',
        'George St',
        'Marsden St',
        'Macquarie St',
        'Hunter St',
        'Argyle St',
        'Smith St',
      ],
    },
    {
      territory: 'Melbourne CBD',
      lat: -37.8136,
      lng: 144.9631,
      jitter: 0.02,
      state: 'VIC',
      postcodes: ['3000', '3002', '3003', '3004', '3006'],
      streets: [
        'Collins St',
        'Bourke St',
        'Flinders St',
        'Lonsdale St',
        'Spencer St',
        'Spring St',
        'King St',
        'William St',
      ],
    },
    {
      territory: 'Melbourne North',
      lat: -37.7693,
      lng: 144.9598,
      jitter: 0.03,
      state: 'VIC',
      postcodes: ['3052', '3053', '3054', '3056', '3057'],
      streets: [
        'Sydney Rd',
        'Lygon St',
        'Brunswick St',
        'Smith St',
        'Rathdowne St',
        'Nicholson St',
        'Royal Pde',
      ],
    },
    {
      territory: 'Melbourne East',
      lat: -37.8425,
      lng: 145.0033,
      jitter: 0.03,
      state: 'VIC',
      postcodes: ['3122', '3123', '3124', '3142', '3143'],
      streets: [
        'Glenferrie Rd',
        'High St',
        'Toorak Rd',
        'Burke Rd',
        'Camberwell Rd',
        'Whitehorse Rd',
        'Riversdale Rd',
      ],
    },
    {
      territory: 'Brisbane CBD',
      lat: -27.4698,
      lng: 153.0251,
      jitter: 0.02,
      state: 'QLD',
      postcodes: ['4000', '4101', '4102', '4006'],
      streets: [
        'Queen St',
        'Adelaide St',
        'Edward St',
        'Albert St',
        'Mary St',
        'Charlotte St',
        'Ann St',
        'Wickham Tce',
      ],
    },
    {
      territory: 'Brisbane North',
      lat: -27.3854,
      lng: 153.0341,
      jitter: 0.03,
      state: 'QLD',
      postcodes: ['4030', '4031', '4032', '4034', '4017'],
      streets: [
        'Gympie Rd',
        'Hamilton Rd',
        'Beams Rd',
        'Webster Rd',
        'Banks St',
        'Murphy Rd',
        'Telegraph Rd',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PestMax — commercial pest, TX + AZ.
// ─────────────────────────────────────────────────────────────────────────────

const PESTMAX_GEO: AccountGeo = {
  region: 'US',
  phoneCountry: '+1',
  clusters: [
    {
      territory: 'Dallas Metro',
      lat: 32.7821,
      lng: -96.8005,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['75201', '75204', '75219', '75235'],
      streets: [
        'McKinney Ave',
        'Lemmon Ave',
        'Greenville Ave',
        'Knox St',
        'Oak Lawn Ave',
        'Cedar Springs Rd',
        'Routh St',
      ],
    },
    {
      territory: 'Dallas North',
      lat: 32.8651,
      lng: -96.7704,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['75230', '75231', '75240', '75251'],
      streets: [
        'Preston Rd',
        'Forest Ln',
        'Royal Ln',
        'Coit Rd',
        'Hillcrest Rd',
        'Spring Valley Rd',
        'Belt Line Rd',
      ],
    },
    {
      territory: 'Dallas South',
      lat: 32.7167,
      lng: -96.797,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['75203', '75208', '75215', '75216'],
      streets: [
        'Davis St',
        'Jefferson Blvd',
        'Beckley Ave',
        'Hampton Rd',
        '8th St',
        'Polk St',
        'Llewellyn Ave',
      ],
    },
    {
      territory: 'Phoenix Metro',
      lat: 33.4484,
      lng: -112.074,
      jitter: 0.04,
      state: 'AZ',
      postcodes: ['85003', '85004', '85007', '85014', '85016'],
      streets: [
        'Camelback Rd',
        'Thomas Rd',
        'Indian School Rd',
        'Bethany Home Rd',
        'Central Ave',
        '7th St',
        '24th St',
        'McDowell Rd',
      ],
    },
    {
      territory: 'Phoenix West',
      lat: 33.4625,
      lng: -112.1891,
      jitter: 0.04,
      state: 'AZ',
      postcodes: ['85031', '85033', '85035', '85037'],
      streets: [
        'W Thomas Rd',
        'W Indian School Rd',
        'W Camelback Rd',
        '51st Ave',
        '43rd Ave',
        '75th Ave',
      ],
    },
    {
      territory: 'Scottsdale',
      lat: 33.4942,
      lng: -111.926,
      jitter: 0.04,
      state: 'AZ',
      postcodes: ['85251', '85254', '85257', '85258'],
      streets: [
        'Scottsdale Rd',
        'Hayden Rd',
        'Camelback Rd',
        'Frank Lloyd Wright Blvd',
        'McDonald Dr',
        'Indian Bend Rd',
      ],
    },
    {
      territory: 'Houston SE',
      lat: 29.685,
      lng: -95.295,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['77021', '77033', '77047', '77048'],
      streets: ['MLK Blvd', 'Cullen Blvd', 'OST', 'Reed Rd', 'Tierwester St'],
    },
    {
      territory: 'Cypress',
      lat: 29.9691,
      lng: -95.6972,
      jitter: 0.04,
      state: 'TX',
      postcodes: ['77429', '77433', '77410'],
      streets: ['Barker Cypress Rd', 'Spring Cypress Rd', 'Telge Rd', 'Mueschke Rd', 'Fry Rd'],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Gold Coast Hospital — tight suburb zoom.
// ─────────────────────────────────────────────────────────────────────────────

const GOLD_COAST_GEO: AccountGeo = {
  region: 'AU',
  phoneCountry: '+61',
  clusters: [
    {
      territory: 'Surfers Paradise',
      lat: -28.0033,
      lng: 153.4297,
      jitter: 0.012,
      state: 'QLD',
      postcodes: ['4217'],
      streets: [
        'Cavill Ave',
        'Esplanade',
        'Orchid Ave',
        'Hanlan St',
        'Garfield Tce',
        'Markwell Ave',
        'Trickett St',
      ],
    },
    {
      territory: 'Broadbeach',
      lat: -28.029,
      lng: 153.4351,
      jitter: 0.012,
      state: 'QLD',
      postcodes: ['4218'],
      streets: [
        'Old Burleigh Rd',
        'Surf Pde',
        'Albert Ave',
        'Hooker Blvd',
        'TE Peters Dr',
        'Charles Ave',
      ],
    },
    {
      territory: 'Mermaid Waters',
      lat: -28.04,
      lng: 153.42,
      jitter: 0.012,
      state: 'QLD',
      postcodes: ['4218'],
      streets: ['Markeri St', 'Bermuda St', 'Lake Orr Dr', 'Sunshine Blvd', 'Pacific Ave'],
    },
    {
      territory: 'Burleigh Heads',
      lat: -28.0995,
      lng: 153.4503,
      jitter: 0.015,
      state: 'QLD',
      postcodes: ['4220'],
      streets: [
        'Goodwin Tce',
        'W Burleigh Rd',
        'James St',
        'The Esplanade',
        'Connor St',
        'Tallebudgera Dr',
      ],
    },
    {
      territory: 'Robina',
      lat: -28.0815,
      lng: 153.3899,
      jitter: 0.015,
      state: 'QLD',
      postcodes: ['4226'],
      streets: [
        'Robina Town Centre Dr',
        'Bermuda St',
        'Christine Ave',
        'University Dr',
        'Robina Pkwy',
      ],
    },
    {
      territory: 'Southport',
      lat: -27.9667,
      lng: 153.4034,
      jitter: 0.015,
      state: 'QLD',
      postcodes: ['4215'],
      streets: [
        'Scarborough St',
        'Nerang St',
        'Marine Pde',
        'Queen St',
        'Frank St',
        'Davenport St',
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ACCOUNT_GEO: Record<string, AccountGeo> = {
  'hope-forward': HOPE_FORWARD_GEO,
  'world-vision': WORLD_VISION_GEO,
  pestmax: PESTMAX_GEO,
  'gold-coast-hospital': GOLD_COAST_GEO,
};

export function getAccountGeo(slug: string): AccountGeo {
  return ACCOUNT_GEO[slug] ?? HOPE_FORWARD_GEO;
}

/**
 * Snap a (lat, lng) into the supplied cluster with deterministic jitter
 * controlled by the RNG. Returns a coordinate within `cluster.jitter` of
 * the centroid.
 */
export function snapToCluster(rng: Rng, cluster: GeoCluster): { lat: number; lng: number } {
  // Uniform-square jitter — produces "spread across the metro" rather than
  // "clustered tightly at the centroid", which is what a real fleet looks
  // like over a 4hr shift.
  const dLat = (rng.next() - 0.5) * 2 * cluster.jitter;
  const dLng = (rng.next() - 0.5) * 2 * cluster.jitter;
  return { lat: +(cluster.lat + dLat).toFixed(5), lng: +(cluster.lng + dLng).toFixed(5) };
}

/**
 * Generate a plausible street address inside a cluster.
 */
export function fixtureAddress(rng: Rng, cluster: GeoCluster): string {
  const houseNum = rng.int(2, 4) === 2 ? rng.int(1, 99) : rng.int(100, 9999);
  const street = rng.pick(cluster.streets);
  const post = rng.pick(cluster.postcodes);
  const city = cluster.territory.split(' ')[0]!;
  // US format: "{num} {street}, {city} {state} {zip}"
  // AU format: "{num} {street}, {city} {state} {postcode}"
  return `${houseNum} ${street}, ${city} ${cluster.state} ${post}`;
}

/**
 * Generate a phone number in the requested country format. FIXTURE — these
 * use 555-prefix US numbers and the 0455 prefix block (reserved for testing
 * in AU) so they cannot dial to real subscribers.
 */
export function fixturePhone(rng: Rng, country: '+1' | '+61'): string {
  if (country === '+61') {
    // 04 55 + 6 digits → AU reserved testing range
    return `+61455${String(rng.int(100_000, 999_999))}`;
  }
  // US 555-line, area code 512/214/713/602 (Austin/Dallas/Houston/Phoenix)
  const area = rng.pick(['512', '214', '713', '602', '480']);
  return `+1${area}555${String(rng.int(1000, 9999))}`;
}
