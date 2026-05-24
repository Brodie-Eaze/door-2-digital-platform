/**
 * RegionGuard — asserts that the org being mutated lives in the same region
 * as the current API process. Per ADR-0016, region pinning is enforced at
 * the write path. Mismatches return 403 + write an audit row.
 */
import type { FastifyRequest } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { env } from '../../config/env';

export interface OrgContext {
  orgId: string;
  regionCode: string;
}

/**
 * Throws ProblemError(region-mismatch) if the org's region does not match
 * the deploy region. Call this in every controller that mutates regulated
 * data, before any DB write.
 */
export function assertRegionMatches(org: OrgContext, _req: FastifyRequest): void {
  const deployRegionShort = mapAwsRegionToRegionCode(env().AWS_REGION);
  if (org.regionCode !== deployRegionShort) {
    throw new ProblemError(Problems.regionMismatch(deployRegionShort, org.regionCode));
  }
}

function mapAwsRegionToRegionCode(awsRegion: string): string {
  if (awsRegion.startsWith('us-')) return 'US';
  if (awsRegion === 'ap-southeast-2') return 'AU';
  if (awsRegion === 'ap-southeast-1') return 'SG';
  // Unknown — default to US for dev so local-only AWS_REGION doesn't fail.
  return 'US';
}
