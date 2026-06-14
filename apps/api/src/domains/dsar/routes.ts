/**
 * DSAR (Data Subject Access Request) routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.4:
 *   - POST /v1/dsar/requests                       file a DSAR (access | deletion | portability |
 *                                                  restriction); attaches proof-of-identity key
 *   - GET  /v1/dsar/requests                       list (admin/auditor; cursor-paginated)
 *   - GET  /v1/dsar/requests/:id                   read request with status timeline
 *   - POST /v1/dsar/requests/:id/fulfil            mark fulfilled + attach response package URL
 *   - POST /v1/dsar/requests/:id/reject            reject (with reason — e.g. identity unverified)
 *
 * Cross-cutting:
 *   - Per-jurisdiction SLAs: AU 30d (Privacy Act), CCPA 45d, GDPR 30d, PDPA 30d.
 *   - Deletion path coordinates: lead, conversion (anonymise, preserve audit), donation
 *     (anonymise donor link, preserve charge record for tax), audit (NEVER deleted).
 *   - Response package is encrypted zip → signed S3 URL (24h TTL).
 *   - Every DSAR action audit-logged with subject id + actor id.
 */
import type { FastifyInstance } from 'fastify';
import { dsarRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';

export async function registerDsar(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'dsar',
    status: 'scaffold',
    phase: '1.4',
  }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = dsarRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DSAR request file lands in Phase 1.4',
    });
  });

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'DSAR request read lands in Phase 1.4',
    }),
  );
}
