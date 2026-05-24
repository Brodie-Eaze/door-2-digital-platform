/**
 * Realtime (Ably channel grant) routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.3:
 *   - POST /v1/realtime/tokens                     issue Ably JWT with channel capabilities scoped
 *                                                  to the caller's org / role / sessions
 *   - GET  /v1/realtime/channels                   list channels the caller is allowed to subscribe to
 *
 * Cross-cutting:
 *   - Channel namespace conventions:
 *       org:<id>:territory:<id>:knocks       live knock feed
 *       org:<id>:leaderboard:<period>        live leaderboard
 *       org:<id>:user:<id>:calls             soft-phone state (per-user)
 *       org:<id>:operator:<surface>          operator console live updates
 *   - All publishes are server-side (`services/realtime` publishers); clients are
 *     subscribe-only. Token caps reflect this.
 *   - JWT TTL default 15min; client refreshes ahead of expiry.
 */
import type { FastifyInstance } from 'fastify';
import { realtimeTokenRequestSchema } from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerRealtime(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'realtime', status: 'scaffold', phase: '1.3' }));

  app.post('/tokens', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = realtimeTokenRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Realtime token issuance lands in Phase 1.3',
    });
  });
}
