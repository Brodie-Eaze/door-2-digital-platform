'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Silent session refresh. The API issues a 5-minute d2d_at access cookie and a
 * 30-day d2d_rt refresh cookie scoped to Path=/v1/auth. Server components can
 * never rotate cookies, so this client keeper POSTs /v1/auth/refresh (the
 * path-preserving rewrite — see next.config.mjs). A failed refresh means the
 * session is genuinely over → /login.
 *
 * Robustness: it renews immediately on mount (so a navigation never starts from
 * a near-expired token), then every 3 minutes — comfortably inside the 5-minute
 * access-token life, so there's always ~2 minutes of headroom — plus on tab
 * focus and whenever a backgrounded tab becomes visible again (the case where
 * the token lapsed while the tab was hidden). Token lifetimes / secrets are
 * unchanged; this only renews the client's access cookie sooner + more often.
 */
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

export function SessionKeeper(): null {
  const router = useRouter();

  useEffect(() => {
    // Only when a real API is wired (build-time). In demo mode the synthetic
    // session cookie has no /v1/auth/refresh to renew against, so the keeper
    // would 401 and bounce demo users to /login every tick.
    if (!process.env.NEXT_PUBLIC_API_URL) return undefined;
    let cancelled = false;

    async function refresh(): Promise<void> {
      // Never renew on the login screen — there's no live session to refresh.
      if (window.location.pathname === '/login') return;
      try {
        const res = await fetch('/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (!cancelled && (res.status === 401 || res.status === 403)) {
          router.push('/login');
        }
      } catch {
        // Offline / transient — keep the session; next tick retries.
      }
    }

    void refresh(); // proactive renew on mount
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onFocus = (): void => void refresh();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
