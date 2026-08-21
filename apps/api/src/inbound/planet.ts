/**
 * Inbound webhook handler for Planet Labs subscription delivery events.
 *
 * Planet POSTs to /v1/inbound/planet when new imagery is available for a
 * subscribed territory. The handler:
 *   1. Verifies the X-Planet-Api-Key header against PLANET_WEBHOOK_SECRET.
 *   2. Extracts the territory ID from the subscription name (d2d-territory-<id>).
 *   3. Enqueues a planet-intel job for non-blocking satellite analysis.
 *
 * Planet webhook delivery shape:
 *   { "subscription": { "id": "...", "name": "d2d-territory-ter_..." }, ... }
 *
 * Route registered in index.ts:
 *   app.register(registerPlanetInbound, { prefix: '/v1/inbound' })
 */

import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { enqueuePlanetIntel } from '../workers/planet-intel.worker';

interface PlanetWebhookBody {
  subscription?: {
    id?: string;
    name?: string;
  };
  event?: string;
  [key: string]: unknown;
}

export async function registerPlanetInbound(app: FastifyInstance): Promise<void> {
  app.post<{ Body: PlanetWebhookBody }>('/planet', async (req, reply) => {
    const secret = env().PLANET_WEBHOOK_SECRET;

    // Verify the shared secret sent by Planet in the Authorization header.
    // Planet sends: Authorization: api-key <PLANET_WEBHOOK_SECRET>
    const authHeader = req.headers['authorization'] ?? '';
    const provided = authHeader.replace(/^api-key\s+/i, '');

    if (!secret || provided !== secret) {
      logger().warn(
        { ip: req.ip, event: req.body?.event },
        'planet-inbound: invalid webhook secret — rejected',
      );
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const subscriptionId = req.body?.subscription?.id;
    const subscriptionName = req.body?.subscription?.name ?? '';

    // Extract territory ID from the subscription name format: "d2d-territory-ter_..."
    const match = subscriptionName.match(/^d2d-territory-(ter_[a-z0-9]+)/);
    if (!match?.[1] || !subscriptionId) {
      logger().info(
        { name: subscriptionName },
        'planet-inbound: unrecognised subscription name — ignoring',
      );
      return reply.code(200).send({ ok: true });
    }

    const territoryId = match[1];
    logger().info({ territoryId, subscriptionId }, 'planet-inbound: enqueuing intel job');

    await enqueuePlanetIntel({ territoryId, subscriptionId });

    return reply.code(200).send({ ok: true });
  });
}
