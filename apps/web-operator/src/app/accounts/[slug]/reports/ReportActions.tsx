'use client';

/**
 * Client-only action controls for the (server-rendered) reports page.
 * The page stays a server component so the seed/rollup bigint math runs
 * server-side; only these honest, deferred-action controls need the client.
 */

import { BarChart3, ChevronRight, Download } from 'lucide-react';
import { Button } from '@d2d/ui-web';
import { toast } from '@/components/Toaster';

export function BuildReportButton(): JSX.Element {
  return (
    <Button
      variant="primary"
      size="sm"
      leftIcon={<BarChart3 size={13} />}
      onClick={() => toast.info('Build report — report builder lands in Phase 1.2')}
    >
      Build report
    </Button>
  );
}

/**
 * Clickable saved-report card. The whole card opens the (deferred) report
 * view; the inner CSV button stops propagation and fires its own honest toast.
 */
export function SavedReportCard({
  title,
  schedule,
  last,
}: {
  title: string;
  schedule: string;
  last: string;
}): JSX.Element {
  const open = (): void =>
    toast.info(`Open "${title}" — saved-report view lands in Phase 1.2`);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="card card-pad hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold text-ink">{title}</div>
          <div className="text-[11px] text-muted mt-0.5">{schedule}</div>
        </div>
        <ChevronRight size={14} className="text-soft" />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-muted">Last run {last}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.info(`Export "${title}" CSV — wiring lands in Phase 1.2`);
          }}
          className="text-accent font-medium hover:underline flex items-center gap-1"
        >
          <Download size={11} /> CSV
        </button>
      </div>
    </div>
  );
}
