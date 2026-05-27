'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Target,
  Sparkles,
  MapPin,
  Route,
  Calendar,
  TrendingUp,
  CheckCircle2,
  X,
  Loader2,
  Check,
  Pencil,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';

export type Period = 'today' | 'week' | 'month' | 'quarter';
export type TeamStatus = 'pending' | 'confirmed' | 'editing';
export type RecoStatus = 'open' | 'added';

export interface TeamPlan {
  id: string;
  teamName: string;
  priorityTone: 'high' | 'medium' | 'low';
  locationLabel: string;
  hoursLabel: string;
  betweenZonesLabel: string;
  forecastConv: number;
  forecastGmvCents: number;
  currency: 'USD' | 'AUD' | 'SGD';
  repInitials: string[];
  aiSuggestion: string;
}

export interface WeekForecastDay {
  day: string;
  conv: number;
  delta: number;
  breakdown?: { label: string; value: number }[];
}

export interface MonthRecommendation {
  id: string;
  title: string;
  detail: string;
}

export interface PlanningSurfaceProps {
  scopeLabel: string;
  defaultPlans: Record<Period, TeamPlan[]>;
  weekForecast: WeekForecastDay[];
  monthRecos: MonthRecommendation[];
  /** Push-to-field broadcast scope — number of iPads */
  iPadCount: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  quarter: 'Quarter',
};

const CURRENCY_SYMBOL: Record<TeamPlan['currency'], string> = {
  USD: '$',
  AUD: 'A$',
  SGD: 'S$',
};

function formatGmv(cents: number, currency: TeamPlan['currency']): string {
  const dollars = cents / 100;
  return `${CURRENCY_SYMBOL[currency]}${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function PlanningSurface({
  scopeLabel,
  defaultPlans,
  weekForecast,
  monthRecos,
  iPadCount,
}: PlanningSurfaceProps): JSX.Element {
  const [period, setPeriod] = useState<Period>('today');
  // Plans state — keyed by period so we can mutate per-period (e.g. auto-gen adds to current period only)
  const [plansByPeriod, setPlansByPeriod] = useState<Record<Period, TeamPlan[]>>(defaultPlans);
  const [teamStatus, setTeamStatus] = useState<Record<string, TeamStatus>>({});
  const [recoStatus, setRecoStatus] = useState<Record<string, RecoStatus>>({});
  const [editingTeam, setEditingTeam] = useState<TeamPlan | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [openBarIndex, setOpenBarIndex] = useState<number | null>(null);

  const plans = plansByPeriod[period];

  // Reset team/reco status when period changes (each period is a fresh draft)
  useEffect(() => {
    setOpenBarIndex(null);
  }, [period]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ESC closes side panel + bar popover
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setEditingTeam(null);
        setOpenBarIndex(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const confirmedCount = useMemo(
    () => Object.values(teamStatus).filter((s) => s === 'confirmed').length,
    [teamStatus],
  );
  const totalPlans = useMemo(
    () => Object.values(plansByPeriod).reduce((acc, arr) => acc + arr.length, 0),
    [plansByPeriod],
  );
  const hasConfirmed = confirmedCount > 0;

  function handleAutoGenerate(): void {
    setAutoGenerating(true);
    setTimeout(() => {
      // Build 1-3 new generated team plans for the current period
      const stamp = Date.now();
      const baseRepPool = ['NK', 'PA', 'EB', 'GL', 'TR', 'VS', 'CR', 'DM'];
      const fresh: TeamPlan[] = Array.from({ length: 3 }).map((_, i) => ({
        id: `auto-${stamp}-${i}`,
        teamName: `AI-suggested team ${i + 1}`,
        priorityTone: 'medium' as const,
        locationLabel: `Auto-routed cluster ${i + 1}`,
        hoursLabel: '09:00–17:00',
        betweenZonesLabel: 'AI-optimised route · 14min avg',
        forecastConv: 18 + i * 4,
        forecastGmvCents: (5400 + i * 1200) * 100,
        currency: plans[0]?.currency ?? 'USD',
        repInitials: baseRepPool.slice(i, i + 3),
        aiSuggestion:
          'AI: generated from idle reps + uncovered high-propensity zones. Review hours + reps before pushing.',
      }));
      setPlansByPeriod((prev) => ({
        ...prev,
        [period]: [...prev[period], ...fresh],
      }));
      setAutoGenerating(false);
      setToast('AI generated 3 new team plans · review below');
    }, 1500);
  }

  function handlePushToField(): void {
    if (!hasConfirmed) return;
    setToast(`Pushed plan to ${iPadCount} active iPads · 8s sync`);
  }

  function handleConfirm(teamId: string): void {
    setTeamStatus((prev) => ({ ...prev, [teamId]: 'confirmed' }));
  }

  function handleEdit(team: TeamPlan): void {
    setEditingTeam(team);
  }

  function handleSaveEdit(updated: TeamPlan): void {
    setPlansByPeriod((prev) => ({
      ...prev,
      [period]: prev[period].map((p) => (p.id === updated.id ? updated : p)),
    }));
    // After edit → mark as needs re-confirm
    setTeamStatus((prev) => ({ ...prev, [updated.id]: 'editing' }));
    setEditingTeam(null);
    setToast('Plan updated · re-confirm before push');
  }

  function handleAddReco(recoId: string): void {
    setRecoStatus((prev) => ({ ...prev, [recoId]: 'added' }));
    setToast('Recommendation added to backlog');
  }

  return (
    <div className="space-y-5 max-w-[1700px]">
      <Banner tone="info">
        <span className="text-[13px] flex items-center gap-2">
          <Sparkles size={13} className="text-accent" />
          <span>
            {scopeLabel} planning surface — AI-suggested day / week / month plans built from
            propensity scores, rep availability, and travel optimisation. Confirm a plan and it
            pushes to every Knocker iOS in one click.
          </span>
        </span>
      </Banner>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Plans drafted (period)"
          value={String(plans.length)}
          delta={`+${plans.length - (defaultPlans[period]?.length ?? 0)}`}
          deltaTone={plans.length > (defaultPlans[period]?.length ?? 0) ? 'positive' : 'neutral'}
        />
        <KpiCard
          label="Plans confirmed"
          value={String(confirmedCount)}
          hint={confirmedCount > 0 ? 'ready to push' : 'awaiting review'}
        />
        <KpiCard
          label="Avg travel saved"
          value="42min"
          delta="-18%"
          deltaTone="positive"
          hint="vs manual routing"
        />
        <KpiCard label="Forecast hit rate" value="91%" hint="targets actually met" />
      </div>

      {/* Time-horizon switcher */}
      <div className="flex items-center gap-2">
        {(['today', 'week', 'month', 'quarter'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            data-period={p}
            data-active={period === p}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition ${
              period === p
                ? 'bg-ink text-surface'
                : 'bg-paper text-muted hover:text-ink hover:bg-line2'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          leftIcon={
            autoGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />
          }
          onClick={handleAutoGenerate}
          disabled={autoGenerating}
          data-action="auto-generate"
        >
          {autoGenerating ? 'Generating…' : 'Auto-generate plan'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handlePushToField}
          disabled={!hasConfirmed}
          data-action="push-to-field"
        >
          Push to field
        </Button>
      </div>

      {/* Current-period plan */}
      <Section
        title={`${PERIOD_LABELS[period]}'s plan — AI-generated · review & push`}
        subtitle={`${scopeLabel} · ${plans.length} team plans · est. ${plans.reduce(
          (a, p) => a + p.forecastConv,
          0,
        )} conversions`}
        action={
          confirmedCount === plans.length && plans.length > 0 ? (
            <StatusPill tone="success">All confirmed</StatusPill>
          ) : confirmedCount > 0 ? (
            <StatusPill tone="info">
              {confirmedCount}/{plans.length} confirmed
            </StatusPill>
          ) : (
            <StatusPill tone="warn">Pending review</StatusPill>
          )
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {plans.map((p) => {
            const status = teamStatus[p.id] ?? 'pending';
            const borderClass =
              status === 'confirmed'
                ? 'border-l-success'
                : status === 'editing'
                  ? 'border-l-warn'
                  : p.priorityTone === 'high'
                    ? 'border-l-accent'
                    : 'border-l-muted';
            return (
              <div
                key={p.id}
                data-team-id={p.id}
                data-team-status={status}
                className={`card card-pad border-l-4 ${borderClass}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-[13px] font-semibold text-ink">{p.teamName}</div>
                  {status === 'confirmed' ? (
                    <StatusPill tone="success">Confirmed</StatusPill>
                  ) : status === 'editing' ? (
                    <StatusPill tone="warn">Edited · re-confirm</StatusPill>
                  ) : (
                    <StatusPill tone={p.priorityTone === 'high' ? 'info' : 'muted'}>
                      {p.priorityTone}
                    </StatusPill>
                  )}
                </div>
                <div className="space-y-1.5 text-[12px] mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-soft" />
                    <span className="text-ink">{p.locationLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-soft" />
                    <span className="text-ink numeric">{p.hoursLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Route size={11} className="text-soft" />
                    <span className="text-muted">{p.betweenZonesLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Target size={11} className="text-success" />
                    <span className="text-success font-semibold">
                      {p.forecastConv} conv · {formatGmv(p.forecastGmvCents, p.currency)} GMV
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.repInitials.map((r) => (
                    <span key={r} className="mono !w-6 !h-6 !text-[10px]">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="bg-accentSoft/30 border border-accent/20 rounded-lg p-2.5 text-[11px] text-muted flex items-start gap-1.5">
                  <Sparkles size={11} className="text-accent shrink-0 mt-0.5" />
                  <span>{p.aiSuggestion}</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <button
                    onClick={() => handleConfirm(p.id)}
                    disabled={status === 'confirmed'}
                    data-action="confirm"
                    data-team-id={p.id}
                    className={`flex-1 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                      status === 'confirmed'
                        ? 'bg-success/15 text-success cursor-default'
                        : 'bg-ink text-surface hover:bg-ink2'
                    }`}
                  >
                    {status === 'confirmed' ? (
                      <>
                        <Check size={11} /> Confirmed
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={11} /> Confirm
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(p)}
                    data-action="edit"
                    data-team-id={p.id}
                    className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-paper border border-line2 text-ink hover:bg-line2 flex items-center justify-center gap-1"
                  >
                    <Pencil size={11} />
                    {status === 'confirmed' ? 'Edit again' : 'Edit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Forecast vs actuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Week forecast · AI-projected"
          subtitle="If approved plans execute as drafted · click a bar for breakdown"
        >
          <div className="space-y-3">
            {weekForecast.map((d, i) => (
              <div key={d.day} className="flex items-center gap-3 relative">
                <div className="w-10 text-[12px] text-muted font-medium">{d.day}</div>
                <div className="flex-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenBarIndex(openBarIndex === i ? null : i)}
                    data-action="forecast-bar"
                    data-day={d.day}
                    className="flex-1 h-6 bg-paper rounded relative overflow-hidden border border-line2 hover:border-accent transition cursor-pointer text-left"
                  >
                    <div
                      className="h-full bg-accent/70"
                      style={{ width: `${Math.min(d.conv, 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-ink numeric">
                      {d.conv} conv forecast
                    </div>
                  </button>
                  <span
                    className={`text-[11px] numeric w-12 text-right ${
                      d.delta >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {d.delta >= 0 ? '+' : ''}
                    {d.delta}
                  </span>
                </div>
                {openBarIndex === i && d.breakdown && (
                  <div
                    role="dialog"
                    data-bar-popover={d.day}
                    className="absolute left-12 top-7 z-40 w-[320px] bg-surface border border-line2 shadow-lg rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] font-semibold text-ink">
                        {d.day} · {d.conv} forecast
                      </div>
                      <button
                        onClick={() => setOpenBarIndex(null)}
                        className="text-soft hover:text-ink"
                        aria-label="Close"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {d.breakdown.map((b) => (
                        <div
                          key={b.label}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-muted">{b.label}</span>
                          <span className="text-ink numeric font-medium">{b.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="text-[11px] text-muted pt-2 border-t border-line2 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-success" />
              Week total:{' '}
              <span className="font-semibold text-ink">
                {weekForecast.reduce((a, d) => a + d.conv, 0)} conversions
              </span>{' '}
              ·{' '}
              <span className="text-success font-semibold">
                +
                {Math.round(
                  (weekForecast.reduce((a, d) => a + d.delta, 0) /
                    weekForecast.reduce((a, d) => a + (d.conv - d.delta), 0)) *
                    100,
                )}
                %
              </span>{' '}
              vs LW
            </div>
          </div>
        </Section>

        <Section
          title="Month outlook · what AI recommends"
          subtitle="Strategic moves for next 30 days"
        >
          <div className="space-y-3">
            {monthRecos.map((rec) => {
              const added = recoStatus[rec.id] === 'added';
              return (
                <div
                  key={rec.id}
                  data-reco-id={rec.id}
                  data-reco-status={added ? 'added' : 'open'}
                  className={`rounded-xl border p-3 transition ${
                    added ? 'bg-accentSoft/40 border-accent/40' : 'bg-paper border-line2'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                    <Sparkles size={11} className="text-accent" /> {rec.title}
                  </div>
                  <div className="text-[11px] text-muted mt-1">{rec.detail}</div>
                  <button
                    onClick={() => handleAddReco(rec.id)}
                    disabled={added}
                    data-action="add-to-plan"
                    data-reco-id={rec.id}
                    className={`mt-2 text-[11px] font-medium inline-flex items-center gap-1 ${
                      added ? 'text-success cursor-default' : 'text-accent hover:underline'
                    }`}
                  >
                    {added ? (
                      <>
                        <Check size={11} aria-hidden /> Added to plan
                      </>
                    ) : (
                      <>Add to plan</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Hidden hint about total plans for QA */}
      <div className="text-[10px] text-soft" data-total-plans={totalPlans} />

      {/* Edit side panel */}
      {editingTeam && (
        <EditPanel
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          data-toast
          className="fixed bottom-6 right-6 z-[60] bg-ink text-surface px-4 py-2.5 rounded-lg shadow-xl text-[12px] font-medium flex items-center gap-2 animate-in"
        >
          <CheckCircle2 size={14} className="text-success" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit side panel
// ─────────────────────────────────────────────────────────────────────────────

interface EditPanelProps {
  team: TeamPlan;
  onClose: () => void;
  onSave: (updated: TeamPlan) => void;
}

const TERRITORY_OPTIONS = [
  'Austin East',
  'Austin South',
  'Austin North',
  'Austin Central',
  'Dallas Metro',
  'Dallas North',
  'Plano',
  'Houston Central',
  'Houston SE',
  'Houston West',
  'Sydney CBD',
  'Sydney East',
  'Melbourne CBD',
  'Brisbane CBD',
  'Surfers Paradise',
  'Broadbeach',
  'Robina',
  'Burleigh Heads',
  'Phoenix Metro',
  'Scottsdale',
];

function EditPanel({ team, onClose, onSave }: EditPanelProps): JSX.Element {
  const [startTime, setStartTime] = useState(team.hoursLabel.split('–')[0] ?? '09:00');
  const [endTime, setEndTime] = useState(team.hoursLabel.split('–')[1] ?? '17:00');
  const [territories, setTerritories] = useState<string[]>(() => {
    // Seed from location label
    const matches = TERRITORY_OPTIONS.filter((t) => team.locationLabel.includes(t));
    return matches.length > 0 ? matches : [TERRITORY_OPTIONS[0]!];
  });
  const [reps, setReps] = useState<string[]>(team.repInitials);
  const [newRep, setNewRep] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(45);
  const [routeNotes, setRouteNotes] = useState(team.aiSuggestion);

  const panelRef = useRef<HTMLDivElement>(null);

  // Outside click closes
  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Defer to avoid catching the opening click
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  function toggleTerritory(name: string): void {
    setTerritories((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    );
  }

  function removeRep(initials: string): void {
    setReps((prev) => prev.filter((r) => r !== initials));
  }

  function addRep(): void {
    const cleaned = newRep.trim().toUpperCase().slice(0, 3);
    if (!cleaned || reps.includes(cleaned)) return;
    setReps((prev) => [...prev, cleaned]);
    setNewRep('');
  }

  function handleSave(): void {
    onSave({
      ...team,
      hoursLabel: `${startTime}–${endTime}`,
      locationLabel: territories.join(' + '),
      repInitials: reps,
      aiSuggestion: routeNotes,
      betweenZonesLabel:
        territories.length > 1
          ? `${territories.length} zones · ${breakMinutes}m break`
          : 'In-zone only',
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-ink/30 z-40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Edit ${team.teamName}`}
        data-edit-panel
        className="fixed inset-y-0 right-0 w-[480px] z-50 bg-surface border-l border-line2 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line2">
          <div>
            <div className="text-[14px] font-semibold text-ink">Edit plan</div>
            <div className="text-[11px] text-muted">{team.teamName}</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-paper flex items-center justify-center"
            aria-label="Close"
          >
            <X size={14} className="text-soft" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Hours */}
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 block">
              Shift hours
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-field="start-time"
                className="flex-1 h-9 px-2.5 rounded-lg border border-line2 bg-surface text-[13px] text-ink focus:outline-none focus:border-accent"
              />
              <span className="text-muted text-[12px]">to</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-field="end-time"
                className="flex-1 h-9 px-2.5 rounded-lg border border-line2 bg-surface text-[13px] text-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Territories */}
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 block">
              Territories ({territories.length} selected)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TERRITORY_OPTIONS.map((t) => {
                const selected = territories.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTerritory(t)}
                    data-field="territory-chip"
                    data-territory={t}
                    data-selected={selected}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                      selected
                        ? 'bg-ink text-surface'
                        : 'bg-paper text-muted border border-line2 hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reps */}
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 block">
              Reps assigned ({reps.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {reps.map((r) => (
                <span
                  key={r}
                  data-field="rep-pill"
                  data-initials={r}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-paper border border-line2 text-[11px] font-medium text-ink"
                >
                  {r}
                  <button
                    onClick={() => removeRep(r)}
                    className="w-4 h-4 rounded-full hover:bg-danger/15 hover:text-danger flex items-center justify-center"
                    aria-label={`Remove ${r}`}
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRep}
                onChange={(e) => setNewRep(e.target.value.toUpperCase().slice(0, 3))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addRep();
                }}
                placeholder="Add initials (e.g. KP)"
                data-field="new-rep"
                className="flex-1 h-8 px-2.5 rounded-lg border border-line2 bg-surface text-[12px] text-ink focus:outline-none focus:border-accent"
              />
              <Button variant="secondary" size="sm" onClick={addRep}>
                Add rep
              </Button>
            </div>
          </div>

          {/* Break */}
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 block">
              Break time
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={15}
                max={90}
                step={5}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                data-field="break"
                className="flex-1 accent-accent"
              />
              <span className="text-[12px] text-ink numeric font-medium w-14 text-right">
                {breakMinutes} min
              </span>
            </div>
          </div>

          {/* Route notes */}
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 block">
              Route notes
            </label>
            <textarea
              value={routeNotes}
              onChange={(e) => setRouteNotes(e.target.value)}
              rows={4}
              data-field="route-notes"
              className="w-full px-2.5 py-2 rounded-lg border border-line2 bg-surface text-[12px] text-ink focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-line2 flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={onClose} data-action="cancel-edit">
            Cancel
          </Button>
          <div className="flex-1" />
          <Button variant="primary" size="md" onClick={handleSave} data-action="save-edit">
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}
