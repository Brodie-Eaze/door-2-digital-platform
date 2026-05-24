import { cn } from '../lib/cn';
import type { Tone } from '../types';

interface StatusPillProps {
  /** Display label. */
  children: React.ReactNode;
  /** Visual tone. Use the helper map for D2D enums. */
  tone?: Tone;
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'pill-success',
  warn: 'pill-warn',
  danger: 'pill-danger',
  info: 'pill-info',
  muted: 'pill-muted',
};

/** D2D status-to-tone map. Extend per domain. */
export const STATUS_TONE: Record<string, Tone> = {
  // Knock dispositions
  converted_donation: 'success',
  converted_sale: 'success',
  appointment: 'info',
  callback: 'info',
  not_interested: 'muted',
  no_answer: 'muted',
  do_not_knock: 'danger',
  hostile: 'danger',
  invalid_address: 'warn',

  // Lead statuses
  new: 'info',
  contacted: 'info',
  qualified: 'success',
  appointment_set: 'success',
  converted: 'success',
  lost: 'muted',
  do_not_contact: 'danger',

  // Payout statuses
  draft: 'muted',
  ready_to_pay: 'info',
  instructed: 'warn',
  acknowledged: 'success',
  archived: 'muted',

  // Solicitor registration statuses
  pending: 'warn',
  submitted: 'info',
  approved: 'success',
  expired: 'danger',
  rejected: 'danger',

  // Webhook delivery statuses
  delivered: 'success',
  failed: 'danger',
  dlq: 'danger',
};

export function StatusPill({ children, tone = 'muted', className }: StatusPillProps): JSX.Element {
  return <span className={cn('pill', TONE_CLASS[tone], className)}>{children}</span>;
}

/** Convert raw status string to display label (snake_case → Title Case). */
export function humaniseStatus(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
