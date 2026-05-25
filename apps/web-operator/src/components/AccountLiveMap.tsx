'use client';

/**
 * Per-account live satellite map. Mirrors the HQ Command Centre map but
 * scoped to a single sub-account's reps + AI zones. Leaflet needs the DOM
 * (window, document) so SSR is disabled for the impl module.
 */

import dynamic from 'next/dynamic';

interface AccountLiveMapProps {
  accountSlug: string;
}

export const AccountLiveMap = dynamic<AccountLiveMapProps>(
  () => import('./AccountLiveMapImpl').then((m) => m.AccountLiveMapImpl),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-line2 bg-ink flex items-center justify-center text-soft text-[12px]"
        style={{ height: 560 }}
      >
        Loading satellite map…
      </div>
    ),
  },
);
