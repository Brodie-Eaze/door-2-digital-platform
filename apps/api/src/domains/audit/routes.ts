/**
 * Audit routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.1:
 *   - GET /v1/audit/events                        list AuditEvent rows (cursor-paginated, ≤200/page);
 *                                                 org_admin / auditor role only
 *   - GET /v1/audit/events/:id                    single event (with prev/next pointers in chain)
 *   - GET /v1/audit/verify                        verify hash-chain integrity for a period
 *                                                 (returns latest verified root + any breaks)
 *   - GET /v1/audit/export                        signed download URL for full audit export
 *                                                 (compliance bulk pull)
 *
 * Cross-cutting:
 *   - Hash-chain: each row's `prevHash` = sha256(prevRow.hash + secret). Daily Merkle roots
 *     written to `docs/audits/merkle-roots/<region>/<date>.json` by `audit-verify` cron.
 *   - AuditEvent rows are append-only; no updates, no deletes — DB role enforces.
 *   - Shipped to S3 Object Lock (7yr retention) by `audit-shipper` worker (BullMQ).
 *   - Per-region chain; never crosses regions.
 */
import type { FastifyInstance } from 'fastify';
import { cursorPageQuerySchema } from '@d2d/shared-types';

export async function registerAudit(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'audit', status: 'scaffold', phase: '1.1' }));

  app.get('/', async (req, reply) => {
    const parsed = cursorPageQuerySchema.parse(req.query);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Audit event list lands in Phase 1.1',
    });
  });

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Audit event read lands in Phase 1.1',
    }),
  );
}
