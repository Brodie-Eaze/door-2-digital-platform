'use client';

import { Radio } from 'lucide-react';
import { Banner, KpiCard, Money, Reveal } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { HQLiveMap } from '@/components/HQLiveMap';
import { CommandCentreEmpty } from '@/components/AccountEmptyStates';
import { FLEET_REPS } from '@/lib/fleet-reps';
import { hqRollup } from '@/lib/seed/kpis';
import {
  AiNextZonesPanel,
  AnomaliesPanel,
  LiveActivityFeed,
  PushToFieldStrip,
  type AiZoneSuggestion,
  type AnomalyItem,
  type ActivityEvent,
} from '@/components/field-ops';

const HQ_SCOPE_LABEL = 'All accounts · HQ';

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
  // HQ rollup is the source of truth for the headline numbers — every
  // sub-account page reconciles against the same `hqRollup()` slice.
  // FLEET_REPS is the *map* sample (capped at ~120 pins for legibility);
  // the KPIs reflect the full Pilot-Charlie-scale operation.
  const hq = hqRollup();
  const onBreak = FLEET_REPS.filter((r) => r.status === 'break').length;
  const idle = FLEET_REPS.filter((r) => r.status === 'idle').length;
  const offline = FLEET_REPS.filter((r) => r.status === 'offline').length;
  const convRate = hq.totalKnocksToday > 0 ? (hq.totalConvToday / hq.totalKnocksToday) * 100 : 0;

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
              next zones pulse blue. Click any rep for shift + activity detail.
            </span>
          </span>
        </Banner>

        {/* Fleet KPIs — HQ totals across all accounts. */}
        <Reveal delay={0} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiCard
            label="Active iPads"
            value={hq.totalActiveReps.toLocaleString()}
            hint={`of ${hq.totalReps.toLocaleString()} on roster`}
            delta="+8 last hour"
            deltaTone="positive"
          />
          <KpiCard label="On break" value={onBreak} hint="lunch / scheduled" />
          <KpiCard label="Idle > 15min" value={idle} hint="manager nudge sent" />
          <KpiCard label="Offline" value={offline} hint="not clocked in" />
          <KpiCard
            label="Knocks today"
            value={hq.totalKnocksToday.toLocaleString()}
            delta="+8.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conv. today"
            value={hq.totalConvToday.toLocaleString()}
            delta="+12%"
            deltaTone="positive"
            hint={`${convRate.toFixed(1)}% rate`}
          />
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
          <AiNextZonesPanel zones={HQ_AI_SUGGESTIONS} scopeLabel={HQ_SCOPE_LABEL} />
          <AnomaliesPanel anomalies={HQ_ANOMALIES} scopeLabel={HQ_SCOPE_LABEL} />
          <LiveActivityFeed events={HQ_ACTIVITY} scopeLabel={HQ_SCOPE_LABEL} />
        </Reveal>

        {/* Quick push-to-field action */}
        <PushToFieldStrip
          scopeLabel={HQ_SCOPE_LABEL}
          onAction={(kind) => {
            // HQ broadcast wiring lands in Phase 1.2. For now: log + toast hook.
            // eslint-disable-next-line no-console
            console.log(`HQ Push to field: ${kind}`);
          }}
        />
      </div>
    </PlatformShell>
  );
}
