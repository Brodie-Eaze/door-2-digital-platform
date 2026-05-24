'use client';

/**
 * HQ Command Centre — live, interactive satellite map.
 *
 * Dynamic wrapper for the Leaflet-based implementation. Leaflet needs the
 * DOM (window, document) so we MUST disable SSR for the impl module.
 */

import dynamic from 'next/dynamic';

export const HQLiveMap = dynamic(() => import('./HQLiveMapImpl').then((m) => m.HQLiveMapImpl), {
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
