import { Phone, Mail, MapPin } from 'lucide-react';
import { StatusPill, STATUS_TONE, humaniseStatus } from './StatusPill';
import { cn } from '../lib/cn';

interface LeadCardProps {
  givenName: string;
  familyName: string;
  status: string;
  address?: string;
  phone?: string;
  email?: string;
  /** Source label ('door' | 'inside_sales' | 'retargeting'). */
  attributionSource?: string;
  /** Optional assignee badge. */
  assignee?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Lead summary card — name, status, contact, source.
 * Tap/click drills into lead detail.
 */
export function LeadCard({
  givenName,
  familyName,
  status,
  address,
  phone,
  email,
  attributionSource,
  assignee,
  onClick,
  className,
}: LeadCardProps): JSX.Element {
  const tone = STATUS_TONE[status] ?? 'muted';

  return (
    <button
      onClick={onClick}
      className={cn(
        'card card-pad text-left w-full hover:shadow-md transition cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink tracking-tight truncate">
            {givenName} {familyName}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <StatusPill tone={tone}>{humaniseStatus(status)}</StatusPill>
            {attributionSource && <span className="tag">{humaniseStatus(attributionSource)}</span>}
          </div>
        </div>
        {assignee && <span className="mono shrink-0">{assignee.slice(0, 2).toUpperCase()}</span>}
      </div>

      {(address || phone || email) && (
        <div className="mt-3 space-y-1 text-[12px] text-muted">
          {address && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className="text-soft shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-1.5">
              <Phone size={12} className="text-soft shrink-0" />
              <span className="truncate numeric">{phone}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-1.5">
              <Mail size={12} className="text-soft shrink-0" />
              <span className="truncate">{email}</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
