/**
 * PII vault routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.1:
 *   - POST /v1/pii/unmask-request                  request JIT unmask of fields on a resource;
 *                                                  org_admin may auto-approve, others trigger
 *                                                  4-eyes approval flow
 *   - POST /v1/pii/unmask-approve/:id              approver acts on a pending request
 *   - GET  /v1/pii/unmask-grants/:id               read active grant (returns plaintext fields
 *                                                  for the approved window only)
 *   - GET  /v1/pii/unmask-requests                 list pending + recent requests (admin/auditor)
 *   - POST /v1/pii/rotate-keys                     rotate envelope key (master-key only — break-glass)
 *
 * Cross-cutting:
 *   - Envelope-encrypt at field level: data key per field, master key per region in KMS.
 *   - Deterministic-SIV search index for email/phone (so we can equality-match without unmasking).
 *   - Every grant + use is audit-chain-anchored; daily Merkle root in `docs/audits/`.
 *   - PII never crosses regions — unmask service is region-local.
 */
import type { FastifyInstance } from 'fastify';
import { unmaskRequestSchema, unmaskApprovalRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerPiiVault(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'pii-vault', status: 'scaffold', phase: '1.1' }));

  app.post('/unmask-request', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = unmaskRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'PII unmask-request lands in Phase 1.1',
    });
  });

  app.post('/unmask-approve/:id', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = unmaskApprovalRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'PII unmask-approve lands in Phase 1.1',
    });
  });

  app.get('/unmask-grants/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'PII unmask-grant read lands in Phase 1.1',
    }),
  );
}
