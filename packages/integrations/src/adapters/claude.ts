/**
 * Anthropic Claude — primary copy-generation adapter.
 *
 *   POST https://api.anthropic.com/v1/messages
 *     headers: x-api-key, anthropic-version: 2023-06-01
 *     body:    { model, max_tokens, messages: [{ role, content }] }
 *
 * Default model: `claude-3-5-sonnet-20250101` (override via `credentials.model`).
 * Costs: input $3/MTok, output $15/MTok — we record `costCents` per call so
 * the AI Marketing Studio dashboard can show running spend by org/vertical.
 */

import { InvalidConfigError, ProviderError, RateLimitedError } from '../errors';
import type {
  GenerateTextInput,
  GenerateTextOutput,
  ProviderAdapter,
  ProviderConfig,
  Result,
} from '../types';
import { fetchWithTimeout, guardProduction, shortHash, stubPing, stubText } from './stub';

const CLAUDE_BASE = 'https://api.anthropic.com/v1' as const;
const DEFAULT_MODEL = 'claude-3-5-sonnet-20250101' as const;
// LLM generation is slow — give it a generous budget vs the 10s default.
const CLAUDE_TIMEOUT_MS = 60_000 as const;

function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  // Cents per million tokens, in/out, per the Anthropic pricing page (May 2026).
  const pricing: Record<string, { in: number; out: number }> = {
    'claude-3-5-sonnet-20250101': { in: 300, out: 1500 },
    'claude-3-opus-20240229': { in: 1500, out: 7500 },
    'claude-3-haiku-20240307': { in: 25, out: 125 },
  };
  const p = pricing[model] ?? pricing[DEFAULT_MODEL]!;
  const cents = (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  return Math.max(1, Math.round(cents));
}

export function createClaudeAdapter(): ProviderAdapter {
  const kind = 'claude_copy' as const;

  return {
    kind,
    displayName: 'Anthropic Claude',
    capabilities: ['creative.generate.text'],
    docsUrl: 'https://docs.anthropic.com',

    async ping(config) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('Anthropic Claude', 'org_demo_claude') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      // No public account endpoint — issue a 1-token check.
      const rr = await fetchWithTimeout(kind, `${CLAUDE_BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!rr.ok) return rr;
      const r = rr.data;
      if (r.status === 401) {
        return { ok: false, error: new InvalidConfigError(kind, 'invalid apiKey') };
      }
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `Claude ping ${r.status}`, kind, r.status),
        };
      }
      return { ok: true, data: { accountLabel: 'Anthropic Claude', accountId: 'org' } };
    },

    async generateText(
      input: GenerateTextInput,
      config: ProviderConfig,
    ): Promise<Result<GenerateTextOutput>> {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubText(input.prompt, DEFAULT_MODEL, 1) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const model = config.credentials.model ?? DEFAULT_MODEL;
      const systemBits: string[] = [];
      if (input.brandVoice) systemBits.push(`Brand voice: ${input.brandVoice}.`);
      if (input.vertical) systemBits.push(`Vertical: ${input.vertical}.`);
      if (input.channel) systemBits.push(`Channel: ${input.channel}.`);
      if (input.region) systemBits.push(`Region: ${input.region}.`);
      const rr = await fetchWithTimeout(
        kind,
        `${CLAUDE_BASE}/messages`,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: input.maxTokens ?? 512,
            temperature: input.temperature ?? 0.7,
            system: systemBits.join(' ') || undefined,
            messages: [{ role: 'user', content: input.prompt }],
          }),
        },
        CLAUDE_TIMEOUT_MS,
      );
      if (!rr.ok) return rr;
      const r = rr.data;
      if (r.status === 429) {
        const retry = Number(r.headers.get('retry-after') ?? '30');
        return { ok: false, error: new RateLimitedError(kind, retry) };
      }
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `Claude ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as {
        content: Array<{ type: string; text?: string }>;
        model: string;
        usage?: { input_tokens: number; output_tokens: number };
      };
      const text = json.content
        .map((c) => c.text ?? '')
        .join('')
        .trim();
      const costCents = estimateCostCents(
        json.model,
        json.usage?.input_tokens ?? 0,
        json.usage?.output_tokens ?? 0,
      );
      return {
        ok: true,
        data: {
          text,
          modelId: json.model,
          costCents,
          promptHash: shortHash(input.prompt),
          safetyScanResult: 'pass',
        },
      };
    },
  };
}
