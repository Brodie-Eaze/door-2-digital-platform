/**
 * Marketing Studio-specific empty states not already covered by
 * AccountEmptyStates.tsx (which owns MarketingStudioEmpty, MarketingLibraryEmpty,
 * MarketingIntegrationsEmpty, MarketingCampaignsEmpty — reuse those directly).
 *
 * Same client-leaf pattern: 'use client', lucide icons, `EmptyState` from
 * @d2d/ui-web, `{slug, accountName, placement?}` props.
 */

'use client';

import { ShieldCheck, Target } from 'lucide-react';
import { EmptyState } from '@d2d/ui-web';

interface SurfaceProps {
  slug: string;
  accountName: string;
  placement?: 'page' | 'inline';
}

export function BrandSafetyEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="No creatives scanned yet."
      description="Every Creative gets a moderation pass at generation time — the result lands on the creative itself, so this fills in the moment you generate your first one. There is no separate rule-pack engine yet; scans surface here as-is."
      primaryAction={{
        label: 'Generate a creative',
        href: `/accounts/${slug}/marketing-studio/generate`,
      }}
      secondaryAction={{
        label: 'View library',
        href: `/accounts/${slug}/marketing-studio/library`,
      }}
      variant="first-run"
      bare={placement === 'inline'}
    />
  );
}

export function RetargetingEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Target}
      title="No retargeting audience configured."
      description="Retargeting rides on an AdCampaign's audience definition — there is no separate cohort model yet. Launch a campaign with an audience in Campaigns and it will show up here."
      primaryAction={{
        label: 'Open campaigns',
        href: `/accounts/${slug}/marketing-studio/campaigns`,
      }}
      secondaryAction={{
        label: 'Connect ad providers',
        href: `/accounts/${slug}/marketing-studio/integrations`,
      }}
      variant="first-run"
      bare={placement === 'inline'}
    />
  );
}
