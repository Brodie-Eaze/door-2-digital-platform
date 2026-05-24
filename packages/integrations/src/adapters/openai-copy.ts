/**
 * OpenAI Chat Completions — copy fallback when Claude is rate-limited or
 * the brief explicitly opts into GPT.
 *
 *   POST https://api.openai.com/v1/chat/completions
 *     header: Authorization: Bearer <apiKey>
 *
 * Default model: `gpt-4o-mini` (override via `credentials.model`).
 */

import { InvalidConfigError, ProviderError, RateLimitedError } from '../errors';
import type {
  GenerateTextInput,
  GenerateTextOutput,
  ProviderAdapter,
  ProviderConfig,
  Result,
} from '../types';
import { isStubMode, shortHash, stubPing, stubText } from './stub';

const OPENAI_BASE = 'https://api.openai.com/v1' as const;
const DEFAULT_MODEL = 'gpt-4o-mini' as const;

function estimateCostCents(model: string, inTok: number, outTok: number): number {
  // Cents per million tokens (in / out). May 2026.
  const pricing: Record<string, { in: number; out: number }> = {
    'gpt-4o-mini': { in: 15, out: 60 },
    'gpt-4o': { in: 250, out: 1000 },
    'gpt-4.1': { in: 200, out: 800 },
  };
  const p = pricing[model] ?? pricing[DEFAULT_MODEL]!;
  const cents = (inTok * p.in + outTok * p.out) / 1_000_000;
  return Math.max(1, Math.round(cents));
}

export function createOpenAICopyAdapter(): ProviderAdapter {
  const kind = 'openai_copy' as const;

  return {
    kind,
    displayName: 'OpenAI (fallback)',
    capabilities: ['creative.generate.text'],
    docsUrl: 'https://platform.openai.com/docs',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('OpenAI', 'org_demo_openai') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      try {
        const r = await fetch(`${OPENAI_BASE}/models`, {
          headers: { authorization: `Bearer ${apiKey}` },
        });
        if (r.status === 401) {
          return { ok: false, error: new InvalidConfigError(kind, 'invalid apiKey') };
        }
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `OpenAI ping ${r.status}`, kind, r.status),
          };
        }
        return { ok: true, data: { accountLabel: 'OpenAI', accountId: 'org' } };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async generateText(
      input: GenerateTextInput,
      config: ProviderConfig,
    ): Promise<Result<GenerateTextOutput>> {
      if (isStubMode(config)) {
        return { ok: true, data: stubText(input.prompt, DEFAULT_MODEL, 1) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const model = config.credentials.model ?? DEFAULT_MODEL;
      const sys: string[] = [];
      if (input.brandVoice) sys.push(`Brand voice: ${input.brandVoice}.`);
      if (input.vertical) sys.push(`Vertical: ${input.vertical}.`);
      if (input.channel) sys.push(`Channel: ${input.channel}.`);
      if (input.region) sys.push(`Region: ${input.region}.`);
      try {
        const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            max_tokens: input.maxTokens ?? 512,
            temperature: input.temperature ?? 0.7,
            messages: [
              ...(sys.length ? [{ role: 'system', content: sys.join(' ') }] : []),
              { role: 'user', content: input.prompt },
            ],
          }),
        });
        if (r.status === 429) {
          const retry = Number(r.headers.get('retry-after') ?? '30');
          return { ok: false, error: new RateLimitedError(kind, retry) };
        }
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `OpenAI ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as {
          choices: Array<{ message: { content: string } }>;
          model: string;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const text = json.choices[0]?.message?.content ?? '';
        const costCents = estimateCostCents(
          json.model,
          json.usage?.prompt_tokens ?? 0,
          json.usage?.completion_tokens ?? 0,
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
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },
  };
}
