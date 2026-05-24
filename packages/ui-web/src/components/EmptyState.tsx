import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div className={cn('text-center py-12 px-6', className)}>
      {Icon && (
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-line2 mb-4">
          <Icon size={20} className="text-soft" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-muted max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
