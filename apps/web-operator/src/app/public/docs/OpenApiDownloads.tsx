'use client';

import { Download } from 'lucide-react';
import { toast } from '@/components/Toaster';

/**
 * Client island for the OpenAPI download buttons. The page itself stays a
 * server component (it exports `metadata`), so the honest toast lives here.
 */
export function OpenApiDownloads(): JSX.Element {
  return (
    <>
      <button
        type="button"
        onClick={() => toast.info('openapi.yaml — spec publishes at GA')}
        className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition"
      >
        <Download className="h-4 w-4" />
        openapi.yaml
      </button>
      <button
        type="button"
        onClick={() => toast.info('openapi.json — spec publishes at GA')}
        className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3 rounded-md border border-line hover:bg-paper transition"
      >
        <Download className="h-4 w-4" />
        openapi.json
      </button>
    </>
  );
}
