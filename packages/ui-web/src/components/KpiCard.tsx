import type { ReactNode } from 'react';
import { Card } from './Card';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Optional delta string ('+12.4%' or '-3') with implied tone. */
  delta?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  /** Optional sparkline or small chart slot. */
  sparkline?: ReactNode;
  /** Optional sub-label below the value. */
  hint?: string;
}

/**
 * KPI card — uppercase label, large numeric value, optional delta + spark.
 * Mirrors EazePay Intelligence KpiCard style.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  sparkline,
  hint,
}: KpiCardProps): JSX.Element {
  const deltaClass =
    deltaTone === 'positive'
      ? 'text-success'
      : deltaTone === 'negative'
        ? 'text-rose-600'
        : 'text-muted';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-section">{label}</div>
          <div className="mt-2 text-[20px] leading-tight font-semibold text-ink tracking-tight numeric">
            {value}
          </div>
          {(delta || hint) && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {delta && <span className={`${deltaClass} numeric`}>{delta}</span>}
              {hint && <span className="text-muted">{hint}</span>}
            </div>
          )}
        </div>
        {sparkline && <div className="shrink-0">{sparkline}</div>}
      </div>
    </Card>
  );
}
