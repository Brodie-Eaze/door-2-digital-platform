/**
 * Content-Studio service — Agent 16 real.
 *
 * Thin wrapper around MarketingService that auto-picks the right provider
 * per media kind. Returns ContentGenerationJob records (sync providers
 * arrive with status='ready' inline; async with status='running' + an
 * external job id that callers poll via GET /v1/content-studio/jobs/:id).
 *
 * Defaults:
 *   - copy:   claude_copy
 *   - image:  flux_image
 *   - video:  runway_video
 *   - avatar: heygen_avatar
 */
import type { RegionCode } from '@prisma/client';
import type { ProviderKind } from '@d2d/integrations';
import {
  type ContentGenerationJobPublic,
  type ProviderDescriptorPublic,
  MarketingService,
} from '../marketing/service';
import type { AvatarJobRequest, CopyJobRequest, ImageJobRequest, VideoJobRequest } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

const CONTENT_CAPABILITIES = new Set([
  'creative.generate.text',
  'creative.generate.image',
  'creative.generate.video',
  'creative.generate.avatar',
]);

export class ContentStudioService {
  constructor(private readonly marketing: MarketingService) {}

  async listProviders(orgId: string): Promise<ProviderDescriptorPublic[]> {
    const all = await this.marketing.listProviders(orgId);
    return all.filter((p) => p.capabilities.some((c) => CONTENT_CAPABILITIES.has(c)));
  }

  async submitCopy(req: CopyJobRequest, actor: ActorContext): Promise<ContentGenerationJobPublic> {
    const providerKind: ProviderKind = req.providerOverride ?? 'claude_copy';
    const { providerOverride, ...input } = req;
    void providerOverride;
    return this.marketing.generateCreative(
      { capability: 'creative.generate.text', providerKind, input },
      actor,
    );
  }

  async submitImage(
    req: ImageJobRequest,
    actor: ActorContext,
  ): Promise<ContentGenerationJobPublic> {
    const providerKind: ProviderKind = req.providerOverride ?? 'flux_image';
    const { providerOverride, ...input } = req;
    void providerOverride;
    return this.marketing.generateCreative(
      { capability: 'creative.generate.image', providerKind, input },
      actor,
    );
  }

  async submitVideo(
    req: VideoJobRequest,
    actor: ActorContext,
  ): Promise<ContentGenerationJobPublic> {
    const providerKind: ProviderKind = req.providerOverride ?? 'runway_video';
    const { providerOverride, ...input } = req;
    void providerOverride;
    return this.marketing.generateCreative(
      { capability: 'creative.generate.video', providerKind, input },
      actor,
    );
  }

  async submitAvatar(
    req: AvatarJobRequest,
    actor: ActorContext,
  ): Promise<ContentGenerationJobPublic> {
    return this.marketing.generateCreative(
      {
        capability: 'creative.generate.avatar',
        providerKind: 'heygen_avatar',
        input: req,
      },
      actor,
    );
  }

  async getJob(id: string, actor: ActorContext): Promise<ContentGenerationJobPublic> {
    return this.marketing.getJob(id, actor);
  }
}
