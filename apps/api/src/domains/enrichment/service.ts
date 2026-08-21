/**
 * Address enrichment service — Snowflake Data Marketplace.
 *
 * Joins Experian consumer view, Claritas PRIZM segments, SafeGraph neighbourhood
 * density, and Census ACS tract-level data against D2D's own address table.
 *
 * Results are written to PropensityScore with:
 *   geoType = 'address'
 *   geoKey  = address.id
 *   modelName = 'snowflake-enrichment'
 *
 * The score is normalised to [0, 1] from the raw Snowflake signals so it
 * sits alongside other propensity models in the same table.
 *
 * Fire-and-forget pattern: callers dispatch via enqueueEnrichAddress() after
 * a knock is saved. This function never blocks the knock write path.
 */

import type { RegionCode } from '@prisma/client';
import { sfQuery } from '../../config/snowflake';
import { writeScores } from '../propensity/service';
import type { ScoreInput } from '../propensity/schemas';
import { logger } from '../../config/logger';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

// Snowflake JOIN result shape — column names are UPPER_CASE from the SDK.
interface EnrichRow {
  ADDRESS_ID: string;
  CHARITABLE_PROPENSITY: number | null;
  ESTIMATED_HOME_VALUE: number | null;
  PRIZM_CODE: string | null;
  PRIZM_NAME: string | null;
  MEDIAN_HH_INCOME: number | null;
  HOME_POPULATION_DENSITY: number | null;
  OWNER_OCCUPANCY_RATE: number | null;
  POVERTY_RATE: number | null;
}

// Snowflake SDK doesn't support IN (?) with a single array bind — expand to
// individual ? markers per element.
const buildInClause = (count: number) => Array(count).fill('?').join(',');

const ENRICH_SQL = (placeholders: string) => `
  SELECT
    a.ID                          AS ADDRESS_ID,
    e.CHARITABLE_PROPENSITY       AS CHARITABLE_PROPENSITY,
    e.ESTIMATED_HOME_VALUE        AS ESTIMATED_HOME_VALUE,
    c.PRIZM_CODE                  AS PRIZM_CODE,
    c.PRIZM_NAME                  AS PRIZM_NAME,
    c.MEDIAN_HH_INCOME            AS MEDIAN_HH_INCOME,
    s.HOME_POPULATION_DENSITY     AS HOME_POPULATION_DENSITY,
    acs.OWNER_OCCUPANCY_RATE      AS OWNER_OCCUPANCY_RATE,
    acs.POVERTY_RATE              AS POVERTY_RATE
  FROM D2D_INTERNAL.PUBLIC.ADDRESSES a
  LEFT JOIN EXPERIAN.CONSUMER_VIEW.HOUSEHOLDS e
    ON e.ADDRESS_HASH = SHA2(LOWER(a.FORMATTED_ADDRESS))
  LEFT JOIN CLARITAS.PRIZM.SEGMENTS c
    ON c.ZIP_CODE = a.POSTCODE
  LEFT JOIN SAFEGRAPH.PATTERNS.NEIGHBORHOOD s
    ON s.CENSUS_TRACT = a.CENSUS_TRACT
  LEFT JOIN CENSUS.ACS.TRACT_5YR acs
    ON acs.GEO_ID = a.CENSUS_TRACT
  WHERE a.ID IN (${placeholders})
`;

function normaliseScore(row: EnrichRow): number {
  let score = 0.1; // base

  // Charitable propensity: 0-100 → 0-0.4 weight
  if (row.CHARITABLE_PROPENSITY != null) {
    score += Math.min(row.CHARITABLE_PROPENSITY / 100, 1) * 0.4;
  }

  // Home value signal: $300k+ home = max contribution
  if (row.ESTIMATED_HOME_VALUE != null) {
    score += Math.min(row.ESTIMATED_HOME_VALUE / 300_000, 1) * 0.2;
  }

  // Owner-occupancy: renters churn, owners convert → 0-0.2 weight
  if (row.OWNER_OCCUPANCY_RATE != null) {
    score += row.OWNER_OCCUPANCY_RATE * 0.2;
  }

  // Low poverty = higher conversion → inverse 0-0.1 weight
  if (row.POVERTY_RATE != null) {
    score += Math.max(0, 1 - row.POVERTY_RATE) * 0.1;
  }

  return Math.min(score, 1);
}

export async function enrichAddresses(addressIds: string[], actor: ActorContext): Promise<void> {
  if (addressIds.length === 0) return;

  const log = logger().child({ service: 'enrichment', count: addressIds.length });

  let rows: EnrichRow[];
  try {
    const placeholders = buildInClause(addressIds.length);
    rows = await sfQuery<EnrichRow>(ENRICH_SQL(placeholders), addressIds);
  } catch (err) {
    log.error({ err }, 'enrichment: snowflake query failed — skipping');
    return;
  }

  if (rows.length === 0) {
    log.info('enrichment: no rows returned from Snowflake');
    return;
  }

  const scores: ScoreInput[] = rows.map((r) => ({
    geoType: 'address',
    geoKey: r.ADDRESS_ID,
    score: normaliseScore(r),
    // centroidLat/Lng omitted — address scores carry no centroid (the address
    // already resolves to a point); the heatmap excludes NULL-centroid rows.
    features: {
      charitablePropensity: r.CHARITABLE_PROPENSITY,
      estimatedHomeValueUsd: r.ESTIMATED_HOME_VALUE,
      prizmCode: r.PRIZM_CODE,
      prizmName: r.PRIZM_NAME,
      medianHhIncomeUsd: r.MEDIAN_HH_INCOME,
      homePopulationDensity: r.HOME_POPULATION_DENSITY,
      ownerOccupancyRate: r.OWNER_OCCUPANCY_RATE,
      povertyRate: r.POVERTY_RATE,
    },
  }));

  try {
    await writeScores(
      { scores, modelName: 'snowflake-enrichment', modelVersion: 'v1' },
      { ...actor, role: 'super_admin' },
    );
    log.info({ upserted: scores.length }, 'enrichment: scores written');
  } catch (err) {
    log.error({ err }, 'enrichment: writeScores failed');
  }
}
