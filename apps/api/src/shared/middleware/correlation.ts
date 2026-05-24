/**
 * Correlation-ID propagation. Reads X-Correlation-ID from incoming requests
 * (or generates one from req.id) and echoes it on every response.
 *
 * Pairs with OpenTelemetry trace IDs — propagate downstream calls with both.
 */
import type { FastifyInstance } from 'fastify';

/**
 * Register the correlation-ID hook. Exposed as a plain async function so it
 * can be registered with `app.register(registerCorrelationId)` without
 * pulling in `fastify-plugin` (not in package.json).
 */
export async function registerCorrelationId(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req, reply) => {
    const inbound = req.headers['x-correlation-id'];
    const id = typeof inbound === 'string' && inbound.length > 0 ? inbound : req.id;
    req.headers['x-correlation-id'] = id;
    reply.header('x-correlation-id', id);
  });
}
