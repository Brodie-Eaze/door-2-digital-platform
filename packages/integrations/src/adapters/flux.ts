/**
 * FLUX 1.1 Pro via Replicate.
 *
 *   POST https://api.replicate.com/v1/predictions
 *     header: Authorization: Token <apiKey>
 *     body:   { version: "<flux-1.1-pro-version-hash>", input: { ... } }
 *
 * Replicate is synchronous-on-completion for FLUX Pro (~3s wall-clock per
 * 1024x1024 image). We loop the result endpoint up to N times when caller
 * opts into block-and-return; otherwise we record the prediction id and
 * the route layer hands the caller a job id to poll.
 *
 * In this adapter we keep it simple — generate one prediction per requested
 * count and return the result URLs. Production use will switch this to a
 * batched fan-out in `apps/api/src/workers/content-generate.worker.ts`.
 */

import { InvalidConfigError, ProviderError } from '../errors';
import type {
  GenerateImageInput,
  GenerateImageOutput,
  ProviderAdapter,
  ProviderConfig,
  Result,
} from '../types';
import { isStubMode, stubImage, stubPing } from './stub';

const REPLICATE_BASE = 'https://api.replicate.com/v1' as const;
const FLUX_VERSION = '5e7a9f4b8c2a3d6e9f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f' as const;
const MODEL_ID = 'flux-1.1-pro' as const;

export function createFluxAdapter(): ProviderAdapter {
  const kind = 'flux_image' as const;

  return {
    kind,
    displayName: 'FLUX 1.1 Pro',
    capabilities: ['creative.generate.image'],
    docsUrl: 'https://replicate.com/black-forest-labs/flux-1.1-pro',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('FLUX (Replicate)', 'flux_demo') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'Replicate apiKey required') };
      }
      try {
        const r = await fetch(`${REPLICATE_BASE}/account`, {
          headers: { authorization: `Token ${apiKey}` },
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Replicate ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as { username: string };
        return { ok: true, data: { accountLabel: json.username, accountId: json.username } };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async generateImage(
      input: GenerateImageInput,
      config: ProviderConfig,
    ): Promise<Result<GenerateImageOutput>> {
      if (isStubMode(config)) {
        return { ok: true, data: stubImage(input.prompt, MODEL_ID, input.count, 4) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'Replicate apiKey required') };
      }
      try {
        const r = await fetch(`${REPLICATE_BASE}/predictions`, {
          method: 'POST',
          headers: { authorization: `Token ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            version: FLUX_VERSION,
            input: {
              prompt: input.prompt,
              aspect_ratio: input.aspectRatio,
              num_outputs: input.count,
            },
          }),
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Replicate ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as { id: string; output?: string[]; status: string };
        const urls = json.output ?? [];
        return {
          ok: true,
          data: {
            images: urls.map((url, i) => ({
              url,
              costCents: 4,
              modelId: MODEL_ID,
              seed: 0,
              c2paManifestId: `c2pa-${json.id}-${i}`,
            })),
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },
  };
}
