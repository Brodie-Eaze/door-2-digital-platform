/**
 * IntegrationRegistry — single lookup table that resolves a `ProviderKind`
 * to the adapter that implements it.
 *
 * One registry is built per Fastify instance at boot, decorated onto the
 * app (`app.integrations`), and read by every route in `domains/marketing`
 * + `domains/content-studio`. Adapters are stateless — they receive
 * `ProviderConfig` on each call, so a single registry instance serves
 * every org safely.
 */

import { NotConnectedError } from './errors';
import type { ProviderAdapter, ProviderDescriptor, ProviderKind } from './types';

import { createMetaMarketingAdapter } from './adapters/meta-marketing';
import { createMetaMcpAdapter } from './adapters/meta-mcp';
import { createHiggsfieldAdapter } from './adapters/higgsfield';
import { createClaudeAdapter } from './adapters/claude';
import { createOpenAICopyAdapter } from './adapters/openai-copy';
import { createFluxAdapter } from './adapters/flux';
import { createIdeogramAdapter } from './adapters/ideogram';
import { createRunwayAdapter } from './adapters/runway';
import { createHeyGenAdapter } from './adapters/heygen';
import { createGoogleAdsAdapter } from './adapters/google-ads';
import { createTikTokAdapter } from './adapters/tiktok';

export class IntegrationRegistry {
  private readonly adapters = new Map<ProviderKind, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  has(kind: ProviderKind): boolean {
    return this.adapters.has(kind);
  }

  get(kind: ProviderKind): ProviderAdapter {
    const a = this.adapters.get(kind);
    if (!a) throw new NotConnectedError(kind);
    return a;
  }

  /** Soft lookup — returns null instead of throwing. */
  tryGet(kind: ProviderKind): ProviderAdapter | null {
    return this.adapters.get(kind) ?? null;
  }

  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  describe(): ProviderDescriptor[] {
    return this.list().map((a) => ({
      kind: a.kind,
      displayName: a.displayName,
      capabilities: a.capabilities,
      docsUrl: a.docsUrl,
    }));
  }
}

/**
 * Build the default registry with all known adapters pre-registered.
 * Called once at Fastify boot — see `apps/api/src/index.ts`.
 */
export function buildDefaultRegistry(): IntegrationRegistry {
  const r = new IntegrationRegistry();
  r.register(createMetaMarketingAdapter());
  r.register(createMetaMcpAdapter());
  r.register(createHiggsfieldAdapter());
  r.register(createClaudeAdapter());
  r.register(createOpenAICopyAdapter());
  r.register(createFluxAdapter());
  r.register(createIdeogramAdapter());
  r.register(createRunwayAdapter());
  r.register(createHeyGenAdapter());
  r.register(createGoogleAdsAdapter());
  r.register(createTikTokAdapter());
  return r;
}
