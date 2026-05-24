/**
 * Integrations plug-in for Fastify.
 *
 * Builds a single `IntegrationRegistry` at boot and decorates the app
 * instance so route handlers can call `app.integrations.get(kind)` to
 * resolve a `ProviderAdapter`.
 *
 * Adapters are stateless — registry creation is cheap. We build once
 * per process, share across requests; per-org credentials are passed
 * in at call time via `ProviderConfig`.
 */

import type { FastifyInstance } from 'fastify';
import { buildDefaultRegistry, type IntegrationRegistry } from '@d2d/integrations';

declare module 'fastify' {
  interface FastifyInstance {
    integrations: IntegrationRegistry;
  }
}

export async function registerIntegrations(app: FastifyInstance): Promise<void> {
  const registry = buildDefaultRegistry();
  app.decorate('integrations', registry);
}
