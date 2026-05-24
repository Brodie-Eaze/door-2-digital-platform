/**
 * Marketing routes — Phase 0 stubs.
 *
 * Full implementation Phase 3 (retargeting + AI ad delivery):
 *   - POST /v1/marketing/ad-accounts/link          start OAuth link to Meta/Google/TikTok/YouTube
 *   - GET  /v1/marketing/ad-accounts/callback      OAuth return URL handler
 *   - GET  /v1/marketing/ad-accounts               list linked ad accounts + token health
 *   - POST /v1/marketing/creatives/generate        kick off content-studio job for ad creative
 *   - GET  /v1/marketing/creatives                 list generated creatives (filter campaign, status)
 *   - POST /v1/marketing/audiences/build           build retargeting audience from knocks/leads/visits
 *   - POST /v1/marketing/campaigns                 create campaign locally (pre-delivery)
 *   - POST /v1/marketing/campaigns/deliver         deliver campaign to ad network (Meta/Google/TikTok)
 *   - PATCH /v1/marketing/campaigns/:id/pause      pause delivery
 *   - GET  /v1/marketing/campaigns/:id/metrics     spend + impressions + attributable conversions
 *
 * Cross-cutting:
 *   - Audience custom-list uploads only ever leave the region as hashed identifiers (sha256
 *     of email/phone per ad-network spec). Plaintext PII never leaves the region.
 *   - Brand-safety checks (Phase 3) sit between `creatives/generate` and `deliver`.
 *   - Spend tracking in BigInt cents; reconciled nightly against ad-network reporting API.
 */
import type { FastifyInstance } from 'fastify';
import {
  linkAdAccountRequestSchema,
  generateCreativeRequestSchema,
  deliverCampaignRequestSchema,
} from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerMarketing(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'marketing', status: 'scaffold', phase: '3' }));

  app.post('/ad-accounts/link', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = linkAdAccountRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Marketing ad-account OAuth link lands in Phase 3',
    });
  });

  app.post('/creatives/generate', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = generateCreativeRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Marketing creative generation lands in Phase 3',
    });
  });

  app.post('/campaigns/deliver', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = deliverCampaignRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Marketing campaign delivery lands in Phase 3',
    });
  });
}
