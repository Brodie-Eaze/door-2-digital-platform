'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Coffee,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  CheckCircle2,
  LogOut,
  CopyPlus,
  Save,
  Trash2,
  MoveRight,
  MapPin,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { toast } from '@/components/Toaster';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';

type ShiftStatus = 'scheduled' | 'active' | 'lunch' | 'missed' | 'completed';

interface Shift {
  id: string;
  repInitials: string;
  repName: string;
  account: string;
  day: number; // 0 = Mon ... 6 = Sun
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  territory: string;
  lunch?: string; // 'HH:MM-HH:MM' or 'HH:MM-CURRENT'
  status: ShiftStatus;
}

interface Rep {
  initials: string;
  name: string;
  account: string;
}

const REPS: Rep[] = [
  { initials: 'JM', name: 'Jordan Mosley', account: 'Hope Forward' },
  { initials: 'JD', name: 'Jada Davis', account: 'Hope Forward' },
  { initials: 'AR', name: 'Aaliyah Reed', account: 'Hope Forward' },
  { initials: 'TM', name: 'Tomás Mendez', account: 'Hope Forward' },
  { initials: 'AM', name: 'Asha Mehta', account: 'Hope Forward' },
  { initials: 'BC', name: 'Bianca Costa', account: 'PestMax' },
  { initials: 'HK', name: 'Hiroshi Kato', account: 'PestMax' },
  { initials: 'KP', name: 'Kim Park', account: 'Hope Forward' },
  { initials: 'DR', name: 'Devon Russell', account: 'Hope Forward' },
  { initials: 'ML', name: 'Marcus Lee', account: 'Hope Forward' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─────────────────────────────────────────────────────────────────────────────
// Compliance thresholds — labor-hour limits for scheduling guardrails.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_HOURS_PER_DAY = 10;
const MAX_HOURS_PER_WEEK = 40;

interface RosterUser {
  id: string;
  role: string;
  initials: string;
}

/** Look up a rep within a known list, falling back to a synthesized record so a
 * rep that exists only in live shift data (not in the roster directory) still
 * renders rather than collapsing onto REPS[0]. */
function repByInitialsIn(initials: string, reps: Rep[]): Rep {
  return (
    reps.find((r) => r.initials === initials) ??
    REPS.find((r) => r.initials === initials) ?? { initials, name: initials, account: '—' }
  );
}

function repByInitials(initials: string): Rep {
  return REPS.find((r) => r.initials === initials) ?? REPS[0]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict detection — the scheduling moat. Pure, side-effect free, testable.
// ─────────────────────────────────────────────────────────────────────────────

/** Convert 'HH:MM' to minutes-since-midnight. */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Do two [start,end) ranges (in minutes) overlap? Touching edges don't count. */
function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

interface ConflictResult {
  hasConflict: boolean;
  /** Human-readable reasons, e.g. "JM already 09:00–17:00 Mon". */
  reasons: string[];
}

/**
 * Flags two classes of scheduling conflict for a candidate shift against the
 * rest of the roster (excluding the candidate's own id):
 *   (a) same rep + same day + overlapping start/end time
 *   (b) same rep assigned two different territories on the same day
 * Warn-don't-block: callers surface this but still allow the save.
 */
function detectConflict(candidate: Shift, allShifts: Shift[]): ConflictResult {
  const reasons: string[] = [];
  const sameRepDay = allShifts.filter(
    (s) =>
      s.id !== candidate.id && s.repInitials === candidate.repInitials && s.day === candidate.day,
  );

  const cStart = toMinutes(candidate.start);
  const cEnd = toMinutes(candidate.end);
  const dayLabel = DAY_LABELS[candidate.day] ?? `Day ${candidate.day}`;

  for (const other of sameRepDay) {
    // (a) Overlapping time window.
    if (rangesOverlap(cStart, cEnd, toMinutes(other.start), toMinutes(other.end))) {
      reasons.push(`${candidate.repName} already ${other.start}–${other.end} ${dayLabel}`);
    }
    // (b) Two different territories same day.
    if (other.territory !== candidate.territory) {
      reasons.push(
        `${candidate.repName} double-booked ${candidate.territory} + ${other.territory} ${dayLabel}`,
      );
    }
  }

  // De-duplicate identical reason strings.
  const unique = [...new Set(reasons)];
  return { hasConflict: unique.length > 0, reasons: unique };
}

/** Set of shift ids that are currently in conflict, for badge rendering. */
function conflictedShiftIds(allShifts: Shift[]): Set<string> {
  const ids = new Set<string>();
  for (const s of allShifts) {
    if (detectConflict(s, allShifts).hasConflict) ids.add(s.id);
  }
  return ids;
}

function buildSeed(): Shift[] {
  const raw: Array<Omit<Shift, 'id' | 'repName' | 'account'>> = [
    // JM
    {
      repInitials: 'JM',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      lunch: '12:00-12:45',
      status: 'active',
    },
    {
      repInitials: 'JM',
      day: 1,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      lunch: '12:00-12:45',
      status: 'scheduled',
    },
    {
      repInitials: 'JM',
      day: 2,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    {
      repInitials: 'JM',
      day: 3,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    {
      repInitials: 'JM',
      day: 4,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    // JD
    {
      repInitials: 'JD',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'active',
    },
    {
      repInitials: 'JD',
      day: 1,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    {
      repInitials: 'JD',
      day: 2,
      start: '09:00',
      end: '17:00',
      territory: 'Austin North',
      status: 'scheduled',
    },
    {
      repInitials: 'JD',
      day: 3,
      start: '09:00',
      end: '17:00',
      territory: 'Austin North',
      status: 'scheduled',
    },
    {
      repInitials: 'JD',
      day: 5,
      start: '10:00',
      end: '16:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    // AR
    {
      repInitials: 'AR',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Austin North',
      status: 'active',
    },
    {
      repInitials: 'AR',
      day: 1,
      start: '09:00',
      end: '17:00',
      territory: 'Austin North',
      status: 'scheduled',
    },
    {
      repInitials: 'AR',
      day: 3,
      start: '09:00',
      end: '17:00',
      territory: 'Austin North',
      status: 'scheduled',
    },
    {
      repInitials: 'AR',
      day: 4,
      start: '09:00',
      end: '17:00',
      territory: 'Austin North',
      status: 'scheduled',
    },
    // TM
    {
      repInitials: 'TM',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      lunch: '12:48-CURRENT',
      status: 'lunch',
    },
    {
      repInitials: 'TM',
      day: 1,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    {
      repInitials: 'TM',
      day: 2,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    {
      repInitials: 'TM',
      day: 4,
      start: '09:00',
      end: '17:00',
      territory: 'Austin East',
      status: 'scheduled',
    },
    // AM
    {
      repInitials: 'AM',
      day: 0,
      start: '09:30',
      end: '17:30',
      territory: 'Dallas Metro',
      status: 'active',
    },
    {
      repInitials: 'AM',
      day: 1,
      start: '09:30',
      end: '17:30',
      territory: 'Dallas Metro',
      status: 'scheduled',
    },
    {
      repInitials: 'AM',
      day: 2,
      start: '09:30',
      end: '17:30',
      territory: 'Dallas Metro',
      status: 'scheduled',
    },
    {
      repInitials: 'AM',
      day: 3,
      start: '09:30',
      end: '17:30',
      territory: 'Dallas Metro',
      status: 'scheduled',
    },
    // BC
    {
      repInitials: 'BC',
      day: 0,
      start: '08:00',
      end: '16:00',
      territory: 'Dallas North',
      status: 'active',
    },
    {
      repInitials: 'BC',
      day: 1,
      start: '08:00',
      end: '16:00',
      territory: 'Dallas North',
      status: 'scheduled',
    },
    {
      repInitials: 'BC',
      day: 2,
      start: '08:00',
      end: '16:00',
      territory: 'Dallas North',
      status: 'scheduled',
    },
    // HK
    {
      repInitials: 'HK',
      day: 0,
      start: '08:00',
      end: '16:00',
      territory: 'Dallas North',
      status: 'active',
    },
    {
      repInitials: 'HK',
      day: 2,
      start: '08:00',
      end: '16:00',
      territory: 'Dallas North',
      status: 'scheduled',
    },
    {
      repInitials: 'HK',
      day: 4,
      start: '08:00',
      end: '16:00',
      territory: 'Dallas North',
      status: 'scheduled',
    },
    // KP
    {
      repInitials: 'KP',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'active',
    },
    {
      repInitials: 'KP',
      day: 1,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    {
      repInitials: 'KP',
      day: 3,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    {
      repInitials: 'KP',
      day: 4,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    // DR
    {
      repInitials: 'DR',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'missed',
    },
    {
      repInitials: 'DR',
      day: 2,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    {
      repInitials: 'DR',
      day: 4,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    // ML
    {
      repInitials: 'ML',
      day: 0,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'active',
    },
    {
      repInitials: 'ML',
      day: 1,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    {
      repInitials: 'ML',
      day: 2,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    {
      repInitials: 'ML',
      day: 3,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
    {
      repInitials: 'ML',
      day: 4,
      start: '09:00',
      end: '17:00',
      territory: 'Houston SE',
      status: 'scheduled',
    },
  ];
  return raw.map((s, i) => {
    const rep = repByInitials(s.repInitials);
    return {
      ...s,
      id: `sh_${i}`,
      repName: rep.name,
      account: rep.account,
    };
  });
}

function hoursOf(shift: Shift): number {
  const [sh, sm] = shift.start.split(':').map(Number) as [number, number];
  const [eh, em] = shift.end.split(':').map(Number) as [number, number];
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

/** Monday of the current week, local time. weekOffset 0 = this week. */
function currentMonday(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  d.setDate(d.getDate() - dow);
  return d;
}

/** Index of today within the Mon–Sun grid (0 = Mon). */
function todayDayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function weekDates(offset: number): Date[] {
  const base = currentMonday();
  base.setDate(base.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

const TERRITORIES = ['Austin East', 'Austin North', 'Dallas Metro', 'Dallas North', 'Houston SE'];

// ─────────────────────────────────────────────────────────────────────────────
// Coverage heat bar — target share of the fleet that should be staffed on a
// given day before we stop flagging it amber/red. A glance signal, not a gate.
// ─────────────────────────────────────────────────────────────────────────────
const COVERAGE_TARGET = 0.6; // ≥60% of reps assigned that day = "green"

// ─────────────────────────────────────────────────────────────────────────────
// Roster templates — saved in localStorage keyed by org. This HQ page has no
// orgSlug in scope, so we key by a stable 'hq' constant. (Noted in the build
// summary: per-org slugging can be wired once the page receives org context.)
// ─────────────────────────────────────────────────────────────────────────────
const ROSTER_TEMPLATE_ORG_KEY = 'hq';

/** A template shift is a single-create payload minus weekStart (and ids). */
type TemplateShift = Omit<Shift, 'id'>;

/** The per-shift payload for POST /api/shifts/bulk (lunch may be explicit null). */
interface BulkShiftPayload {
  repInitials: string;
  repName: string;
  account: string;
  day: number;
  start: string;
  end: string;
  territory: string;
  lunch: string | null;
  status: ShiftStatus;
}
interface RosterTemplate {
  name: string;
  shifts: TemplateShift[];
}

function templateStorageKey(orgKey: string): string {
  return `d2d.roster-template.${orgKey}`;
}

/** ISO date string (YYYY-MM-DD) for the Monday at the given weekOffset. */
function weekStartISO(offset: number): string {
  const base = currentMonday();
  base.setDate(base.getDate() + offset * 7);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RosterPage(): JSX.Element {
  // Seeded from buildSeed() but overridden on mount from /api/shifts.
  const [shifts, setShifts] = useState<Shift[]>(() => buildSeed());
  // Roster directory of knockers. Seeded from REPS, overridden on mount from
  // /api/users?role=knocker. `repsLive` tells the UI which mode it's in.
  const [reps, setReps] = useState<Rep[]>(REPS);
  const [, setRepsLive] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [dayIndex, setDayIndex] = useState(0);

  // Edit panel
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  // Rep summary panel
  const [summaryRep, setSummaryRep] = useState<string | null>(null);
  // Add-shift modal
  const [addOpen, setAddOpen] = useState(false);
  // Quick-add inline (per cell key `repInitials:day`)
  const [quickAddKey, setQuickAddKey] = useState<string | null>(null);
  // Live timecard clock-out tracking
  const [clockedOut, setClockedOut] = useState<Record<string, string>>({});

  // Multi-select for bulk actions (set of shift ids).
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  // Pending bulk picker ('day' | 'territory' | null) shown inline in the bar.
  const [bulkPicker, setBulkPicker] = useState<'day' | 'territory' | null>(null);
  // Add-shift modal day prefill (from a coverage-bar click).
  const [addPrefillDay, setAddPrefillDay] = useState<number | null>(null);
  // Saved roster templates (hydrated post-mount from localStorage).
  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  // Copy-last-week in-flight guard so the button can't double-fire.
  const [copyingWeek, setCopyingWeek] = useState(false);

  // Honest-data freshness for the week-schedule section. markFresh() on a
  // successful /api/shifts fetch; otherwise it stays 'fixture' (demo data).
  const {
    source: shiftSource,
    updatedAt: shiftUpdatedAt,
    markFresh,
    markFixture,
  } = useDataFreshness('fixture');

  const dragId = useRef<string | null>(null);
  const justDraggedRef = useRef(false);
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  const dates = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => {
    const start = dates[0]!;
    return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [dates]);
  const dayLabels = useMemo(() => dates.map((d, i) => `${DAY_LABELS[i]} ${d.getDate()}`), [dates]);

  // Live KPIs — "today" = the real weekday within the current week.
  const todayIdx = todayDayIndex();
  const todayShifts = shifts.filter((s) => s.day === todayIdx && weekOffset === 0);
  const scheduledToday = todayShifts.length;
  const hoursToday = todayShifts.reduce((a, s) => a + hoursOf(s), 0);
  const onLunchNow = todayShifts.filter((s) => s.status === 'lunch').length;
  const missedToday = todayShifts.filter((s) => s.status === 'missed').length;
  const activeNow = todayShifts.filter((s) => s.status === 'active' && !clockedOut[s.id]).length;

  // ESC handler
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setEditShiftId(null);
        setSummaryRep(null);
        setAddOpen(false);
        setQuickAddKey(null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Fetch the knocker directory once on mount. The endpoint returns PII-safe
  // { id, role, initials } rows (no plaintext names). We synthesize display
  // names from initials since names live behind the PII vault. If the endpoint
  // returns empty (no knockers seeded yet) we keep the seed REPS so the demo
  // stays populated.
  useEffect(() => {
    let cancelled = false;

    async function fetchUsers(): Promise<void> {
      try {
        const res = await fetch('/api/users?role=knocker');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { users?: RosterUser[] };
        if (Array.isArray(data.users) && data.users.length > 0) {
          const mapped: Rep[] = data.users.map((u) => ({
            initials: u.initials,
            name: `Knocker ${u.id.slice(-4)}`,
            account: '—',
          }));
          setReps(mapped);
          setRepsLive(true);
        }
        // Empty → no knockers in DB yet; keep seed REPS for the demo.
      } catch {
        // Network failure — keep seed REPS.
      }
    }

    void fetchUsers();
    return (): void => {
      cancelled = true;
    };
  }, []);

  // Fetch shifts from /api/shifts whenever the week changes. Falls back to
  // seed data if the API returns an empty array (no shifts in DB yet).
  useEffect(() => {
    let cancelled = false;

    async function fetchShifts(): Promise<void> {
      try {
        const ws = weekStartISO(weekOffset);
        const res = await fetch(`/api/shifts?weekStart=${ws}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { shifts?: Shift[] };
        if (Array.isArray(data.shifts) && data.shifts.length > 0) {
          // Real saved shifts → live DB read.
          markFresh();
          setShifts(data.shifts);
        } else {
          // Empty array → no shifts saved for this week yet; keep the seed
          // fixtures and keep the badge honest (fixture, not LIVE).
          markFixture();
        }
      } catch {
        // Network failure — keep current state (badge stays fixture/stale).
      }
    }

    void fetchShifts();
    return (): void => {
      cancelled = true;
    };
    // markFresh/markFixture are stable callbacks from useDataFreshness; intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // Clear any multi-select when the week changes — otherwise the bulk action
  // bar persists with stale shift ids from the previous week.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // Hydrate saved roster templates from localStorage after mount (avoids
  // SSR/hydration mismatch — mirrors the onboard-account day-one pattern).
  useEffect(() => {
    try {
      const rawTpl = window.localStorage.getItem(templateStorageKey(ROSTER_TEMPLATE_ORG_KEY));
      if (rawTpl) {
        const parsed = JSON.parse(rawTpl) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (t): t is RosterTemplate =>
              !!t &&
              typeof t === 'object' &&
              typeof (t as RosterTemplate).name === 'string' &&
              Array.isArray((t as RosterTemplate).shifts),
          );
          setTemplates(valid);
        }
      }
    } catch {
      // localStorage unavailable (private mode etc.) — templates just won't persist.
    }
  }, []);

  function moveShift(id: string, targetRepInitials: string, targetDay: number): void {
    const prev = shifts.find((s) => s.id === id);
    if (!prev || (prev.repInitials === targetRepInitials && prev.day === targetDay)) return;
    const rep = repByInitialsIn(targetRepInitials, reps);
    const before = {
      repInitials: prev.repInitials,
      repName: prev.repName,
      account: prev.account,
      day: prev.day,
    };

    // Warn-don't-block: surface conflict + hours-over-limit for the landing cell.
    const candidate: Shift = {
      ...prev,
      repInitials: rep.initials,
      repName: rep.name,
      account: rep.account,
      day: targetDay,
    };
    warnOnConflict(candidate);
    warnOnHours(candidate);

    // Optimistic update
    setShifts((p) =>
      p.map((s) =>
        s.id === id
          ? {
              ...s,
              repInitials: rep.initials,
              repName: rep.name,
              account: rep.account,
              day: targetDay,
            }
          : s,
      ),
    );

    const rollback = (): void => {
      setShifts((p) => p.map((s) => (s.id === id ? { ...s, ...before } : s)));
    };

    void fetch(`/api/shifts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        repInitials: rep.initials,
        repName: rep.name,
        account: rep.account,
        day: targetDay,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        toast.success(`Moved ${rep.name} → ${DAY_LABELS[targetDay]}. Tap to undo`, {
          onClick: () => {
            rollback();
            void fetch(`/api/shifts/${id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(before),
            }).catch(() => toast.error('Undo failed to save'));
          },
        });
      })
      .catch(() => {
        rollback();
        toast.error('Failed to move shift — change reverted');
      });
  }

  function updateShift(id: string, patch: Partial<Shift>): void {
    const prev = shifts.find((s) => s.id === id);
    // Optimistic update
    setShifts((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    void fetch(`/api/shifts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      })
      .catch(() => {
        if (prev) setShifts((p) => p.map((s) => (s.id === id ? prev : s)));
        toast.error('Failed to save shift — change reverted');
      });
  }

  /** Warn (toast.error) if the candidate shift conflicts. Never blocks. */
  function warnOnConflict(candidate: Shift): void {
    const result = detectConflict(candidate, shifts);
    if (result.hasConflict) {
      toast.error(`Conflict: ${result.reasons[0]}`);
    }
  }

  /** Warn (toast.info) if the candidate pushes the rep over the daily or weekly
   * hour limit. Never blocks. */
  function warnOnHours(candidate: Shift): void {
    const repShifts = shifts.filter(
      (s) => s.repInitials === candidate.repInitials && s.id !== candidate.id,
    );
    const weekTotal = repShifts.reduce((a, s) => a + hoursOf(s), 0) + hoursOf(candidate);
    const dayTotal =
      repShifts.filter((s) => s.day === candidate.day).reduce((a, s) => a + hoursOf(s), 0) +
      hoursOf(candidate);

    if (dayTotal > MAX_HOURS_PER_DAY) {
      toast.info(
        `${candidate.repName} now ${dayTotal.toFixed(1)}h on ${DAY_LABELS[candidate.day]} — over ${MAX_HOURS_PER_DAY}h/day`,
      );
    } else if (weekTotal > MAX_HOURS_PER_WEEK) {
      toast.info(
        `${candidate.repName} now ${weekTotal.toFixed(1)}h this week — over ${MAX_HOURS_PER_WEEK}h/week`,
      );
    }
  }

  function addShift(s: Omit<Shift, 'id' | 'repName' | 'account'>): void {
    const rep = repByInitialsIn(s.repInitials, reps);
    const optimisticId = `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Warn-don't-block: check the new shift against the existing roster.
    const candidate: Shift = { ...s, id: optimisticId, repName: rep.name, account: rep.account };
    warnOnConflict(candidate);
    warnOnHours(candidate);
    // Optimistic update
    setShifts((prev) => [
      ...prev,
      {
        ...s,
        id: optimisticId,
        repName: rep.name,
        account: rep.account,
      },
    ]);
    // Persist to API; replace optimistic ID with the real one when it lands.
    // On failure, remove the ghost row — a shift with a temp ID can never be
    // edited or deleted (every PATCH/DELETE on it would 404).
    void fetch('/api/shifts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        weekStart: weekStartISO(weekOffset),
        repInitials: s.repInitials,
        repName: rep.name,
        account: rep.account,
        day: s.day,
        start: s.start,
        end: s.end,
        territory: s.territory,
        lunch: s.lunch ?? null,
        status: s.status,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { shift?: { id: string } };
        if (data.shift?.id) {
          setShifts((prev) =>
            prev.map((sh) => (sh.id === optimisticId ? { ...sh, id: data.shift!.id } : sh)),
          );
        }
        toast.success(`Shift added — ${rep.name} · ${DAY_LABELS[s.day]} ${s.start}–${s.end}`);
      })
      .catch(() => {
        setShifts((prev) => prev.filter((sh) => sh.id !== optimisticId));
        toast.error('Failed to save shift — removed from grid. Try again.');
      });
  }

  function deleteShift(id: string): void {
    const removed = shifts.find((s) => s.id === id);
    // Optimistic removal
    setShifts((prev) => prev.filter((s) => s.id !== id));
    void fetch(`/api/shifts/${id}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      })
      .catch(() => {
        if (removed) setShifts((prev) => [...prev, removed]);
        toast.error('Failed to delete shift — restored');
      });
  }

  function clockOut(id: string): void {
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const prev = shifts.find((s) => s.id === id);
    setClockedOut((p) => ({ ...p, [id]: stamp }));
    // Optimistic status update
    setShifts((p) => p.map((s) => (s.id === id ? { ...s, status: 'completed' } : s)));
    // Persist completed status + actual end time to API
    void fetch(`/api/shifts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed', end: stamp }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        toast.success(`Clocked out at ${stamp}`);
      })
      .catch(() => {
        if (prev) setShifts((p) => p.map((s) => (s.id === id ? prev : s)));
        setClockedOut((p) => {
          const { [id]: _drop, ...rest } = p;
          return rest;
        });
        toast.error('Clock-out failed to save — reverted');
      });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Multi-select + bulk actions
  // ───────────────────────────────────────────────────────────────────────────

  function toggleSelected(id: string): void {
    setSelectedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection(): void {
    setSelectedShiftIds(new Set());
    setBulkPicker(null);
  }

  /** After a bulk mutation, surface any resulting conflicts / hours-overruns as
   * a single warn toast (warn-don't-block). `nextShifts` is the post-mutation
   * roster so warnings reflect the new state. */
  function warnBulkResult(nextShifts: Shift[], touchedIds: Set<string>): void {
    const conflicted = nextShifts.filter(
      (s) => touchedIds.has(s.id) && detectConflict(s, nextShifts).hasConflict,
    );
    if (conflicted.length > 0) {
      const first = detectConflict(conflicted[0]!, nextShifts).reasons[0];
      toast.error(
        `${conflicted.length} conflict${conflicted.length > 1 ? 's' : ''} after bulk change — ${first}`,
      );
    }
    // Hours overruns across the touched reps.
    const repsTouched = new Set(
      nextShifts.filter((s) => touchedIds.has(s.id)).map((s) => s.repInitials),
    );
    for (const ri of repsTouched) {
      const repShifts = nextShifts.filter((s) => s.repInitials === ri);
      const weekTotal = repShifts.reduce((a, s) => a + hoursOf(s), 0);
      if (weekTotal > MAX_HOURS_PER_WEEK) {
        toast.info(
          `${repShifts[0]?.repName ?? ri} now ${weekTotal.toFixed(1)}h this week — over ${MAX_HOURS_PER_WEEK}h/week`,
        );
        break; // one nudge is enough — don't spam.
      }
    }
  }

  function bulkDelete(): void {
    const ids = [...selectedShiftIds];
    if (ids.length === 0) return;
    const removed = shifts.filter((s) => ids.includes(s.id));
    // Optimistic removal.
    setShifts((prev) => prev.filter((s) => !selectedShiftIds.has(s.id)));
    clearSelection();

    let failed = 0;
    void Promise.all(
      ids.map((id) =>
        fetch(`/api/shifts/${id}`, { method: 'DELETE' })
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
          })
          .catch(() => {
            failed += 1;
          }),
      ),
    ).then(() => {
      if (failed > 0) {
        // Restore the ones that failed to delete.
        setShifts((prev) => {
          const have = new Set(prev.map((s) => s.id));
          const restore = removed.filter((s) => !have.has(s.id));
          return [...prev, ...restore];
        });
        toast.error(`Deleted ${ids.length - failed} · ${failed} failed and were restored`);
      } else {
        toast.success(`Deleted ${ids.length} shift${ids.length > 1 ? 's' : ''}`);
      }
    });
  }

  function bulkPatch(patch: Partial<Shift>, label: string): void {
    const ids = [...selectedShiftIds];
    if (ids.length === 0) return;
    const before = new Map(shifts.filter((s) => ids.includes(s.id)).map((s) => [s.id, s] as const));
    // Optimistic update.
    const nextShifts = shifts.map((s) => (selectedShiftIds.has(s.id) ? { ...s, ...patch } : s));
    setShifts(nextShifts);
    warnBulkResult(nextShifts, new Set(ids));
    const touched = new Set(ids);
    clearSelection();

    let failed = 0;
    void Promise.all(
      ids.map((id) =>
        fetch(`/api/shifts/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
          })
          .catch(() => {
            failed += 1;
          }),
      ),
    ).then(() => {
      if (failed > 0) {
        // Roll back only the failed rows.
        setShifts((prev) => prev.map((s) => (touched.has(s.id) ? (before.get(s.id) ?? s) : s)));
        toast.error(`${label}: ${ids.length - failed} saved · ${failed} failed and reverted`);
      } else {
        toast.success(`${label} — ${ids.length} shift${ids.length > 1 ? 's' : ''}`);
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Copy last week — pull the prior week's shifts, strip ids, bulk-create them
  // for the current week. Append (never overwrite); warn if it adds conflicts.
  // ───────────────────────────────────────────────────────────────────────────

  function copyLastWeek(): void {
    if (copyingWeek) return;
    setCopyingWeek(true);
    const prevWS = weekStartISO(weekOffset - 1);
    const curWS = weekStartISO(weekOffset);

    void (async (): Promise<void> => {
      try {
        const res = await fetch(`/api/shifts?weekStart=${prevWS}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { shifts?: Shift[] };
        const prevShifts = Array.isArray(data.shifts) ? data.shifts : [];
        if (prevShifts.length === 0) {
          toast.info('Last week has no saved shifts to copy');
          return;
        }
        // Fetch the current week so we can skip rows that already exist —
        // copy-last-week appends, and re-running it must not create duplicates.
        const curRes = await fetch(`/api/shifts?weekStart=${curWS}`);
        const curData = curRes.ok ? ((await curRes.json()) as { shifts?: Shift[] }) : {};
        const curShifts = Array.isArray(curData.shifts) ? curData.shifts : [];
        const dupKey = (s: {
          repInitials: string;
          day: number;
          start: string;
          end: string;
        }): string => `${s.repInitials}|${s.day}|${s.start}|${s.end}`;
        const existing = new Set(curShifts.map(dupKey));
        const toCopy = prevShifts.filter((s) => !existing.has(dupKey(s)));
        if (toCopy.length === 0) {
          toast.info('Last week is already copied into this week');
          return;
        }
        // Strip ids → single-create payloads.
        const payload = toCopy.map((s) => ({
          repInitials: s.repInitials,
          repName: s.repName,
          account: s.account,
          day: s.day,
          start: s.start,
          end: s.end,
          territory: s.territory,
          lunch: s.lunch ?? null,
          status: 'scheduled' as ShiftStatus,
        }));
        const created = await postBulk(curWS, payload);
        if (created === null) {
          toast.error('Copy last week failed to save');
          return;
        }
        await refetchCurrentWeek();
        toast.success(
          `Copied ${created.length} shift${created.length > 1 ? 's' : ''} from last week`,
        );
      } catch {
        toast.error('Copy last week failed — network error');
      } finally {
        setCopyingWeek(false);
      }
    })();
  }

  /** POST a batch to /api/shifts/bulk. Returns created rows or null on failure. */
  async function postBulk(weekStart: string, payload: BulkShiftPayload[]): Promise<Shift[] | null> {
    try {
      const res = await fetch('/api/shifts/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ weekStart, shifts: payload }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { shifts?: Shift[] };
      return Array.isArray(data.shifts) ? data.shifts : [];
    } catch {
      return null;
    }
  }

  /** Re-fetch the current week and replace state + flag any new conflicts. */
  async function refetchCurrentWeek(): Promise<void> {
    try {
      const ws = weekStartISO(weekOffset);
      const res = await fetch(`/api/shifts?weekStart=${ws}`);
      if (!res.ok) return;
      const data = (await res.json()) as { shifts?: Shift[] };
      if (Array.isArray(data.shifts) && data.shifts.length > 0) {
        markFresh();
        setShifts(data.shifts);
        const conflicts = conflictedShiftIds(data.shifts);
        if (conflicts.size > 0) {
          toast.info(`Heads up — ${conflicts.size} shift(s) now in conflict`);
        }
      } else {
        // Empty week → keep the seed fixtures; don't claim a LIVE read.
        markFixture();
      }
    } catch {
      // keep current state
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Templates — save the current week's shifts (stripped of id + week) to
  // localStorage; apply a saved template by bulk-creating it for this week.
  // ───────────────────────────────────────────────────────────────────────────

  function persistTemplates(next: RosterTemplate[]): void {
    setTemplates(next);
    try {
      window.localStorage.setItem(
        templateStorageKey(ROSTER_TEMPLATE_ORG_KEY),
        JSON.stringify(next),
      );
    } catch {
      // Non-fatal — template just won't survive a reload.
    }
  }

  function saveAsTemplate(): void {
    if (shifts.length === 0) {
      toast.info('No shifts to save as a template');
      return;
    }
    const name = window.prompt('Template name', `Week template ${templates.length + 1}`);
    if (!name || !name.trim()) return;
    const tplShifts: TemplateShift[] = shifts.map((s) => {
      const { id: _id, ...rest } = s;
      return rest;
    });
    const next = [
      ...templates.filter((t) => t.name !== name.trim()),
      { name: name.trim(), shifts: tplShifts },
    ];
    persistTemplates(next);
    toast.success(`Saved template "${name.trim()}" · ${tplShifts.length} shifts`);
  }

  function applyTemplate(name: string): void {
    const tpl = templates.find((t) => t.name === name);
    if (!tpl || tpl.shifts.length === 0) {
      toast.error('Template not found or empty');
      return;
    }
    const curWS = weekStartISO(weekOffset);
    const payload = tpl.shifts.map((s) => ({
      repInitials: s.repInitials,
      repName: s.repName,
      account: s.account,
      day: s.day,
      start: s.start,
      end: s.end,
      territory: s.territory,
      lunch: s.lunch ?? null,
      status: 'scheduled' as ShiftStatus,
    }));
    void (async (): Promise<void> => {
      const created = await postBulk(curWS, payload);
      if (created === null) {
        toast.error(`Failed to apply template "${name}"`);
        return;
      }
      await refetchCurrentWeek();
      toast.success(`Applied "${name}" — ${created.length} shifts`);
    })();
  }

  function deleteTemplate(name: string): void {
    persistTemplates(templates.filter((t) => t.name !== name));
    toast.info(`Removed template "${name}"`);
  }

  // Drag handlers
  function onDragStart(id: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      dragId.current = id;
      justDraggedRef.current = true;
    };
  }
  function onDragEnd(): void {
    dragId.current = null;
    setHoverCell(null);
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 50);
  }
  function onDragOverCell(cellKey: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setHoverCell(cellKey);
    };
  }
  function onDropCell(repInitials: string, day: number) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.dataTransfer.getData('text/plain') || dragId.current;
      if (id) moveShift(id, repInitials, day);
      dragId.current = null;
      setHoverCell(null);
    };
  }

  const editingShift = shifts.find((s) => s.id === editShiftId) ?? null;
  const summaryShifts = summaryRep ? shifts.filter((s) => s.repInitials === summaryRep) : [];

  // Conflict set + weekly-hours map, recomputed when shifts change.
  // Coverage per day = count of distinct reps with ≥1 shift that day.
  // Used by the heat bar to show fleet-coverage at a glance.
  const coverageByDay = useMemo(() => {
    const counts: number[] = Array.from({ length: 7 }, () => 0);
    for (let d = 0; d < 7; d += 1) {
      const repsOnDay = new Set(shifts.filter((s) => s.day === d).map((s) => s.repInitials));
      counts[d] = repsOnDay.size;
    }
    return counts;
  }, [shifts]);

  const selectedCount = selectedShiftIds.size;

  return (
    <PlatformShell pageTitle="Roster & shifts">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Full rostering for every Knocker iOS user. Hours auto-logged from app clock-in. Drag
            shifts between cells to reassign. Click any shift to edit. Pushes changes instantly to
            the knocker&apos;s iPad.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Scheduled today"
            value={scheduledToday}
            hint={`of ${reps.length} total`}
          />
          <KpiCard
            label="Hours today"
            value={`${hoursToday.toFixed(1)}h`}
            hint={`${Math.round(hoursToday * 8)} expected knocks`}
          />
          <KpiCard
            label="On lunch now"
            value={onLunchNow}
            hint={onLunchNow > 0 ? 'live' : 'none'}
          />
          <KpiCard
            label="Missed shifts"
            value={missedToday}
            hint={missedToday > 0 ? 'auto-SMS sent' : 'all on time'}
          />
          <KpiCard label="Active now" value={activeNow} hint="clocked in" />
        </div>

        {/* Week selector + view switcher */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="w-8 h-8 rounded-lg border border-line2 hover:bg-paper flex items-center justify-center"
              title="Previous week"
            >
              <ChevronLeft size={14} className="text-soft" />
            </button>
            <div className="text-[15px] font-semibold text-ink">{weekLabel}</div>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="w-8 h-8 rounded-lg border border-line2 hover:bg-paper flex items-center justify-center"
              title="Next week"
            >
              <ChevronRight size={14} className="text-soft" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`ml-2 text-[12px] font-medium ${weekOffset === 0 ? 'text-soft' : 'text-accent hover:underline'}`}
              disabled={weekOffset === 0}
            >
              This week
            </button>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex items-center bg-paper rounded-lg p-0.5 border border-line2">
              {[
                { v: 'day' as const, icon: CalendarDays, label: 'Day' },
                { v: 'week' as const, icon: LayoutGrid, label: 'Week' },
                { v: 'month' as const, icon: CalendarRange, label: 'Month' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setView(opt.v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition ${view === opt.v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                >
                  <opt.icon size={13} />
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={copyLastWeek}
              disabled={copyingWeek}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-line2 text-muted hover:text-ink hover:bg-paper transition disabled:opacity-50"
              title="Copy last week's shifts into this week (append)"
            >
              <CopyPlus size={13} />
              {copyingWeek ? 'Copying…' : 'Copy last week'}
            </button>
            <button
              onClick={saveAsTemplate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-line2 text-muted hover:text-ink hover:bg-paper transition"
              title="Save this week's shifts as a reusable template"
            >
              <Save size={13} />
              Save as template
            </button>
            <TemplateMenu templates={templates} onApply={applyTemplate} onDelete={deleteTemplate} />
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={() => {
                setAddPrefillDay(null);
                setAddOpen(true);
              }}
            >
              Add shift
            </Button>
          </div>
        </div>

        {/* Bulk action bar — only when shifts are selected */}
        {selectedCount > 0 && (
          <BulkActionBar
            count={selectedCount}
            picker={bulkPicker}
            setPicker={setBulkPicker}
            onMoveDay={(d) => bulkPatch({ day: d }, `Moved to ${DAY_LABELS[d]}`)}
            onSetTerritory={(t) => bulkPatch({ territory: t }, `Territory → ${t}`)}
            onDelete={bulkDelete}
            onClear={clearSelection}
          />
        )}

        {view === 'week' && (
          <Section
            title="Week schedule"
            subtitle="All accounts · all Knockers · drag to reassign · check cards to bulk-edit"
            paddedBody={false}
            action={<DataSourceBadge source={shiftSource} updatedAt={shiftUpdatedAt} />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr>
                    <th
                      className="text-left px-4 py-3 border-b border-line2 text-[11px] uppercase tracking-wider text-muted font-medium"
                      style={{ minWidth: 180 }}
                    >
                      Knocker
                    </th>
                    {dayLabels.map((d, i) => (
                      <th
                        key={d}
                        className={`text-left px-3 py-3 border-b border-line2 text-[11px] uppercase tracking-wider font-medium ${i === todayIdx && weekOffset === 0 ? 'text-accent bg-accentSoft/30' : 'text-muted'}`}
                        style={{ minWidth: 130 }}
                      >
                        {d}{' '}
                        {i === todayIdx && weekOffset === 0 && (
                          <span className="text-[9px] text-accent">· TODAY</span>
                        )}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 border-b border-line2 text-[11px] uppercase tracking-wider text-muted font-medium">
                      Total
                    </th>
                  </tr>
                  {/* Coverage heat bar — % of the fleet staffed each day. */}
                  <tr>
                    <th className="text-left px-4 pb-2 pt-0 text-[9px] uppercase tracking-wider text-soft font-medium align-bottom">
                      Coverage
                    </th>
                    {coverageByDay.map((cnt, di) => {
                      const ratio = reps.length > 0 ? cnt / reps.length : 0;
                      const pct = Math.round(ratio * 100);
                      const tone =
                        cnt === 0
                          ? 'bg-rose-400'
                          : ratio >= COVERAGE_TARGET
                            ? 'bg-emerald-500'
                            : 'bg-amber-400';
                      const low = ratio < COVERAGE_TARGET;
                      return (
                        <th key={di} className="px-3 pb-2 pt-0 align-bottom">
                          <button
                            type="button"
                            onClick={() => {
                              if (low) {
                                setAddPrefillDay(di);
                                setAddOpen(true);
                              }
                            }}
                            title={`${cnt}/${reps.length} reps · ${pct}% coverage${low ? ' · click to add a shift' : ''}`}
                            className={`block w-full ${low ? 'cursor-pointer' : 'cursor-default'}`}
                            aria-label={`${DAY_LABELS[di]} coverage ${pct}%`}
                          >
                            <div className="h-1 w-full rounded-full bg-line2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${tone}`}
                                style={{ width: `${Math.max(pct, cnt === 0 ? 0 : 6)}%` }}
                              />
                            </div>
                            <div className="text-[8.5px] text-soft mt-0.5 numeric">{pct}%</div>
                          </button>
                        </th>
                      );
                    })}
                    <th className="px-4 pb-2 pt-0" />
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => {
                    const repShifts = shifts.filter((s) => s.repInitials === r.initials);
                    const totalHrs = repShifts.reduce((a, s) => a + hoursOf(s), 0);
                    return (
                      <tr key={r.initials} className="hover:bg-paper/40">
                        <td className="px-4 py-3 border-b border-line2">
                          <button
                            onClick={() => setSummaryRep(r.initials)}
                            className="flex items-center gap-2 text-left hover:opacity-80"
                          >
                            <span className="mono">{r.initials}</span>
                            <div>
                              <div className="text-[13px] font-medium text-ink hover:text-accent">
                                {r.name}
                              </div>
                              <div className="text-[10px] text-muted">{r.account}</div>
                            </div>
                          </button>
                        </td>
                        {dayLabels.map((_, di) => {
                          const cellKey = `${r.initials}:${di}`;
                          const cellShifts = repShifts.filter((s) => s.day === di);
                          const isHover = hoverCell === cellKey;
                          const isToday = di === todayIdx && weekOffset === 0;
                          return (
                            <td
                              key={di}
                              className="px-3 py-3 border-b border-line2 align-top"
                              onDragOver={onDragOverCell(cellKey)}
                              onDragLeave={(e) => {
                                const rt = e.relatedTarget as Node | null;
                                if (!rt || !(e.currentTarget as Node).contains(rt))
                                  setHoverCell((h) => (h === cellKey ? null : h));
                              }}
                              onDrop={onDropCell(r.initials, di)}
                            >
                              {cellShifts.length === 0 ? (
                                quickAddKey === cellKey ? (
                                  <QuickAddInline
                                    onCancel={() => setQuickAddKey(null)}
                                    onSubmit={(s) => {
                                      addShift({
                                        repInitials: r.initials,
                                        day: di,
                                        start: s.start,
                                        end: s.end,
                                        territory: s.territory,
                                        status: 'scheduled',
                                      });
                                      setQuickAddKey(null);
                                    }}
                                  />
                                ) : (
                                  <button
                                    onClick={() => setQuickAddKey(cellKey)}
                                    className={`w-full h-12 border border-dashed rounded-md flex items-center justify-center text-[10px] transition ${
                                      isHover
                                        ? 'ring-2 ring-accent bg-accentSoft/40 border-accent text-accent font-semibold'
                                        : 'bg-paper/40 border-line2 text-soft hover:text-accent hover:border-accent/40'
                                    }`}
                                  >
                                    {isHover ? '↓ Drop here ↓' : '+ Off'}
                                  </button>
                                )
                              ) : (
                                <div
                                  className={`space-y-1.5 rounded-md transition ${isHover ? 'ring-2 ring-accent bg-accentSoft/40 p-1' : ''}`}
                                >
                                  {cellShifts.map((sh) => {
                                    const isDragging = dragId.current === sh.id;
                                    const onLunch = sh.status === 'lunch';
                                    const missed = sh.status === 'missed';
                                    const completed =
                                      sh.status === 'completed' || !!clockedOut[sh.id];
                                    const isSelected = selectedShiftIds.has(sh.id);
                                    return (
                                      <div
                                        key={sh.id}
                                        draggable
                                        onDragStart={onDragStart(sh.id)}
                                        onDragEnd={onDragEnd}
                                        onClick={(e) => {
                                          if (justDraggedRef.current) return;
                                          // Shift-click (or with a selection active) toggles
                                          // membership instead of opening the edit panel.
                                          if (e.shiftKey || selectedShiftIds.size > 0) {
                                            toggleSelected(sh.id);
                                            return;
                                          }
                                          setEditShiftId(sh.id);
                                        }}
                                        className={`relative p-2 rounded-md border cursor-grab active:cursor-grabbing hover:shadow-sm transition ${
                                          isSelected
                                            ? 'ring-2 ring-accent border-accent bg-accentSoft/50'
                                            : missed
                                              ? 'bg-rose-50 border-rose-300'
                                              : onLunch
                                                ? 'bg-amber-50 border-amber-300'
                                                : completed
                                                  ? 'bg-emerald-50 border-emerald-300'
                                                  : isToday
                                                    ? 'bg-accentSoft border-accent/30'
                                                    : 'bg-paper border-line2'
                                        } ${isDragging ? 'opacity-30 scale-95 rotate-1' : ''}`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={() => toggleSelected(sh.id)}
                                              aria-label="Select shift for bulk action"
                                              className="w-3 h-3 accent-accent cursor-pointer"
                                            />
                                            <div className="text-[11px] font-semibold text-ink numeric">
                                              {sh.start}–{sh.end}
                                            </div>
                                          </div>
                                          {missed && (
                                            <AlertCircle size={11} className="text-rose-500" />
                                          )}
                                          {onLunch && (
                                            <Coffee size={11} className="text-amber-600" />
                                          )}
                                          {completed && (
                                            <CheckCircle2 size={11} className="text-emerald-600" />
                                          )}
                                        </div>
                                        <div className="text-[10px] text-muted truncate mt-0.5">
                                          {sh.territory}
                                        </div>
                                        {sh.lunch && (
                                          <div
                                            className={`text-[9px] mt-1 font-medium inline-flex items-center gap-1 ${onLunch ? 'text-amber-700' : 'text-soft'}`}
                                          >
                                            <Coffee size={9} aria-hidden /> {sh.lunch}
                                          </div>
                                        )}
                                        {missed && (
                                          <div className="text-[9px] mt-1 font-medium text-rose-700">
                                            No clock-in · SMS sent
                                          </div>
                                        )}
                                        {clockedOut[sh.id] && (
                                          <div className="text-[9px] mt-1 font-medium text-emerald-700">
                                            Clocked out · {clockedOut[sh.id]}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 border-b border-line2 text-right">
                          <div className="text-[13px] font-semibold text-ink numeric">
                            {totalHrs.toFixed(1)}h
                          </div>
                          <div className="text-[10px] text-soft">{repShifts.length} shifts</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {view === 'day' && (
          <DayView
            dayIndex={dayIndex}
            setDayIndex={setDayIndex}
            dayLabels={dayLabels}
            shifts={shifts}
            reps={reps}
            onClickShift={(id) => setEditShiftId(id)}
            clockedOut={clockedOut}
          />
        )}

        {view === 'month' && <MonthView shifts={shifts} weekOffset={weekOffset} />}

        {/* Today live time tracking */}
        <Section
          title="Today · live time tracking"
          subtitle="Clock-in / out + lunch breaks · auto-captured from Knocker iOS"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {todayShifts.slice(0, 6).map((t) => {
              const tone: 'success' | 'warn' | 'danger' =
                t.status === 'missed' ? 'danger' : t.status === 'lunch' ? 'warn' : 'success';
              const out = clockedOut[t.id];
              return (
                <div key={t.id} className="card card-pad">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="mono">{t.repInitials}</span>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-ink">{t.repName}</div>
                      <StatusPill tone={tone}>
                        {out
                          ? `Clocked out · ${out}`
                          : t.status === 'lunch'
                            ? 'On lunch'
                            : t.status === 'missed'
                              ? 'No clock-in'
                              : t.status === 'completed'
                                ? 'Completed'
                                : `Active · ${t.start}`}
                      </StatusPill>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-muted flex items-center gap-1">
                        <Clock size={11} /> Clock-in
                      </span>
                      <span className="text-ink numeric font-medium">
                        {t.status === 'missed' ? 'Missed' : t.start}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted flex items-center gap-1">
                        <Coffee size={11} /> Lunch
                      </span>
                      <span className="text-ink numeric font-medium">{t.lunch ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Territory</span>
                      <span className="text-ink font-medium">{t.territory}</span>
                    </div>
                  </div>
                  {!out && t.status !== 'missed' && (
                    <button
                      onClick={() => clockOut(t.id)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-surface text-[11px] font-medium hover:bg-ink/90"
                    >
                      <LogOut size={12} /> Clock out
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Edit shift side panel */}
      {editingShift && (
        <EditShiftPanel
          shift={editingShift}
          onClose={() => setEditShiftId(null)}
          onSave={(patch) => {
            updateShift(editingShift.id, patch);
            setEditShiftId(null);
          }}
          onDelete={() => {
            deleteShift(editingShift.id);
            setEditShiftId(null);
          }}
        />
      )}

      {/* Rep weekly summary panel */}
      {summaryRep && (
        <RepSummaryPanel
          rep={repByInitialsIn(summaryRep, reps)}
          shifts={summaryShifts}
          onClose={() => setSummaryRep(null)}
        />
      )}

      {/* Add shift modal */}
      {addOpen && (
        <AddShiftModal
          reps={reps}
          prefillDay={addPrefillDay}
          onClose={() => {
            setAddOpen(false);
            setAddPrefillDay(null);
          }}
          onAdd={(s) => {
            addShift(s);
            setAddOpen(false);
            setAddPrefillDay(null);
          }}
        />
      )}
    </PlatformShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick add inline
// ─────────────────────────────────────────────────────────────────────────────

function QuickAddInline({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (s: { start: string; end: string; territory: string }) => void;
}): JSX.Element {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [territory, setTerritory] = useState(TERRITORIES[0]!);
  return (
    <div className="p-1.5 bg-surface border border-accent rounded-md space-y-1">
      <div className="flex gap-1">
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full text-[10px] px-1 py-0.5 border border-line2 rounded numeric"
          placeholder="09:00"
        />
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-full text-[10px] px-1 py-0.5 border border-line2 rounded numeric"
          placeholder="17:00"
        />
      </div>
      <select
        value={territory}
        onChange={(e) => setTerritory(e.target.value)}
        className="w-full text-[10px] px-1 py-0.5 border border-line2 rounded"
      >
        {TERRITORIES.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <div className="flex gap-1">
        <button
          onClick={() => onSubmit({ start, end, territory })}
          className="flex-1 text-[10px] py-0.5 bg-accent text-surface rounded font-medium"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="px-1.5 text-[10px] py-0.5 bg-paper text-muted rounded inline-flex items-center"
        >
          <X size={10} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit shift panel
// ─────────────────────────────────────────────────────────────────────────────

function EditShiftPanel({
  shift,
  onClose,
  onSave,
  onDelete,
}: {
  shift: Shift;
  onClose: () => void;
  onSave: (patch: Partial<Shift>) => void;
  onDelete: () => void;
}): JSX.Element {
  const [start, setStart] = useState(shift.start);
  const [end, setEnd] = useState(shift.end);
  const [territory, setTerritory] = useState(shift.territory);
  const [lunchStart, setLunchStart] = useState(() => {
    if (!shift.lunch) return '12:00';
    return shift.lunch.split('-')[0] ?? '12:00';
  });
  const [lunchDur, setLunchDur] = useState(() => {
    // Derive the stored lunch duration ('HH:MM-HH:MM') so an untouched save
    // round-trips faithfully instead of being forced back to 45 minutes.
    if (!shift.lunch) return '45';
    const [s, e] = shift.lunch.split('-');
    if (!s || !e || e === 'CURRENT') return '45';
    const [sh, sm] = s.split(':').map(Number) as [number, number];
    const [eh, em] = e.split(':').map(Number) as [number, number];
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return '45';
    const mins = eh * 60 + em - (sh * 60 + sm);
    return mins > 0 ? String(mins) : '45';
  });
  const [status, setStatus] = useState<ShiftStatus>(shift.status);

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-surface border-l border-line2 shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-surface border-b border-line2 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-accent" />
          <div className="text-[13px] font-semibold text-ink">Edit shift</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
        >
          <X size={14} className="text-muted" />
        </button>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="mono">{shift.repInitials}</span>
          <div>
            <div className="text-[14px] font-semibold text-ink">{shift.repName}</div>
            <div className="text-[11px] text-muted">
              {shift.account} · {DAY_LABELS[shift.day]}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
            />
          </Field>
          <Field label="End time">
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
            />
          </Field>
        </div>

        <Field label="Territory">
          <select
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
          >
            {TERRITORIES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lunch start">
            <input
              type="time"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
            />
          </Field>
          <Field label="Lunch duration (min)">
            <input
              type="number"
              value={lunchDur}
              onChange={(e) => setLunchDur(e.target.value)}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
            />
          </Field>
        </div>

        <Field label="Status">
          <div className="flex flex-wrap gap-1.5">
            {(['scheduled', 'active', 'lunch', 'missed', 'completed'] as ShiftStatus[]).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition capitalize ${status === st ? 'bg-ink text-surface' : 'bg-paper text-muted hover:bg-line2 hover:text-ink'}`}
                >
                  {st}
                </button>
              ),
            )}
          </div>
        </Field>

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={() => {
              // build lunch string
              const dur = parseInt(lunchDur, 10);
              let lunch: string | undefined = undefined;
              if (shift.lunch && shift.lunch.endsWith('-CURRENT')) {
                // An in-progress lunch — preserve the live sentinel rather than
                // recomputing a fixed end time and freezing the timer.
                lunch = `${lunchStart}-CURRENT`;
              } else if (!Number.isNaN(dur) && dur > 0) {
                const [lh, lm] = lunchStart.split(':').map(Number) as [number, number];
                const totalMin = lh * 60 + lm + dur;
                const eh = Math.floor(totalMin / 60);
                const em = totalMin % 60;
                lunch = `${lunchStart}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
              }
              onSave({ start, end, territory, lunch, status });
            }}
          >
            Save
          </Button>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <button
          onClick={onDelete}
          className="w-full text-[11px] text-rose-600 hover:underline pt-2"
        >
          Delete shift
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted uppercase tracking-wider font-medium">{label}</div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rep summary panel
// ─────────────────────────────────────────────────────────────────────────────

function RepSummaryPanel({
  rep,
  shifts,
  onClose,
}: {
  rep: Rep;
  shifts: Shift[];
  onClose: () => void;
}): JSX.Element {
  const totalHrs = shifts.reduce((a, s) => a + hoursOf(s), 0);
  const lunches = shifts.filter((s) => !!s.lunch).length;
  const attended = shifts.filter((s) => s.status !== 'missed').length;
  const attendancePct = shifts.length > 0 ? Math.round((attended / shifts.length) * 100) : 100;
  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-surface border-l border-line2 shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-surface border-b border-line2 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="mono">{rep.initials}</span>
          <div className="text-[13px] font-semibold text-ink">{rep.name}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
        >
          <X size={14} className="text-muted" />
        </button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SummaryStat label="Total hours" value={`${totalHrs.toFixed(1)}h`} />
          <SummaryStat label="Shifts" value={String(shifts.length)} />
          <SummaryStat label="Lunch breaks" value={String(lunches)} />
          <SummaryStat label="Attendance" value={`${attendancePct}%`} />
        </div>
        <div>
          <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">
            Week shifts
          </div>
          <div className="space-y-1.5">
            {shifts.length === 0 && (
              <div className="text-[12px] text-soft">No shifts this week.</div>
            )}
            {shifts
              .sort((a, b) => a.day - b.day)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 bg-paper border border-line2 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-semibold text-ink w-8">
                      {DAY_LABELS[s.day]}
                    </div>
                    <div className="text-[11px] text-ink numeric">
                      {s.start}–{s.end}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{s.territory}</span>
                    <StatusPill
                      tone={
                        s.status === 'missed'
                          ? 'danger'
                          : s.status === 'lunch'
                            ? 'warn'
                            : s.status === 'active'
                              ? 'success'
                              : 'muted'
                      }
                    >
                      {s.status}
                    </StatusPill>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-paper border border-line2 rounded-lg p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className="text-[18px] font-semibold text-ink numeric mt-1">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add shift modal
// ─────────────────────────────────────────────────────────────────────────────

function AddShiftModal({
  reps,
  prefillDay,
  onClose,
  onAdd,
}: {
  reps: Rep[];
  prefillDay: number | null;
  onClose: () => void;
  onAdd: (s: Omit<Shift, 'id' | 'repName' | 'account'>) => void;
}): JSX.Element {
  const repOptions = reps.length > 0 ? reps : REPS;
  const [repInitials, setRepInitials] = useState(repOptions[0]!.initials);
  const [day, setDay] = useState(prefillDay ?? 0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [territory, setTerritory] = useState(TERRITORIES[0]!);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold text-ink mb-4">Add shift</div>
        <div className="space-y-3 mb-4">
          <Field label="Knocker">
            <select
              value={repInitials}
              onChange={(e) => setRepInitials(e.target.value)}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
            >
              {repOptions.map((r) => (
                <option key={r.initials} value={r.initials}>
                  {r.initials} · {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Day">
            <select
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value, 10))}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
              />
            </Field>
          </div>
          <Field label="Territory">
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
            >
              {TERRITORIES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onAdd({ repInitials, day, start, end, territory, status: 'scheduled' })}
          >
            Add shift
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day view
// ─────────────────────────────────────────────────────────────────────────────

function DayView({
  dayIndex,
  setDayIndex,
  dayLabels,
  shifts,
  reps,
  onClickShift,
  clockedOut,
}: {
  dayIndex: number;
  setDayIndex: (d: number) => void;
  dayLabels: string[];
  shifts: Shift[];
  reps: Rep[];
  onClickShift: (id: string) => void;
  clockedOut: Record<string, string>;
}): JSX.Element {
  const HOUR_START = 7;
  const HOUR_END = 18;
  const totalHours = HOUR_END - HOUR_START;
  const dayShifts = shifts.filter((s) => s.day === dayIndex);

  function positionFor(time: string): number {
    const [h, m] = time.split(':').map(Number) as [number, number];
    const offset = h + m / 60 - HOUR_START;
    return (offset / totalHours) * 100;
  }

  return (
    <Section
      title={`Day view · ${dayLabels[dayIndex]}`}
      subtitle="Timeline 07:00–18:00 · click a shift to edit"
      paddedBody={false}
    >
      <div className="px-4 py-3 border-b border-line2 flex items-center gap-2">
        {dayLabels.map((d, i) => (
          <button
            key={d}
            onClick={() => setDayIndex(i)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              dayIndex === i
                ? 'bg-ink text-surface'
                : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 900 }}>
          {/* Time axis */}
          <div className="flex border-b border-line2 bg-paper/40">
            <div className="w-32 shrink-0 px-3 py-2 text-[11px] text-muted uppercase tracking-wider font-medium">
              Knocker
            </div>
            <div className="flex-1 relative h-8">
              {Array.from({ length: totalHours + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-line2 text-[10px] text-soft pl-1 numeric"
                  style={{ left: `${(i / totalHours) * 100}%` }}
                >
                  {String(HOUR_START + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>
          {reps.map((r) => {
            const repShifts = dayShifts.filter((s) => s.repInitials === r.initials);
            return (
              <div key={r.initials} className="flex border-b border-line2 hover:bg-paper/30">
                <div className="w-32 shrink-0 px-3 py-3 flex items-center gap-2">
                  <span className="mono">{r.initials}</span>
                  <div className="text-[11px] text-ink truncate">{r.name}</div>
                </div>
                <div className="flex-1 relative h-14">
                  {Array.from({ length: totalHours + 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-line2/50"
                      style={{ left: `${(i / totalHours) * 100}%` }}
                    />
                  ))}
                  {repShifts.map((s) => {
                    const left = positionFor(s.start);
                    const right = positionFor(s.end);
                    const width = Math.max(2, right - left);
                    const tone =
                      s.status === 'missed'
                        ? 'bg-rose-100 border-rose-300 text-rose-800'
                        : s.status === 'lunch'
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : clockedOut[s.id]
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-accentSoft border-accent/30 text-ink';
                    return (
                      <button
                        key={s.id}
                        onClick={() => onClickShift(s.id)}
                        className={`absolute top-1.5 bottom-1.5 rounded-md border px-2 text-[10px] font-medium overflow-hidden text-left hover:shadow-md transition ${tone}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <div className="numeric">
                          {s.start}–{s.end}
                        </div>
                        <div className="truncate text-[9px] opacity-80">{s.territory}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month view
// ─────────────────────────────────────────────────────────────────────────────

function MonthView({ shifts, weekOffset }: { shifts: Shift[]; weekOffset: number }): JSX.Element {
  // 5 weeks × 7 days mini grid. Count shifts per (week, day).
  const weeks = Array.from({ length: 5 }, (_, w) => w);
  return (
    <Section
      title="Month view"
      subtitle="5-week overview · shifts scheduled per day"
      paddedBody={false}
    >
      <div className="p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-[10px] uppercase tracking-wider text-muted font-medium text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weeks.flatMap((w) =>
            DAY_LABELS.map((_, di) => {
              // Only the current week (offset 0) has real data; show count for that one, others = 0
              const isCurrentWeek = w === Math.max(0, Math.min(4, weekOffset + 2));
              const count = isCurrentWeek
                ? shifts.filter((s) => s.day === di).length
                : Math.round(shifts.filter((s) => s.day === di).length * (0.7 + w * 0.1));
              const dayNum = w * 7 + di + 1;
              return (
                <div
                  key={`${w}-${di}`}
                  className={`aspect-square rounded-md border p-2 flex flex-col ${
                    isCurrentWeek ? 'bg-accentSoft/30 border-accent/30' : 'bg-paper border-line2'
                  }`}
                >
                  <div className="text-[10px] text-muted numeric">{dayNum}</div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-[18px] font-bold text-ink numeric">{count}</div>
                  </div>
                  <div className="text-[9px] text-soft text-center">shifts</div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk action bar — appears above the week schedule when ≥1 shift is selected.
// ─────────────────────────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  picker,
  setPicker,
  onMoveDay,
  onSetTerritory,
  onDelete,
  onClear,
}: {
  count: number;
  picker: 'day' | 'territory' | null;
  setPicker: (p: 'day' | 'territory' | null) => void;
  onMoveDay: (day: number) => void;
  onSetTerritory: (territory: string) => void;
  onDelete: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 flex-wrap rounded-xl border border-accent/40 bg-accentSoft/40 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-surface text-[12px] font-semibold numeric">
          {count}
        </span>
        <span className="text-[13px] font-medium text-ink">
          shift{count > 1 ? 's' : ''} selected
        </span>
      </div>

      <div className="h-5 w-px bg-line2" />

      {/* Move to day */}
      <div className="relative">
        <button
          onClick={() => setPicker(picker === 'day' ? null : 'day')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-line2 bg-surface text-ink hover:bg-paper transition"
        >
          <MoveRight size={13} /> Move to day…
        </button>
        {picker === 'day' && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-line2 rounded-lg shadow-xl p-1 flex flex-col min-w-[120px]">
            {DAY_LABELS.map((d, i) => (
              <button
                key={d}
                onClick={() => {
                  onMoveDay(i);
                  setPicker(null);
                }}
                className="text-left px-3 py-1.5 rounded text-[12px] text-ink hover:bg-paper"
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Change territory */}
      <div className="relative">
        <button
          onClick={() => setPicker(picker === 'territory' ? null : 'territory')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-line2 bg-surface text-ink hover:bg-paper transition"
        >
          <MapPin size={13} /> Change territory…
        </button>
        {picker === 'territory' && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-line2 rounded-lg shadow-xl p-1 flex flex-col min-w-[160px]">
            {TERRITORIES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  onSetTerritory(t);
                  setPicker(null);
                }}
                className="text-left px-3 py-1.5 rounded text-[12px] text-ink hover:bg-paper"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-rose-300 bg-surface text-rose-600 hover:bg-rose-50 transition"
      >
        <Trash2 size={13} /> Delete selected
      </button>

      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink transition"
      >
        <X size={13} /> Clear
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template menu — apply / delete saved roster templates.
// ─────────────────────────────────────────────────────────────────────────────

function TemplateMenu({
  templates,
  onApply,
  onDelete,
}: {
  templates: RosterTemplate[];
  onApply: (name: string) => void;
  onDelete: (name: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(): void {
      setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return (): void => document.removeEventListener('click', onDoc);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-line2 text-muted hover:text-ink hover:bg-paper transition"
        title="Apply a saved roster template to this week"
      >
        <LayoutGrid size={13} />
        Apply template{templates.length > 0 ? ` (${templates.length})` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-line2 rounded-lg shadow-xl p-1 flex flex-col min-w-[220px]">
          {templates.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-soft">
              No templates yet. Use &ldquo;Save as template&rdquo;.
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-paper group"
              >
                <button
                  onClick={() => {
                    onApply(t.name);
                    setOpen(false);
                  }}
                  className="flex-1 text-left"
                >
                  <div className="text-[12px] font-medium text-ink truncate">{t.name}</div>
                  <div className="text-[10px] text-soft">{t.shifts.length} shifts</div>
                </button>
                <button
                  onClick={() => onDelete(t.name)}
                  aria-label={`Delete template ${t.name}`}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-600 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
