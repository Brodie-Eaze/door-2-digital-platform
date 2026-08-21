'use client';

/**
 * Territory Intel — interactive Leaflet propensity heatmap.
 *
 * Dynamic wrapper for the Leaflet-based implementation. Leaflet needs the
 * DOM (window, document) so we MUST disable SSR for the impl module.
 */

import dynamic from 'next/dynamic';
import type { CellStatus, PropensityHeatPoint, ZoneSelection } from './TerritoryHeatmapImpl';

export type { CellStatus, PropensityHeatPoint, ZoneSelection };

type Props = {
  onSelect: (cell: ZoneSelection | null) => void;
  assignedSet: Set<string>;
  statusFilter?: 'all' | CellStatus;
  /** Real Territory-derived cells — the clickable "zone" layer. */
  cells: ZoneSelection[];
  /** Real PropensityScore points — the non-interactive AI heat layer. */
  propensityPoints?: PropensityHeatPoint[];
  /** Override map center (defaults to Texas). */
  center?: [number, number];
  /** Override default zoom (defaults to 6). */
  defaultZoom?: number;
  /** Optional scope label shown in the legend (e.g. "PestMax · TX + AZ"). */
  scopeLabel?: string;
};

export const TerritoryHeatmap = dynamic<Props>(
  () => import('./TerritoryHeatmapImpl').then((m) => m.TerritoryHeatmapImpl),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-line2 bg-ink flex items-center justify-center text-soft text-[12px]"
        style={{ height: 620 }}
      >
        Loading territory heatmap…
      </div>
    ),
  },
);
