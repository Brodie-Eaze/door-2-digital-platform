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
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { RosterEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount, accountMonogram, type Account } from '@/lib/accounts';
import { buildRoster } from '@/lib/seed/roster';
import { firstRunSnapshot } from '@/lib/first-run';

type ShiftStatus = 'scheduled' | 'active' | 'lunch' | 'missed' | 'completed';

interface Shift {
  id: string;
  repInitials: string;
  repName: string;
  day: number;
  start: string;
  end: string;
  territory: string;
  lunch?: string;
  status: ShiftStatus;
}

interface Rep {
  initials: string;
  name: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildReps(account: Account): Rep[] {
  // Use the seeded roster — top 30 by tenure × on-shift bias so the schedule
  // matrix shows a representative cross-section. The DOM still caps at 30 for
  // readability; the headline KPI shows the full roster size.
  const SEED_MAX = 30;
  const roster = buildRoster({ slug: account.slug });
  // Prefer reps who are actually on-shift today; backfill with offline so
  // the matrix has a stable size when the calendar lands on a weekend.
  const onShift = roster.filter((k) => k.status !== 'offline').slice(0, SEED_MAX);
  if (onShift.length >= SEED_MAX) {
    return onShift.map((k) => ({ initials: k.initials, name: k.name }));
  }
  const backfill = roster.filter((k) => k.status === 'offline').slice(0, SEED_MAX - onShift.length);
  return [...onShift, ...backfill].map((k) => ({ initials: k.initials, name: k.name }));
}

function buildTerritories(account: Account): string[] {
  if (account.region === 'AU') {
    return ['Melbourne North', 'Sydney West', 'Brisbane Central', 'Perth East', 'Adelaide South'];
  }
  if (account.region === 'SG') {
    return ['Singapore Central', 'Singapore West'];
  }
  // US — vary by vertical
  if (account.vertical === 'commercial') {
    return ['Dallas Metro', 'Houston SE', 'Austin South', 'Phoenix West'];
  }
  return ['Austin East', 'Dallas Metro', 'Houston SE', 'Phoenix West', 'Atlanta North'];
}

function buildSeed(reps: Rep[], territories: string[]): Shift[] {
  const out: Shift[] = [];
  let id = 0;
  reps.forEach((r, ri) => {
    // Each rep gets 3-5 shifts/week (varied)
    const shiftCount = 3 + ((ri + 1) % 3);
    const territory = territories[ri % territories.length]!;
    for (let d = 0; d < shiftCount; d++) {
      const day = (d + (ri % 2)) % 5; // Mon-Fri mostly
      const start = ri % 3 === 0 ? '08:00' : '09:00';
      const end = ri % 3 === 0 ? '16:00' : '17:00';
      let status: ShiftStatus = 'scheduled';
      if (day === 0) {
        if (ri === 0) status = 'lunch';
        else if (ri === 1) status = 'missed';
        else status = 'active';
      }
      const shift: Shift = {
        id: `sh_${id++}`,
        repInitials: r.initials,
        repName: r.name,
        day,
        start,
        end,
        territory,
        status,
        lunch: status === 'lunch' ? '12:30-CURRENT' : undefined,
      };
      out.push(shift);
    }
  });
  return out;
}

function hoursOf(shift: Shift): number {
  const [sh, sm] = shift.start.split(':').map(Number) as [number, number];
  const [eh, em] = shift.end.split(':').map(Number) as [number, number];
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

function weekDates(offset: number): Date[] {
  const base = new Date(2026, 4, 19); // Mon May 19 2026
  base.setDate(base.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

export default function AccountRosterPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const reps = useMemo<Rep[]>(() => (account ? buildReps(account) : []), [account]);
  const territories = useMemo<string[]>(
    () => (account ? buildTerritories(account) : []),
    [account],
  );

  const [shifts, setShifts] = useState<Shift[]>(() => buildSeed(reps, territories));
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [dayIndex, setDayIndex] = useState(0);

  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [quickAddKey, setQuickAddKey] = useState<string | null>(null);
  const [clockedOut, setClockedOut] = useState<Record<string, string>>({});

  const dragId = useRef<string | null>(null);
  const justDraggedRef = useRef(false);
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  const dates = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => {
    const start = dates[0]!;
    return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [dates]);
  const dayLabels = useMemo(() => dates.map((d, i) => `${DAY_LABELS[i]} ${d.getDate()}`), [dates]);

  const todayShifts = shifts.filter((s) => s.day === 0 && weekOffset === 0);
  const scheduledToday = todayShifts.length;
  const hoursToday = todayShifts.reduce((a, s) => a + hoursOf(s), 0);
  const onLunchNow = todayShifts.filter((s) => s.status === 'lunch').length;
  const missedToday = todayShifts.filter((s) => s.status === 'missed').length;
  const activeNow = todayShifts.filter((s) => s.status === 'active' && !clockedOut[s.id]).length;

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setEditShiftId(null);
        setAddOpen(false);
        setQuickAddKey(null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function repByInitials(init: string): Rep {
    return reps.find((r) => r.initials === init) ?? reps[0]!;
  }

  function moveShift(id: string, targetRepInitials: string, targetDay: number): void {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const rep = repByInitials(targetRepInitials);
        return {
          ...s,
          repInitials: rep.initials,
          repName: rep.name,
          day: targetDay,
        };
      }),
    );
  }

  function updateShift(id: string, patch: Partial<Shift>): void {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addShift(s: Omit<Shift, 'id' | 'repName'>): void {
    const rep = repByInitials(s.repInitials);
    setShifts((prev) => [
      ...prev,
      {
        ...s,
        id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        repName: rep.name,
      },
    ]);
  }

  function deleteShift(id: string): void {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function clockOut(id: string): void {
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setClockedOut((prev) => ({ ...prev, [id]: stamp }));
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'completed' } : s)));
  }

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

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Roster & shifts">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <RosterEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Roster & shifts">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Rostering for <span className="font-semibold">{account.shortName}</span>&apos;s{' '}
            {account.knockers.toLocaleString()} Knockers (top {reps.length} shown). Hours
            auto-logged from Knocker iOS clock-in. Drag shifts between cells to reassign. Click any
            shift to edit. Pushes changes instantly to the rep&apos;s iPad.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Scheduled today"
            value={scheduledToday}
            hint={`of ${reps.length} active reps`}
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
          <div className="flex items-center gap-1">
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
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={() => setAddOpen(true)}
            >
              Add shift
            </Button>
          </div>
        </div>

        {view === 'week' && (
          <Section
            title={`Week schedule · ${account.shortName}`}
            subtitle="Drag any shift to reassign · click to edit"
            paddedBody={false}
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
                        className={`text-left px-3 py-3 border-b border-line2 text-[11px] uppercase tracking-wider font-medium ${i === 0 && weekOffset === 0 ? 'text-accent bg-accentSoft/30' : 'text-muted'}`}
                        style={{ minWidth: 130 }}
                      >
                        {d}{' '}
                        {i === 0 && weekOffset === 0 && (
                          <span className="text-[9px] text-accent">· TODAY</span>
                        )}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 border-b border-line2 text-[11px] uppercase tracking-wider text-muted font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => {
                    const repShifts = shifts.filter((s) => s.repInitials === r.initials);
                    const totalHrs = repShifts.reduce((a, s) => a + hoursOf(s), 0);
                    return (
                      <tr key={r.initials} className="hover:bg-paper/40">
                        <td className="px-4 py-3 border-b border-line2">
                          <div className="flex items-center gap-2">
                            <span className="mono">{r.initials}</span>
                            <div>
                              <div className="text-[13px] font-medium text-ink">{r.name}</div>
                              <div className="text-[10px] text-muted">{account.shortName}</div>
                            </div>
                          </div>
                        </td>
                        {dayLabels.map((_, di) => {
                          const cellKey = `${r.initials}:${di}`;
                          const cellShifts = repShifts.filter((s) => s.day === di);
                          const isHover = hoverCell === cellKey;
                          const isToday = di === 0 && weekOffset === 0;
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
                                    territories={territories}
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
                                    return (
                                      <div
                                        key={sh.id}
                                        draggable
                                        onDragStart={onDragStart(sh.id)}
                                        onDragEnd={onDragEnd}
                                        onClick={() => {
                                          if (justDraggedRef.current) return;
                                          setEditShiftId(sh.id);
                                        }}
                                        className={`p-2 rounded-md border cursor-grab active:cursor-grabbing hover:shadow-sm transition ${
                                          missed
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
                                        <div className="flex items-center justify-between">
                                          <div className="text-[11px] font-semibold text-ink numeric">
                                            {sh.start}–{sh.end}
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
                                            className={`text-[9px] mt-1 font-medium ${onLunch ? 'text-amber-700' : 'text-soft'}`}
                                          >
                                            Lunch · {sh.lunch}
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
            reps={reps}
            shifts={shifts}
            onClickShift={(id) => setEditShiftId(id)}
            clockedOut={clockedOut}
          />
        )}

        {view === 'month' && <MonthView shifts={shifts} weekOffset={weekOffset} />}

        <Section
          title="Today · live time tracking"
          subtitle="Clock-in / out + lunch breaks · auto-captured from Knocker iOS"
        >
          {todayShifts.length === 0 ? (
            <div className="text-[12px] text-soft">No shifts scheduled for today.</div>
          ) : (
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
          )}
        </Section>

        <div className="text-[11px] text-muted">
          Account scope · {accountMonogram(account.shortName)} · {account.shortName} · {reps.length}{' '}
          of {account.knockers} knockers shown
        </div>
      </div>

      {editingShift && (
        <EditShiftPanel
          shift={editingShift}
          territories={territories}
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

      {addOpen && (
        <AddShiftModal
          reps={reps}
          territories={territories}
          onClose={() => setAddOpen(false)}
          onAdd={(s) => {
            addShift(s);
            setAddOpen(false);
          }}
        />
      )}
    </AccountShell>
  );
}

function QuickAddInline({
  territories,
  onCancel,
  onSubmit,
}: {
  territories: string[];
  onCancel: () => void;
  onSubmit: (s: { start: string; end: string; territory: string }) => void;
}): JSX.Element {
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [territory, setTerritory] = useState(territories[0]!);
  return (
    <div className="p-1.5 bg-surface border border-accent rounded-md space-y-1">
      <div className="flex gap-1">
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full text-[10px] px-1 py-0.5 border border-line2 rounded numeric"
        />
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-full text-[10px] px-1 py-0.5 border border-line2 rounded numeric"
        />
      </div>
      <select
        value={territory}
        onChange={(e) => setTerritory(e.target.value)}
        className="w-full text-[10px] px-1 py-0.5 border border-line2 rounded"
      >
        {territories.map((t) => (
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

function EditShiftPanel({
  shift,
  territories,
  onClose,
  onSave,
  onDelete,
}: {
  shift: Shift;
  territories: string[];
  onClose: () => void;
  onSave: (patch: Partial<Shift>) => void;
  onDelete: () => void;
}): JSX.Element {
  const [start, setStart] = useState(shift.start);
  const [end, setEnd] = useState(shift.end);
  const [territory, setTerritory] = useState(shift.territory);
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
            <div className="text-[11px] text-muted">{DAY_LABELS[shift.day]}</div>
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
            {territories.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>

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
            onClick={() => onSave({ start, end, territory, status })}
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

function AddShiftModal({
  reps,
  territories,
  onClose,
  onAdd,
}: {
  reps: Rep[];
  territories: string[];
  onClose: () => void;
  onAdd: (s: Omit<Shift, 'id' | 'repName'>) => void;
}): JSX.Element {
  const [repInitials, setRepInitials] = useState(reps[0]!.initials);
  const [day, setDay] = useState(0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [territory, setTerritory] = useState(territories[0]!);

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
              {reps.map((r) => (
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
              {territories.map((t) => (
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

function DayView({
  dayIndex,
  setDayIndex,
  dayLabels,
  reps,
  shifts,
  onClickShift,
  clockedOut,
}: {
  dayIndex: number;
  setDayIndex: (d: number) => void;
  dayLabels: string[];
  reps: Rep[];
  shifts: Shift[];
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
      subtitle="Timeline 07:00–18:00 · click any shift to edit"
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

function MonthView({ shifts, weekOffset }: { shifts: Shift[]; weekOffset: number }): JSX.Element {
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
