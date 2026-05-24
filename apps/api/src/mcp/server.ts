/**
 * D2D as an MCP server.
 *
 * The Model Context Protocol (https://modelcontextprotocol.io) lets AI agents
 * discover + call tools across systems. D2D exposes a small initial tool set
 * so external agents (Claude Desktop, Claude code-running tools, third-party
 * orchestrators) can pull live D2D data into a conversation.
 *
 * Transports supported here:
 *   - SSE  (server-sent events, Fastify route `GET /v1/mcp/sse`)
 *   - stdio (out of scope for the HTTP server — see scripts/mcp-stdio.ts)
 *
 * Wire protocol: JSON-RPC 2.0 messages framed as SSE events. Each line:
 *   event: message\n
 *   data: { "jsonrpc": "2.0", ... }\n\n
 *
 * Phase 0 tools (501 stubs until Phase 3.2 wires them to real services):
 *   - d2d.search_leads
 *   - d2d.generate_campaign_brief
 *   - d2d.get_territory_propensity
 *   - d2d.get_account_summary
 *
 * Initialise response advertises capabilities = { tools: { listChanged: true } }.
 */

import type { FastifyInstance } from 'fastify';

const MCP_PROTOCOL_VERSION = '2024-11-05' as const;
const SERVER_NAME = 'd2d-mcp' as const;
const SERVER_VERSION = '0.1.0' as const;

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDescriptor[] = [
  {
    name: 'd2d.search_leads',
    description:
      'Search leads across the operator org by free-text + filters (region, vertical, status). Returns up to 50 results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        region: { type: 'string', enum: ['US', 'AU', 'SG'] },
        vertical: { type: 'string', enum: ['charity', 'pest', 'solar', 'energy', 'healthcare'] },
        status: { type: 'string', enum: ['open', 'contacted', 'qualified', 'won', 'lost'] },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'd2d.generate_campaign_brief',
    description:
      'Generate a structured campaign brief (audience, headlines, body copy, channels, budget range) for a given vertical + region + objective.',
    inputSchema: {
      type: 'object',
      properties: {
        vertical: { type: 'string' },
        region: { type: 'string', enum: ['US', 'AU', 'SG'] },
        objective: { type: 'string', enum: ['leads', 'conversions', 'reach', 'video_views'] },
        budgetCentsDaily: { type: 'integer' },
      },
      required: ['vertical', 'region', 'objective'],
    },
  },
  {
    name: 'd2d.get_territory_propensity',
    description:
      'Return a per-territory propensity score (0..100) and recommended canvasser headcount for a given vertical.',
    inputSchema: {
      type: 'object',
      properties: {
        vertical: { type: 'string' },
        region: { type: 'string', enum: ['US', 'AU', 'SG'] },
      },
      required: ['vertical', 'region'],
    },
  },
  {
    name: 'd2d.get_account_summary',
    description:
      'Snapshot of one HQ account: live KPIs, this-week financials, top campaigns, compliance flags, recent anomalies.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
      },
      required: ['accountId'],
    },
  },
];

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function buildResponse(req: JsonRpcRequest, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: req.id ?? null, result };
}

function buildError(
  req: JsonRpcRequest | { id?: number | string | null },
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id: req.id ?? null, error: { code, message } };
}

function handleMcpMessage(req: JsonRpcRequest): JsonRpcResponse {
  switch (req.method) {
    case 'initialize':
      return buildResponse(req, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        capabilities: { tools: { listChanged: true } },
      });
    case 'tools/list':
      return buildResponse(req, { tools: TOOLS });
    case 'tools/call': {
      const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const name = params.name;
      if (!name) return buildError(req, -32602, 'tools/call requires name');
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return buildError(req, -32602, `unknown tool: ${name}`);
      // Phase 3.2 will route by tool name to the underlying service.
      // For now we return a 501-shaped content block so agents can render it.
      return buildResponse(req, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'not_implemented',
              tool: name,
              detail: 'D2D MCP tools land in Phase 3.2',
            }),
          },
        ],
        isError: false,
      });
    }
    case 'ping':
      return buildResponse(req, {});
    default:
      return buildError(req, -32601, `method not found: ${req.method}`);
  }
}

export async function registerMcpServer(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({
    protocol: 'mcp',
    version: MCP_PROTOCOL_VERSION,
    tools: TOOLS.length,
  }));

  /** Tool catalogue — convenience JSON endpoint for the UI. */
  app.get('/tools', async () => ({
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
    protocolVersion: MCP_PROTOCOL_VERSION,
    tools: TOOLS,
  }));

  /**
   * SSE transport. Real MCP agents send JSON-RPC messages back via a paired
   * POST endpoint (see /messages). For Phase 0 we keep the stream alive +
   * advertise the initial server-info event so clients can negotiate.
   */
  app.get('/sse', async (_req, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-mcp-server': SERVER_NAME,
      'x-mcp-version': SERVER_VERSION,
    });
    const announce: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 'server-info',
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        capabilities: { tools: { listChanged: true } },
      },
    };
    reply.raw.write(`event: message\ndata: ${JSON.stringify(announce)}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(`: keep-alive ${Date.now()}\n\n`);
      } catch {
        clearInterval(keepAlive);
      }
    }, 25_000);

    reply.raw.on('close', () => clearInterval(keepAlive));
  });

  /**
   * JSON-RPC over POST — clients (Claude Desktop etc.) call here with the
   * messages they want answered. Pairs with the SSE stream above.
   */
  app.post('/messages', async (req, reply) => {
    const body = req.body as JsonRpcRequest | JsonRpcRequest[] | undefined;
    if (!body) {
      return reply
        .code(400)
        .type('application/json')
        .send(buildError({ id: null }, -32600, 'empty body'));
    }
    if (Array.isArray(body)) {
      const out = body.map(handleMcpMessage);
      return reply.code(200).send(out);
    }
    const out = handleMcpMessage(body);
    return reply.code(200).send(out);
  });
}
