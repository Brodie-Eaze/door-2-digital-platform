'use client';

import { useEffect, useState } from 'react';
import type { AccountMeta } from '@/app/api/accounts/[slug]/meta/route';

/**
 * Live account header metadata (name / region / avatar) for a slug, fetched
 * from /api/accounts/[slug]/meta. Replaces the synchronous `@/lib/accounts`
 * fixture lookup in client header surfaces. Returns null until the first
 * answer — callers render a neutral placeholder (never a fabricated name).
 */
export function useAccountMeta(slug: string): AccountMeta | null {
  const [meta, setMeta] = useState<AccountMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const res = await fetch(`/api/accounts/${slug}/meta`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as AccountMeta;
        if (!cancelled) setMeta(data);
      } catch {
        // Keep null; the caller shows a neutral default (prettified slug).
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [slug]);
  return meta;
}

/** Human-readable fallback name from a slug while the live meta loads. */
export function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * 2-letter monogram from a display name. Duplicated from the (fixture-backed)
 * `@/lib/accounts` so header surfaces can build a monogram without importing
 * the static account fleet. Pure — no data.
 */
export function monogramFrom(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}
