import { Clock, MapPin } from 'lucide-react';
import { StatusPill, STATUS_TONE, humaniseStatus } from './StatusPill';
import { cn } from '../lib/cn';

interface KnockCardProps {
  address: string;
  disposition: string;
  /** Knocker initials or name. */
  knocker: string;
  /** Captured-at as human-readable string (e.g. '3m ago'). */
  capturedAt: string;
  /** Optional occupant guess captured at the door. */
  occupant?: string;
  /** Optional thumb of the captured photo URL. */
  photoUrl?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Knock card — compact summary for lists + map flyouts.
 */
export function KnockCard({
  address,
  disposition,
  knocker,
  capturedAt,
  occupant,
  photoUrl,
  onClick,
  className,
}: KnockCardProps): JSX.Element {
  const tone = STATUS_TONE[disposition] ?? 'muted';

  return (
    <button
      onClick={onClick}
      className={cn(
        'card card-pad text-left w-full hover:shadow-md transition cursor-pointer flex items-start gap-3',
        className,
      )}
    >
      {photoUrl ? (
        // ui-web is framework-agnostic; consumers wrap with next/image if desired.
        <img
          src={photoUrl}
          alt=""
          className="w-12 h-12 rounded-lg object-cover shrink-0 border border-line2"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-line2 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink tracking-tight flex items-center gap-1.5">
              <MapPin size={12} className="text-soft shrink-0" />
              <span className="truncate">{address}</span>
            </div>
            {occupant && <div className="text-[11px] text-muted mt-0.5 truncate">{occupant}</div>}
          </div>
          <StatusPill tone={tone}>{humaniseStatus(disposition)}</StatusPill>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
          <span className="mono">{knocker.slice(0, 2).toUpperCase()}</span>
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-soft" />
            {capturedAt}
          </span>
        </div>
      </div>
    </button>
  );
}
