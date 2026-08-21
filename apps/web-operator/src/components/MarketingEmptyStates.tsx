'use client';

/**
 * Platform-level (cross-account) Marketing Studio empty states. Mirrors
 * PlatformEmptyStates.tsx / AccountEmptyStates.tsx: small 'use client' leaves
 * so a Lucide icon component reference never crosses a Server → Client
 * Component prop boundary. No `slug` prop — every Marketing Studio page in
 * this file is the HQ (cross-org) surface, not a per-account workspace.
 */

import { Sparkles, ImageIcon, Plug, Target, ShieldCheck, Megaphone, UserCheck } from 'lucide-react';
import { EmptyState } from '@d2d/ui-web';

export function MarketingPipelineEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Sparkles}
      title="No generation jobs yet."
      description="Every brief run from the Generator persists a ContentGenerationJob row here — compose, image, video, and avatar calls, with cost and status."
      primaryAction={{ label: 'Generate a creative', href: '/marketing-studio/generate' }}
      variant="first-run"
      bare
    />
  );
}

export function CreativeLibraryEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={ImageIcon}
      title="No creatives generated yet."
      description="Approved and draft creatives across every account land here the moment a generation job completes. Generate your first brief to populate the library."
      primaryAction={{ label: 'Generate creative', href: '/marketing-studio/generate' }}
      variant="first-run"
    />
  );
}

export function IntegrationsEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Plug}
      title="No provider connections yet."
      description="Connect Meta, Google, or a copy/image/video provider from any account's Integrations tab. Every ProviderConnection row — sandbox or production — shows up here across the whole platform."
      variant="default"
      bare
    />
  );
}

export function RetargetingEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Target}
      title="Retargeting audiences aren't configured yet."
      description="Retargeting builds from an AdCampaign's audienceJson once a campaign exists with a defined audience. There's no fabricated funnel here — connect a provider, publish a campaign with an audience, and this surface populates from that real data."
      primaryAction={{ label: 'Open Campaigns', href: '/marketing-studio/campaigns' }}
      secondaryAction={{ label: 'Connect a provider', href: '/marketing-studio/integrations' }}
      variant="default"
    />
  );
}

export function BrandSafetyEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="No creatives to scan yet."
      description="Every Creative row carries a real safetyScanResult column. This fills in the moment the first generation job produces a creative with a scan result attached."
      primaryAction={{ label: 'Generate a creative', href: '/marketing-studio/generate' }}
      variant="default"
    />
  );
}

export function CampaignsEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Megaphone}
      title="No ad campaigns yet."
      description="AdCampaigns are created when a draft in the review queue publishes to a connected provider. Approve creatives in the Generator, then publish from the Review queue."
      primaryAction={{ label: 'Open review queue', href: '/marketing-studio/review-queue' }}
      secondaryAction={{ label: 'Connect a provider', href: '/marketing-studio/integrations' }}
      variant="first-run"
    />
  );
}

export function ApprovalQueueEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={UserCheck}
      title="Approval queue is clear."
      description="Creatives awaiting a human decision (approvedAt not yet set) show up here across every account."
      variant="default"
      bare
    />
  );
}
