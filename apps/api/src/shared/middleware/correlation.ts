/**
 * Correlation-ID propagation. Reads X-Correlation-ID from incoming requests
 * (or generates one from req.id) and echoes it on every response.
 *
 * Pairs with OpenTelemetry trace IDs — propagate downstream calls with both.
 */
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const registerCorrelationId = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (req, reply) => {
    const inbound = req.headers['x-correlation-id'];
    const id = typeof inbound === 'string' && inbound.length > 0 ? inbound : req.id;
    req.headers['x-correlation-id'] = id;
    reply.header('x-correlation-id', id);
  });
});
