'use client';

/**
 * Client-only action controls for the (server-rendered) invoices page.
 * The page itself stays a server component so its bigint billing math runs
 * server-side; only these honest, deferred-action buttons need the client.
 */

import { Download, ExternalLink, Send } from 'lucide-react';
import { Button } from '@d2d/ui-web';
import { toast } from '@/components/Toaster';

export function ExportCsvButton(): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={<Download size={13} />}
      onClick={() => toast.info('Export CSV — invoice export lands in Phase 1.2')}
    >
      Export CSV
    </Button>
  );
}

export function InvoiceRowActions({ invoiceId }: { invoiceId: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => toast.info(`View PDF for ${invoiceId} — PDF render lands in Phase 1.2`)}
        className="text-soft hover:text-ink p-1 rounded hover:bg-paper"
        title="View PDF"
        aria-label={`View PDF for ${invoiceId}`}
      >
        <ExternalLink size={13} />
      </button>
      <button
        onClick={() => toast.info(`Resend ${invoiceId} — email resend lands in Phase 1.2`)}
        className="text-soft hover:text-ink p-1 rounded hover:bg-paper"
        title="Resend"
        aria-label={`Resend ${invoiceId}`}
      >
        <Send size={13} />
      </button>
    </div>
  );
}
