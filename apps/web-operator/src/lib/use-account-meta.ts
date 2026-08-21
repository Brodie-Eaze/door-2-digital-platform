'use client';

import { useEffect, useState } from 'react';
import type { AccountMeta } from '@/app/api/accounts/[slug]/meta/route';
import type { AccountListItem } from '@/app/api/accounts/list/route';

// Pure formatters live in a plain (non-client) module so server components can
// use them too; re-exported here for the client consumers that already import
// them from this hook module.
export { prettifySlug, monogramFrom } from './account-color';

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

/**
 * The accounts the caller may switch between, live from /api/accounts/list.
 * Returns [] until the first answer (the switcher shows only the current
 * account meanwhile — never a fixture fleet).
 */
export function useAccountList(): AccountListItem[] {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const res = await fetch('/api/accounts/list');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { accounts?: AccountListItem[] };
        if (!cancelled && Array.isArray(data.accounts)) setAccounts(data.accounts);
      } catch {
        // Keep []; the switcher still shows the current account.
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, []);
  return accounts;
}
