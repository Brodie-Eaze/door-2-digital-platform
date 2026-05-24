import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface SectionProps {
  title: string;
  subtitle?: string;
  /** Right-aligned action (e.g. button, dropdown). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Set false to skip the default p-5 body padding (e.g. for tables). */
  paddedBody?: boolean;
}

/**
 * Content section — title + subtitle in head, body underneath. Same visual
 * surface as Card but with a divided head/body. Tables go in unpadded body.
 */
export function Section({
  title,
  subtitle,
  action,
  children,
  className,
  paddedBody = true,
}: SectionProps): JSX.Element {
  return (
    <div className={cn('section', className)}>
      <div className="section-head">
        <div>
          <div className="section-title">{title}</div>
          {subtitle && <div className="section-sub">{subtitle}</div>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className={paddedBody ? 'section-body' : ''}>{children}</div>
    </div>
  );
}
