'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Silent session refresh. The API issues a 5-minute d2d_at access cookie and a
 * 30-day d2d_rt refresh cookie scoped to Path=/v1/auth. Server components can
 * never rotate cookies, so this client keeper POSTs /v1/auth/refresh (the
 * path-preserving rewrite — see next.config.mjs) every 4 minutes and on tab
 * focus. A failed refresh means the session is genuinely over → /login.
 */
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

export function SessionKeeper(): null {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') return undefined;
    let cancelled = false;

    async function refresh(): Promise<void> {
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

    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onFocus = (): void => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [pathname, router]);

  return null;
}
