/**
 * Donation routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - GET   /v1/donations                          list (filter donor, status, frequency, period)
 *   - GET   /v1/donations/:id                      read with full charge ledger
 *   - POST  /v1/donations/:id/pause                pause recurring (optional resumeAt)
 *   - POST  /v1/donations/:id/resume               resume from pause
 *   - POST  /v1/donations/:id/cancel               cancel (reason required; triggers clawback eval)
 *   - POST  /v1/donations/:id/change-amount        change amount (effective next charge)
 *   - POST  /v1/donations/:id/receipt              regenerate ACNC/charity receipt (PDF in S3)
 *
 * Cross-cutting:
 *   - All recurring management is idempotent via Idempotency-Key.
 *   - Frequency change requires `cancel + new conversion` (immutable on Donation).
 *   - Receipt PDF generation queued to BullMQ; returned as job id + polling URL.
 *   - Inverted clawback model (Amala/D2D shared): if cancel within retention window,
 *     downstream Commission rows flip to `status=clawed_back`.
 */
import type { FastifyInstance } from 'fastify';
import {
  changeDonationAmountRequestSchema,
  pauseDonationRequestSchema,
  cancelDonationRequestSchema,
} from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerDonation(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'donation', status: 'scaffold', phase: '1.3' }));

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Donation read lands in Phase 1.3',
    }),
  );

  app.post('/:id/pause', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = pauseDonationRequestSchema.parse(req.body ?? {});
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Donation pause lands in Phase 1.3',
    });
  });

  app.post('/:id/cancel', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = cancelDonationRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Donation cancel lands in Phase 1.3',
    });
  });

  app.post('/:id/change-amount', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = changeDonationAmountRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Donation amount change lands in Phase 1.3',
    });
  });
}
