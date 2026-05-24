/**
 * Attribution rake calculator — computes D2D's bucket-based take rate
 * from a conversion's amount + attribution source.
 *
 * Per the locked Pilot-Charlie contract (configurable per org):
 *   - Platform fee:  $2,500/mo flat (handled by billing service, not here)
 *   - Door:          15% of conversion amount
 *   - Inside sales:  10%
 *   - Retargeting:    5%
 *
 * Stored on each `Conversion` row alongside `processorResidualCents`.
 */
import type { AttributionSource } from '@d2d/shared-types';
import { takeRate, type Money } from './money';

export interface RakeBuckets {
  doorPercent: number;
  insideSalesPercent: number;
  retargetingPercent: number;
  otherPercent: number;
}

export const DEFAULT_RAKE_BUCKETS: RakeBuckets = {
  doorPercent: 15,
  insideSalesPercent: 10,
  retargetingPercent: 5,
  otherPercent: 0,
};

/**
 * Resolve the rake percent for a conversion's attribution source.
 */
export function ratePercentForSource(
  source: AttributionSource,
  buckets: RakeBuckets = DEFAULT_RAKE_BUCKETS,
): number {
  switch (source) {
    case 'door':
      return buckets.doorPercent;
    case 'inside_sales':
      return buckets.insideSalesPercent;
    case 'retargeting':
      return buckets.retargetingPercent;
    case 'other':
      return buckets.otherPercent;
  }
}

/**
 * Compute D2D's rake for a single conversion.
 */
export function computeRake(
  amount: Money,
  source: AttributionSource,
  buckets: RakeBuckets = DEFAULT_RAKE_BUCKETS,
): Money {
  return takeRate(amount, ratePercentForSource(source, buckets));
}
