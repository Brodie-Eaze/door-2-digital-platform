'use client';

/**
 * Dynamic (ssr:false) wrapper for the canvass-area Leaflet map. Mirrors the
 * TerritoryHeatmap wrapper pattern — Leaflet touches window/document, so the
 * impl module must never render on the server.
 */

import dynamic from 'next/dynamic';
import type { DrawMode, PropensityPoint, RadiusDraft, SavedArea } from './CanvassAreaMapImpl';

export type { DrawMode, PropensityPoint, RadiusDraft, SavedArea };

type Props = {
  points: PropensityPoint[];
  center: [number, number];
  defaultZoom: number;
  drawMode: DrawMode;
  radiusDraft: RadiusDraft | null;
  polygonDraft: Array<[number, number]>;
  savedArea: SavedArea | null;
  onMapClick: (lat: number, lng: number) => void;
  onMapDoubleClick: () => void;
};

export const CanvassAreaMap = dynamic<Props>(
  () => import('./CanvassAreaMapImpl').then((m) => m.CanvassAreaMapImpl),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-line2 bg-ink flex items-center justify-center text-soft text-[12px]"
        style={{ height: 560 }}
      >
        Loading canvass-area map…
      </div>
    ),
  },
);
