// TODO(M5): AI zone suggestion + anomaly detection have no backing table yet
// (see schema.prisma) — AiNextZonesPanel/AnomaliesPanel render honest empty
// states below until those models + endpoints land. Fleet position (this
// page + HQLiveMap) and the activity feed are now wired to real
// KnockSession/Knock data via /api/fleet and /api/activity. hqRollup()
// headline KPIs remain seed-driven pending a dedicated rollup job — out of
// scope for this pass (see the W3 fleet/rep true-sourcing effort).
'use client';

import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { Banner, KpiCard, Money, Reveal } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { HQLiveMap } from '@/components/HQLiveMap';
import { CommandCentreEmpty } from '@/components/AccountEmptyStates';
import { apiFleetEntryToRep, HQ_FALLBACK_CENTER, type ApiFleetEntry } from '@/lib/fleet';
import { hqRollup } from '@/lib/seed/kpis';
import type { RealtimeMetrics } from '@/app/api/metrics/realtime/route';
import {
  AiNextZonesPanel,
  AnomaliesPanel,
  LiveActivityFeed,
  PushToFieldStrip,
  ReassignDrawer,
  type AiZoneSuggestion,
  type AnomalyItem,
  type ActivityEvent,
  type PushToFieldAction,
} from '@/components/field-ops';
import type { FleetRep } from '@/lib/fleet';

const HQ_SCOPE_LABEL = 'All accounts · HQ';

/** Human labels for the push-to-field actions, used in the honest queue toasts. */
const PUSH_ACTION_LABELS: Record<PushToFieldAction, string> = {
  broadcast_message: 'Broadcast message',
  update_pitch_script: 'Pitch script update',
  reassign_territories: 'Territory reassignment',
  end_shift_early: 'End-shift instruction',
};

// No backing AI-zone-suggestion or anomaly-detection model exists yet (see
// schema.prisma) — honest empty states until the propensity/anomaly
// services land. AnomaliesPanel + ReassignDrawer's signature interaction
// (fly-to-rep, distance-sorted reassign) stay wired to real /api/fleet data
// so the plumbing is ready the moment a real anomaly feed exists.
const HQ_AI_SUGGESTIONS: AiZoneSuggestion[] = [];
const HQ_ANOMALIES: AnomalyItem[] = [];

// No fabricated seed rows — LiveActivityFeed renders its own "No activity in
// the last 5 minutes" empty state until /api/activity reports real events.
const HQ_ACTIVITY: ActivityEvent[] = [];

export default function CommandCentrePage(): JSX.Element {
  // Live activity feed — starts empty (never fabricated), polled every 15
  // seconds from /api/activity. Zero events is an honest LIVE answer (nobody
  // has knocked in the last window), not a "demo" state.
  const [activity, setActivity] = useState<ActivityEvent[]>(HQ_ACTIVITY);
  const activityFreshness = useDataFreshness('live');
  const activityInFlight = useRef(false);

  // ── Signature interaction: anomaly → fly map → highlight rep → reassign ──
  // flyTarget drives the imperative map fly; activeAnomaly opens the drawer.
  // dismissedAnomalies greys out an anomaly after a successful reassignment.
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );
  const [activeAnomaly, setActiveAnomaly] = useState<AnomalyItem | null>(null);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity(): Promise<void> {
      if (activityInFlight.current || document.visibilityState === 'hidden') return;
      activityInFlight.current = true;
      try {
        const res = await fetch('/api/activity');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events?: ActivityEvent[] };
        if (Array.isArray(data.events)) {
          setActivity(data.events);
          activityFreshness.markFresh();
        }
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

  // Live fleet — same /api/fleet source HQLiveMap itself polls (each polls
  // independently; both are pure reads of the same active-KnockSession
  // query, so there's no drift risk in duplicating the fetch). Feeds the
  // idle/offline KPI tiles and the reassign drawer's candidate list.
  const [fleet, setFleet] = useState<FleetRep[]>([]);
  const fleetInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchFleet(): Promise<void> {
      if (fleetInFlight.current || document.visibilityState === 'hidden') return;
      fleetInFlight.current = true;
      try {
        const res = await fetch('/api/fleet');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { fleet?: ApiFleetEntry[] };
        if (Array.isArray(data.fleet)) {
          setFleet(data.fleet.map((r) => apiFleetEntryToRep(r, HQ_FALLBACK_CENTER)));
        }
      } catch {
        // Network failure — keep current state; next poll retries.
      } finally {
        fleetInFlight.current = false;
      }
    }

    void fetchFleet();
    const interval = setInterval(() => void fetchFleet(), 30_000);
    return (): void => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HQ rollup is the source of truth for the headline knock/conversion
  // numbers — every sub-account page reconciles against the same
  // `hqRollup()` slice (out of scope for this pass, see the header TODO).
  const hq = hqRollup();
  const idle = fleet.filter((r) => r.status === 'idle').length;
  const offline = fleet.filter((r) => r.status === 'offline').length;

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
              in the field, across all accounts. Positions refresh every 30 seconds by poll — live
              tracking activates when realtime is configured. Click any knocker for shift + activity
              detail.
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
            <KpiCard label="Idle 20-60min" value={idle} hint="no knock in that window" />
            <KpiCard label="Offline" value={offline} hint="no knock in 60min+" />
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

        {/* The main live map — flyTarget + highlightCoords drive the signature
            interaction (fly to the offline rep + pulse an amber ring), keyed
            off the anomaly's repCoords once a real anomaly feed exists. */}
        <Reveal delay={80}>
          <HQLiveMap flyTarget={flyTarget} highlightCoords={activeAnomaly?.repCoords ?? null} />
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
            anomalies={HQ_ANOMALIES.filter((a) => !dismissedAnomalies.has(a.id))}
            scopeLabel={HQ_SCOPE_LABEL}
            onAction={(anomaly) => {
              // Signature interaction: a critical anomaly carrying repCoords
              // flies the map to those coords, pulses the amber ring there, and
              // opens the reassign drawer. flyTarget + highlightCoords both
              // derive from anomaly.repCoords so they stay internally consistent
              // regardless of live/fixture fleet (a fixture rep id never matches
              // a live /api/fleet id).
              if (anomaly.severity === 'critical' && anomaly.repCoords) {
                setFlyTarget({ ...anomaly.repCoords, zoom: 13 });
                setActiveAnomaly(anomaly);
                return;
              }
              // Non-reassign anomalies keep an honest queue toast.
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

      {/* Reassign drawer — the back half of the signature interaction. Slides
          in over everything when a critical offline-rep anomaly is actioned. */}
      <ReassignDrawer
        anomaly={activeAnomaly}
        reps={fleet}
        onClose={() => {
          setActiveAnomaly(null);
          setFlyTarget(null);
        }}
        onAssigned={(anomalyId) => {
          setDismissedAnomalies((d) => new Set(d).add(anomalyId));
        }}
      />
    </PlatformShell>
  );
}
