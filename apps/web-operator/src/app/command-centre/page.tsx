'use client';

import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { Banner, KpiCard, Money, Reveal } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { HQLiveMap } from '@/components/HQLiveMap';
import { CommandCentreEmpty } from '@/components/AccountEmptyStates';
import { FLEET_REPS } from '@/lib/fleet-reps';
import { hqRollup } from '@/lib/seed/kpis';
import type { RealtimeMetrics } from '@/app/api/metrics/realtime/route';
import {
  AiNextZonesPanel,
  AnomaliesPanel,
  LiveActivityFeed,
  PushToFieldStrip,
  type AiZoneSuggestion,
  type AnomalyItem,
  type ActivityEvent,
  type PushToFieldAction,
} from '@/components/field-ops';

const HQ_SCOPE_LABEL = 'All accounts · HQ';

/** Human labels for the push-to-field actions, used in the honest queue toasts. */
const PUSH_ACTION_LABELS: Record<PushToFieldAction, string> = {
  broadcast_message: 'Broadcast message',
  update_pitch_script: 'Pitch script update',
  reassign_territories: 'Territory reassignment',
  end_shift_early: 'End-shift instruction',
};

const HQ_AI_SUGGESTIONS: AiZoneSuggestion[] = [
  {
    id: 'hq-zone-1',
    name: 'Austin South · 78704',
    propensity: 0.81,
    reasonOneLiner: 'ACS median income $94k · charity-giving propensity 0.83 · 0% saturation',
    estLiftPp: 14,
    saturationPercent: 0,
    recommendedReps: 2,
  },
  {
    id: 'hq-zone-2',
    name: 'Plano · 75024',
    propensity: 0.78,
    reasonOneLiner: 'Lookalike to top-performing Highland Park · low Dallas saturation',
    estLiftPp: 11,
    saturationPercent: 12,
    recommendedReps: 2,
  },
  {
    id: 'hq-zone-3',
    name: 'Sugar Land · 77479',
    propensity: 0.74,
    reasonOneLiner: '24% knocks-not-converted in nearby Bellaire = warm re-engage pool',
    estLiftPp: 9,
    saturationPercent: 8,
    recommendedReps: 1,
  },
];

const HQ_ANOMALIES: AnomalyItem[] = [
  {
    id: 'hq-anom-1',
    severity: 'critical',
    title: 'Devon R offline since 09:00',
    detail: 'Houston SE shift uncovered. Auto-SMS + push sent. Backup: reassign to Marcus L.',
    actionLabel: 'Reassign',
  },
  {
    id: 'hq-anom-2',
    severity: 'warn',
    title: 'Tomás M lunch break > 45min',
    detail: 'On break since 12:48. Auto-reminder push sent.',
    actionLabel: 'Nudge',
  },
  {
    id: 'hq-anom-3',
    severity: 'warn',
    title: 'Hiroshi K conv. rate dropped 11pp',
    detail: 'Last 4 hours vs trailing avg. Try script v3.2 + check territory saturation.',
    actionLabel: 'Open 1:1',
  },
];

const HQ_ACTIVITY: ActivityEvent[] = [
  {
    id: 'hq-act-1',
    at: '14:42',
    actorInitials: 'JD',
    type: 'conversion',
    primary: 'Conversion captured',
    secondary: 'Maria Santos · $24/mo · Austin East',
  },
  {
    id: 'hq-act-2',
    at: '14:41',
    actorInitials: 'JM',
    type: 'knock_lead',
    primary: 'Knock recorded · LEAD',
    secondary: '4218 Lakeview Dr',
  },
  {
    id: 'hq-act-3',
    at: '14:40',
    actorInitials: 'KP',
    type: 'callback_scheduled',
    primary: 'Callback scheduled',
    secondary: 'Robert Kim · Tue 3pm',
  },
  {
    id: 'hq-act-4',
    at: '14:38',
    actorInitials: 'AR',
    type: 'shift_start',
    primary: 'Started shift',
    secondary: 'Austin North · 8h shift',
  },
  {
    id: 'hq-act-5',
    at: '14:36',
    actorInitials: 'BC',
    type: 'conversion',
    primary: 'Conversion captured',
    secondary: 'PestMax service contract · $480',
  },
  {
    id: 'hq-act-6',
    at: '14:35',
    actorInitials: 'TM',
    type: 'shift_break_return',
    primary: 'Returned from break',
    secondary: 'Lunch 45m',
  },
  {
    id: 'hq-act-7',
    at: '14:32',
    actorInitials: 'AM',
    type: 'knock_sale',
    primary: 'Knock recorded · SALE',
    secondary: '1502 Cedar St · $36/mo recurring',
  },
  {
    id: 'hq-act-8',
    at: '14:30',
    actorInitials: 'JM',
    type: 'knock_not_home',
    primary: 'Knock recorded · NOT HOME',
    secondary: '4216 Lakeview Dr',
  },
];

export default function CommandCentrePage(): JSX.Element {
  // Live activity feed — seeded from the hardcoded fixture, replaced on mount
  // and polled every 15 seconds from /api/activity. The badge next to the feed
  // tells the operator honestly whether they're looking at live or demo data.
  const [activity, setActivity] = useState<ActivityEvent[]>(HQ_ACTIVITY);
  const activityFreshness = useDataFreshness('fixture');
  const activityInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity(): Promise<void> {
      if (activityInFlight.current || document.visibilityState === 'hidden') return;
      activityInFlight.current = true;
      try {
        const res = await fetch('/api/activity');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events?: ActivityEvent[] };
        if (Array.isArray(data.events) && data.events.length > 0) {
          setActivity(data.events);
          activityFreshness.markFresh();
        }
        // Empty array (no knocks yet in DB) → keep seed data; badge stays DEMO.
      } catch {
        // Network failure — keep current state; staleness timer downgrades.
      } finally {
        activityInFlight.current = false;
      }
    }

    void fetchActivity();
    const interval = setInterval(() => void fetchActivity(), 15_000);
    return (): void => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live headline KPIs — seeded from hqRollup(), replaced by real DB counters
  // from /api/metrics/realtime once the field reports activity. Polled every
  // 30 seconds with the same visibility + in-flight guards as the activity
  // poll above. All-zero responses (empty tables) keep the seed numbers and
  // the DEMO badge — the badge only says LIVE when live numbers are shown.
  const [liveMetrics, setLiveMetrics] = useState<Pick<
    RealtimeMetrics,
    'knocksToday' | 'convToday' | 'activeReps'
  > | null>(null);
  const metricsFreshness = useDataFreshness('fixture');
  const metricsInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics(): Promise<void> {
      if (metricsInFlight.current || document.visibilityState === 'hidden') return;
      metricsInFlight.current = true;
      try {
        const res = await fetch('/api/metrics/realtime');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Partial<RealtimeMetrics>;
        if (
          typeof data.knocksToday !== 'number' ||
          typeof data.convToday !== 'number' ||
          typeof data.activeReps !== 'number'
        ) {
          return; // Malformed payload — keep current state.
        }
        if (data.knocksToday > 0 || data.convToday > 0 || data.activeReps > 0) {
          setLiveMetrics({
            knocksToday: data.knocksToday,
            convToday: data.convToday,
            activeReps: data.activeReps,
          });
          metricsFreshness.markFresh();
        } else {
          // Honest zeros (no field activity in DB yet) → seed numbers + DEMO badge.
          setLiveMetrics(null);
          metricsFreshness.markFixture();
        }
      } catch {
        // Network failure — keep current state; staleness timer downgrades.
      } finally {
        metricsInFlight.current = false;
      }
    }

    void fetchMetrics();
    const interval = setInterval(() => void fetchMetrics(), 30_000);
    return (): void => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HQ rollup is the source of truth for the headline numbers — every
  // sub-account page reconciles against the same `hqRollup()` slice.
  // FLEET_REPS is the *map* sample (capped at ~120 pins for legibility);
  // the KPIs reflect the full Pilot-Charlie-scale operation.
  const hq = hqRollup();
  const onBreak = FLEET_REPS.filter((r) => r.status === 'break').length;
  const idle = FLEET_REPS.filter((r) => r.status === 'idle').length;
  const offline = FLEET_REPS.filter((r) => r.status === 'offline').length;

  // Headline counters: live DB values when the realtime poll has reported
  // actual field activity (non-null + at least one value > 0 — enforced at
  // setLiveMetrics time), otherwise the seeded hqRollup figures. Derived
  // stats (conv rate) always follow whichever set is displayed.
  const metricsLive = liveMetrics !== null;
  const knocksToday = liveMetrics ? liveMetrics.knocksToday : hq.totalKnocksToday;
  const convToday = liveMetrics ? liveMetrics.convToday : hq.totalConvToday;
  const activeReps = liveMetrics ? liveMetrics.activeReps : hq.totalActiveReps;
  const convRate = knocksToday > 0 ? (convToday / knocksToday) * 100 : 0;

  // Rare but possible: no per-account activity at all. Render the platform
  // empty state instead of a wall of zeros.
  if (hq.perAccount.length === 0 || hq.totalReps === 0) {
    return (
      <PlatformShell pageTitle="Command Centre · Live field map">
        <div className="space-y-5 max-w-[1400px]">
          <CommandCentreEmpty />
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell pageTitle="Command Centre · Live field map">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Radio size={13} className="text-accent" />
            <span>
              Live satellite view of every <span className="font-semibold">Knocker iOS</span> iPad
              in the field, across all accounts. Pins update from GPS every 30 seconds. AI-suggested
              next zones pulse blue. Click any knocker for shift + activity detail.
            </span>
          </span>
        </Banner>

        {/* Fleet KPIs — HQ totals across all accounts. Knocks / conversions /
            active iPads flip to live DB counters from /api/metrics/realtime;
            the badge says honestly which set is on screen. Seed-only deltas
            are hidden in live mode — never a fabricated trend on real data. */}
        <Reveal delay={0}>
          <div className="flex items-center justify-end mb-2">
            <DataSourceBadge
              source={metricsFreshness.source}
              updatedAt={metricsFreshness.updatedAt}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KpiCard
              label="Active iPads"
              value={activeReps.toLocaleString()}
              hint={
                metricsLive
                  ? 'open shift sessions · live'
                  : `of ${hq.totalReps.toLocaleString()} on roster`
              }
              delta={metricsLive ? undefined : '+8 last hour'}
              deltaTone="positive"
            />
            <KpiCard label="On break" value={onBreak} hint="lunch / scheduled" />
            <KpiCard label="Idle > 15min" value={idle} hint="manager nudge sent" />
            <KpiCard label="Offline" value={offline} hint="not clocked in" />
            <KpiCard
              label="Knocks today"
              value={knocksToday.toLocaleString()}
              delta={metricsLive ? undefined : '+8.4%'}
              deltaTone="positive"
            />
            <KpiCard
              label="Conv. today"
              value={convToday.toLocaleString()}
              delta={metricsLive ? undefined : '+12%'}
              deltaTone="positive"
              hint={`${convRate.toFixed(1)}% rate`}
            />
          </div>
        </Reveal>

        {/* HQ rollup totals — reconciled with every per-account view. */}
        <Reveal delay={40} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Conversions · 7d"
            value={hq.totalConvWeek.toLocaleString()}
            delta="+14%"
            deltaTone="positive"
            hint="across 4 accounts"
          />
          <KpiCard
            label="Conversions · MTD"
            value={hq.totalConvMTD.toLocaleString()}
            delta="+22%"
            deltaTone="positive"
            hint={`${hq.perAccount.length} accounts live`}
          />
          <KpiCard
            label="Revenue · MTD"
            value={<Money cents={hq.totalRevenueCentsMTD} region="US" />}
            delta="+18.2%"
            deltaTone="positive"
            hint="mixed USD/AUD · displayed USD"
          />
          <KpiCard
            label="Territories active"
            value={hq.totalTerritories}
            hint="across all metros"
          />
        </Reveal>

        {/* The main live map */}
        <Reveal delay={80}>
          <HQLiveMap />
        </Reveal>

        {/* AI Insights + alerts row */}
        <Reveal delay={160} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AiNextZonesPanel
            zones={HQ_AI_SUGGESTIONS}
            scopeLabel={HQ_SCOPE_LABEL}
            onAssign={(zone) => {
              // Auto-dispatch wiring lands in Phase 1.2 — honest queue toast for now.
              toast.success(
                `Assignment queued — ${zone.recommendedReps} rep${
                  zone.recommendedReps === 1 ? '' : 's'
                } to ${zone.name}`,
              );
            }}
          />
          <AnomaliesPanel
            anomalies={HQ_ANOMALIES}
            scopeLabel={HQ_SCOPE_LABEL}
            onAction={(anomaly) => {
              // Resolution workflows land in Phase 1.2 — honest queue toast for now.
              toast.info(`${anomaly.actionLabel} queued — ${anomaly.title}`);
            }}
          />
          <div className="relative">
            <div className="absolute top-3 right-3 z-10">
              <DataSourceBadge
                source={activityFreshness.source}
                updatedAt={activityFreshness.updatedAt}
              />
            </div>
            <LiveActivityFeed events={activity} scopeLabel={HQ_SCOPE_LABEL} />
          </div>
        </Reveal>

        {/* Quick push-to-field action */}
        <PushToFieldStrip
          scopeLabel={HQ_SCOPE_LABEL}
          onAction={(kind) => {
            // HQ broadcast wiring lands in Phase 1.2 — honest queue toast,
            // never a silent click.
            toast.info(
              `${PUSH_ACTION_LABELS[kind]} queued for HQ dispatch — wiring lands in Phase 1.2`,
            );
          }}
        />
      </div>
    </PlatformShell>
  );
}
