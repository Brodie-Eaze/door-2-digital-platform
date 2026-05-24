/**
 * Org routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.1:
 *   - POST /v1/orgs                  create (region pinned at create, immutable)
 *   - GET  /v1/orgs/:id              read
 *   - PATCH /v1/orgs/:id             update (regionCode field rejected)
 *   - POST /v1/orgs/:id/archive      soft delete
 *   - POST /v1/orgs/:id/brand-kit    upsert BrandKit
 *   - PATCH /v1/orgs/:id/billing     update OrgBilling rates
 *
 * Region pinning is enforced at the DB level (CHECK constraint + trigger
 * that raises on UPDATE), backed up by RegionGuard middleware.
 */
import type { FastifyInstance } from 'fastify';
import { createOrgRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerOrg(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'org', status: 'scaffold', phase: '1.1' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createOrgRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Org create lands in Phase 1.1',
    });
  });
}
