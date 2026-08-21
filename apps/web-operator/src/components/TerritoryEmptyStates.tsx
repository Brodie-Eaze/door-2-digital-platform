/**
 * Territory-intel-specific empty states — the propensity HEAT LAYER.
 *
 * Distinct from "no territories drawn yet" (see AccountEmptyStates ·
 * TerritoriesEmpty / PlatformEmptyStates): a territory can exist with zero
 * PropensityScore rows. That's the honest, expected state until the scoring
 * job has enough Knock volume to compute a signal — never fabricate cell
 * scores to fill the gap. Mirrors PlatformEmptyStates.tsx's pattern: a small
 * 'use client' leaf so the Lucide icon reference never crosses the
 * Server → Client Component boundary.
 */

'use client';

import { Radar, Map as MapIcon } from 'lucide-react';
import { EmptyState } from '@d2d/ui-web';

interface PropensityEmptyProps {
  /** Visual placement — `inline` drops it inside a Section card (heat-layer
   *  slot), `page` is the full-page hero. Defaults to `inline`. */
  placement?: 'page' | 'inline';
}

/**
 * Platform-wide Territory Intel — no Territory rows exist for this org yet.
 * The per-account equivalent is AccountEmptyStates.TerritoriesEmpty (needs a
 * slug); this variant is for the cross-account HQ surface which has none.
 */
export function PlatformTerritoriesEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={MapIcon}
      title="No territories drawn yet."
      description="Territories are drawn per sub-account — open an account and set its first canvass area to see it ranked here."
      primaryAction={{ label: 'Open accounts', href: '/accounts' }}
      variant="first-run"
    />
  );
}

/** Platform-wide Territory Intel — no PropensityScore rows for this org yet. */
export function PropensityHeatEmpty({ placement = 'inline' }: PropensityEmptyProps): JSX.Element {
  return (
    <EmptyState
      icon={Radar}
      title="Propensity scores build as knock data accumulates."
      description="The heat layer scores neighbourhoods from your Knock history plus census/segment priors. It fills in once the scoring job has enough conversions to rank zones — territories themselves still show below."
      variant="default"
      bare={placement === 'inline'}
    />
  );
}

/** Per-account Territories page — same gap, scoped to one org's name. */
export function AccountPropensityHeatEmpty({
  accountName,
  placement = 'inline',
}: PropensityEmptyProps & { accountName: string }): JSX.Element {
  return (
    <EmptyState
      icon={Radar}
      title="Propensity scores build as knock data accumulates."
      description={`The heat layer scores neighbourhoods from ${accountName}'s knock history plus census/segment priors. It fills in once the scoring job has enough conversions to rank zones.`}
      variant="default"
      bare={placement === 'inline'}
    />
  );
}
