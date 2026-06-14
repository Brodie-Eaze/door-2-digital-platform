'use client';

/**
 * HQ Command Centre — live, interactive satellite map.
 *
 * Dynamic wrapper for the Leaflet-based implementation. Leaflet needs the
 * DOM (window, document) so we MUST disable SSR for the impl module.
 */

import dynamic from 'next/dynamic';
import type { HQLiveMapProps } from './HQLiveMapImpl';

export type { HQLiveMapProps } from './HQLiveMapImpl';

const HQLiveMapDynamic = dynamic(() => import('./HQLiveMapImpl').then((m) => m.HQLiveMapImpl), {
  ssr: false,
  loading: () => (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-line2 bg-ink flex items-center justify-center text-soft text-[12px]"
      style={{ height: 640 }}
    >
      Loading satellite map…
    </div>
  ),
});

/**
 * Client wrapper that forwards the signature-interaction props
 * (flyTarget + highlightCoords) through the SSR-disabled dynamic boundary.
 */
export function HQLiveMap(props: HQLiveMapProps): JSX.Element {
  return <HQLiveMapDynamic {...props} />;
}
