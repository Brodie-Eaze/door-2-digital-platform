/**
 * Shared types for the per-account field-ops panels.
 *
 * Used by AiNextZonesPanel, AnomaliesPanel, LiveActivityFeed, PushToFieldStrip
 * — and by every page (HQ /command-centre + each sub-account /live-map) that
 * feeds them data.
 */

export interface AiZoneSuggestion {
  id: string;
  /** Human label, e.g. "Austin South · 78704" */
  name: string;
  /** Propensity score 0..1 — shown as 0.81 etc. */
  propensity: number;
  /** One-liner explanation shown under the name */
  reasonOneLiner: string;
  /** Estimated lift in percentage points vs current avg */
  estLiftPp: number;
  /** Current saturation of this zone (0..100). Used in display. */
  saturationPercent: number;
  /** How many reps the AI thinks should be deployed there */
  recommendedReps: number;
}

export interface AnomalyItem {
  id: string;
  severity: 'critical' | 'warn' | 'info';
  title: string;
  detail: string;
  /** Label on the action link, e.g. "Reassign", "Nudge", "Open 1:1" */
  actionLabel: string;
  /** Optional href — if absent, the action is a button-only click */
  actionHref?: string;
  /**
   * Optional signature-interaction wiring. When present on a 'critical'
   * anomaly the Command Centre flies the map to the offline rep, highlights
   * their pin, and opens the reassign drawer. Absent on non-reassign
   * anomalies — they keep an honest queue toast.
   */
  /** Fleet rep id this anomaly is about (matches a live /api/fleet entry). */
  repId?: string;
  /** Coordinates of that rep — the map flies here. */
  repCoords?: { lat: number; lng: number };
  /** Territory the offline rep was covering, if backed by a Territory row. */
  territoryId?: string;
  /** Human label of that territory, e.g. "Houston SE". */
  territoryName?: string;
}

export type ActivityEventType =
  | 'conversion'
  | 'knock_lead'
  | 'knock_sale'
  | 'knock_not_home'
  | 'callback_scheduled'
  | 'shift_start'
  | 'shift_break_return'
  | 'shift_break_start';

export interface ActivityEvent {
  id: string;
  /** Time stamp string — e.g. "14:42" */
  at: string;
  actorInitials: string;
  type: ActivityEventType;
  /** Primary line — e.g. "Conversion captured", "Knock recorded · LEAD" */
  primary: string;
  /** Secondary line — e.g. "Maria Santos · $24/mo · Austin East" */
  secondary: string;
}

export type PushToFieldAction =
  | 'broadcast_message'
  | 'update_pitch_script'
  | 'reassign_territories'
  | 'end_shift_early';
