'use client';

/**
 * Noctua iPhone map — REAL satellite imagery.
 *
 * Uses Esri World Imagery tiles (free, no API key required for non-commercial
 * use; attribution preserved). Leaflet renders inside the iPhone mock frame.
 *
 * Overlays a territory polygon + knock pins so the demo looks like a real
 * field rep checking their assigned turf.
 */
import dynamic from 'next/dynamic';

// Leaflet only works client-side. Dynamic-load it to skip SSR.
export const NoctuaPhoneMap = dynamic(() => import('./NoctuaPhoneMapImpl'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-paper flex items-center justify-center text-[10px] text-soft">
      Loading satellite imagery…
    </div>
  ),
});
