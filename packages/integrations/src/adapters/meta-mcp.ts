/**
 * Meta MCP server consumer.
 *
 * Distinct from `meta-marketing` — this adapter is here to declare that D2D
 * ITSELF acts as an MCP server (Model Context Protocol) hosting tools like:
 *   - d2d.search_leads
 *   - d2d.generate_campaign_brief
 *   - d2d.get_territory_propensity
 *   - d2d.get_account_summary
 *
 * The runtime MCP server is scaffolded in `apps/api/src/mcp/server.ts` and
 * exposed at `/v1/mcp/sse` (SSE transport) + a stdio variant for local CLI
 * agents. This adapter just provides the capability tag so the UI can render
 * a "D2D as MCP" card on the integrations page and the SDK can discover it.
 *
 * It also reads Meta's own MCP gateway in the future (graph.facebook.com/mcp)
 * for ad-account-side agent calls — kept as a stub today.
 */

import { ProviderError, StubModeError } from '../errors';
import type { ProviderAdapter } from '../types';
import { guardProduction, stubPing } from './stub';

export function createMetaMcpAdapter(): ProviderAdapter {
  const kind = 'meta_mcp' as const;

  return {
    kind,
    displayName: 'Meta MCP (server-expose)',
    capabilities: ['mcp.server.expose'],
    docsUrl: 'https://modelcontextprotocol.io',

    async ping(config) {
      // D2D-as-MCP-server is always "available" — the scaffold mounts at /v1/mcp/sse.
      // When real Meta MCP gateway creds are present in the future, we'd call them here.
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('D2D MCP', 'd2d_mcp_server') };
      }
      const endpoint = config.credentials.mcpEndpoint;
      if (!endpoint) {
        return {
          ok: false,
          error: new ProviderError('INVALID_CONFIG', 'mcpEndpoint required', kind),
        };
      }
      // Real MCP discovery would `GET <endpoint>/.well-known/mcp.json` here.
      return { ok: true, data: { accountLabel: 'D2D MCP gateway', accountId: endpoint } };
    },

    // No generate/build/deliver — MCP is the transport, tools live in apps/api/src/mcp.
    async generateText(_input, _config) {
      return { ok: false, error: new StubModeError(kind, 'use tools via /v1/mcp/sse') };
    },
  };
}
