'use client';

import { use } from 'react';

import { Banner, KpiCard } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import { LiveMapEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { getAccountFleet } from '@/lib/account-fleet';
import {
  AiNextZonesPanel,
  AnomaliesPanel,
  LiveActivityFeed,
  PushToFieldStrip,
} from '@/components/field-ops';
import type { PushToFieldAction } from '@/components/field-ops/types';
import { toast } from '@/components/Toaster';
import { firstRunSnapshot } from '@/lib/first-run';

/** Human labels for the push-to-field actions, used in the honest queue toasts. */
const PUSH_ACTION_LABELS: Record<PushToFieldAction, string> = {
  broadcast_message: 'Broadcast message',
  update_pitch_script: 'Pitch script update',
  reassign_territories: 'Territory reassignment',
  end_shift_early: 'End-shift instruction',
};

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  const fleet = getAccountFleet(params.slug);
  if (!account || firstRun.isFirstRun || !fleet || fleet.reps.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Live field map">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <LiveMapEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }
  const activeCount = fleet.reps.filter((r) => r.status === 'active').length;
  const totalKnocks = fleet.reps.reduce((s, r) => s + r.knocksToday, 0);
  const totalConv = fleet.reps.reduce((s, r) => s + r.conversionsToday, 0);
  const convRate = totalKnocks > 0 ? `${((totalConv / totalKnocks) * 100).toFixed(1)}%` : '—';

  // Detect the "between sessions" anomaly state — fleet has reps but none
  // are active. Show the LiveMapEmpty (anomaly variant) above the map so
  // operators know something's off without losing the underlying view.
  const allOffline = activeCount === 0 && totalKnocks === 0;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Live field map">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Live GPS view of every <strong>{account.shortName}</strong> knocker currently in the
            field. Pins update every 30s. Click any knocker for full shift detail — call, message,
            or send on break without leaving the map.
          </span>
        </Banner>

        {allOffline && (
          <LiveMapEmpty slug={params.slug} accountName={firstRun.accountName} placement="inline" />
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Reps in field" value={fleet.reps.length} />
          <KpiCard label="Active now" value={activeCount} />
          <KpiCard label="Knocks today" value={totalKnocks} />
          <KpiCard label="Conversions today" value={totalConv} />
          <KpiCard label="Conv rate" value={convRate} />
        </div>

        <AccountLiveMap accountSlug={params.slug} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AiNextZonesPanel zones={fleet.aiSuggestions} scopeLabel={fleet.scopeLabel} />
          <AnomaliesPanel anomalies={fleet.anomalies} scopeLabel={fleet.scopeLabel} />
          <LiveActivityFeed events={fleet.activity} scopeLabel={fleet.scopeLabel} />
        </div>

        <PushToFieldStrip
          scopeLabel={fleet.scopeLabel}
          onAction={(kind) => {
            // broadcast_message fires a real POST /api/broadcast inside the strip.
            // The other three actions are honest queue toasts — no silent click.
            toast.info(
              `${PUSH_ACTION_LABELS[kind]} queued for ${account.shortName} dispatch — wiring lands in Phase 1.2`,
            );
          }}
        />
      </div>
    </AccountShell>
  );
}
