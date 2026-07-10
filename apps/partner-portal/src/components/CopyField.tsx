'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * A read-only value with a copy-to-clipboard affordance — used for the SAML
 * service-provider metadata the client's IT team pastes into their IdP.
 * Uses the platform clipboard API only; no dependency.
 */
export function CopyField({ label, value }: { label: string; value: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the value stays
      // selectable, so this is a graceful no-op rather than an error.
    }
  }

  return (
    <div>
      <div className="h-section">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] text-ink2 font-mono">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted hover:text-ink hover:border-line2 transition-colors"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
