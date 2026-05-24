import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../lib/cn';
import type { Tone } from '../types';

interface AnomalyCardProps {
  /** Severity drives icon + color. */
  severity: 'critical' | 'warning' | 'info';
  title: string;
  /** One-line explanation. */
  description: string;
  /** Primary action shown bottom-right. */
  action?: ReactNode;
  /** Optional secondary action ("snooze", "dismiss"). */
  secondaryAction?: ReactNode;
  /** Optional timestamp/age string. */
  timestamp?: string;
  className?: string;
}

const SEVERITY_STYLE: Record<AnomalyCardProps['severity'], { tone: Tone; icon: typeof Info }> = {
  critical: { tone: 'danger', icon: AlertCircle },
  warning: { tone: 'warn', icon: AlertTriangle },
  info: { tone: 'info', icon: Info },
};

/**
 * Anomaly card — used on the "Today" page (anomaly-first home).
 * Mirrors the amala-ops mission-control pattern Brodie set.
 */
export function AnomalyCard({
  severity,
  title,
  description,
  action,
  secondaryAction,
  timestamp,
  className,
}: AnomalyCardProps): JSX.Element {
  const { icon: Icon } = SEVERITY_STYLE[severity];
  const iconColor =
    severity === 'critical'
      ? 'text-danger'
      : severity === 'warning'
        ? 'text-warn'
        : 'text-accent';

  return (
    <div className={cn('card card-pad flex items-start gap-3', className)}>
      <div className="shrink-0 mt-0.5">
        <Icon size={18} className={iconColor} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink tracking-tight">{title}</div>
            <div className="text-xs text-muted mt-0.5">{description}</div>
          </div>
          {timestamp && <span className="text-[10px] text-soft shrink-0">{timestamp}</span>}
        </div>
        {(action || secondaryAction) && (
          <div className="mt-3 flex items-center gap-2">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
