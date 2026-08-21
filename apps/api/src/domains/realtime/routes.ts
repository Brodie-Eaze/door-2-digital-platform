/**
 * Realtime (Ably channel grant) routes — Phase 1.3.
 *
 *   - POST /v1/realtime/tokens      issue an Ably TokenRequest scoped to the
 *                                   caller's org. Client exchanges it with Ably
 *                                   for a real token (no Ably SDK on server).
 *
 * Channel namespace enforcement:
 *   Every requested channel must be prefixed with `org:{orgId}:` — requests
 *   that cross tenant boundaries are rejected 403 before signing.
 *
 * Signing:
 *   Ably TokenRequest HMAC per https://ably.com/docs/core-features/authentication
 *   MAC = HMAC-SHA256(keySecret, keyName\nttl_ms\ntimestamp_ms\nnonce\ncapability\n)
 *   encoded as base64.  No Ably SDK required on the server side.
 *
 * Requires ABLY_API_KEY env var (optional — returns 503 when absent).
 */
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ProblemError, Problems } from '@d2d/shared-utils';
import { realtimeTokenRequestSchema } from '@d2d/shared-types';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { env } from '../../config/env';

export async function registerRealtime(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'realtime', status: 'live', phase: '1.3' }));

  app.post('/tokens', { preHandler: requireAuth }, async (req, reply) => {
    const e = env();
    if (!e.ABLY_API_KEY) {
      return reply.code(503).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/service-unavailable',
        title: 'Realtime not configured',
        status: 503,
        detail: 'ABLY_API_KEY is not set — realtime channel grants are unavailable.',
      });
    }

    const ctx = requireTenant(req);
    const parsed = realtimeTokenRequestSchema.parse(req.body);

    const orgPrefix = `org:${ctx.orgId}:`;
    const forbiddenChannels = parsed.channels.filter((ch) => !ch.name.startsWith(orgPrefix));
    if (forbiddenChannels.length > 0) {
      throw new ProblemError(
        Problems.forbidden(
          `All channels must start with "${orgPrefix}". Rejected: ${forbiddenChannels.map((c) => c.name).join(', ')}`,
        ),
      );
    }

    const [keyName, keySecret] = e.ABLY_API_KEY.split(':') as [string, string];
    if (!keyName || !keySecret) {
      throw new Error('ABLY_API_KEY must be in the format keyName:keySecret');
    }

    const ttlMs = parsed.ttlSeconds * 1000;
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');

    // Capability JSON: { channelName: [cap1, cap2], ... }
    const capabilityMap: Record<string, string[]> = {};
    for (const ch of parsed.channels) {
      capabilityMap[ch.name] = ch.caps;
    }
    const capability = JSON.stringify(capabilityMap);

    // HMAC per Ably spec: fields joined with "\n", trailing "\n" required.
    const hmacInput = [keyName, ttlMs, timestamp, nonce, capability, ''].join('\n');
    const mac = crypto.createHmac('sha256', keySecret).update(hmacInput).digest('base64');

    return reply.code(200).send({
      keyName,
      ttl: ttlMs,
      timestamp,
      nonce,
      capability,
      mac,
    });
  });
}
