/**
 * Ideogram adapter — image generation specialised for legible text-in-image,
 * which is the bottleneck for direct-response ad creative (offer overlays,
 * URLs, large headlines on background image).
 *
 *   POST https://api.ideogram.ai/generate
 *     header: Api-Key: <apiKey>
 *     body:   { image_request: { prompt, aspect_ratio, model, magic_prompt_option } }
 *
 * Output: array of image URLs + per-image cost. We default to `MODEL_V_2_TURBO`
 * for speed; v2.0 is reserved for hero creatives via `credentials.model`.
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

const IDEOGRAM_BASE = 'https://api.ideogram.ai' as const;
const MODEL_ID = 'V_2_TURBO' as const;

function mapAspect(a: GenerateImageInput['aspectRatio']): string {
  switch (a) {
    case '1:1':
      return 'ASPECT_1_1';
    case '4:5':
      return 'ASPECT_4_5';
    case '9:16':
      return 'ASPECT_9_16';
    case '16:9':
      return 'ASPECT_16_9';
    case '3:2':
      return 'ASPECT_3_2';
  }
}

export function createIdeogramAdapter(): ProviderAdapter {
  const kind = 'ideogram_image' as const;

  return {
    kind,
    displayName: 'Ideogram',
    capabilities: ['creative.generate.image'],
    docsUrl: 'https://developer.ideogram.ai',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('Ideogram', 'ideo_demo') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      // Ideogram has no public account endpoint — issue a no-op generation with min text.
      // To avoid burning credit we just check key format here.
      if (apiKey.length < 12) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey too short') };
      }
      return { ok: true, data: { accountLabel: 'Ideogram', accountId: 'ideo' } };
    },

    async generateImage(
      input: GenerateImageInput,
      config: ProviderConfig,
    ): Promise<Result<GenerateImageOutput>> {
      if (isStubMode(config)) {
        return { ok: true, data: stubImage(input.prompt, MODEL_ID, input.count, 8) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const model = config.credentials.model ?? MODEL_ID;
      try {
        const r = await fetch(`${IDEOGRAM_BASE}/generate`, {
          method: 'POST',
          headers: { 'Api-Key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            image_request: {
              prompt: input.prompt,
              aspect_ratio: mapAspect(input.aspectRatio),
              model,
              magic_prompt_option: 'AUTO',
              num_images: input.count,
            },
          }),
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Ideogram ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as {
          data: Array<{ url: string; seed: number; prompt: string }>;
        };
        return {
          ok: true,
          data: {
            images: json.data.map((d, i) => ({
              url: d.url,
              costCents: 8,
              modelId: model,
              seed: d.seed,
              c2paManifestId: `c2pa-ideo-${d.seed}-${i}`,
            })),
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },
  };
}
