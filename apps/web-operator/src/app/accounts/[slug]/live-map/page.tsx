'use client';

import { use, useEffect, useRef, useState } from 'react';

import { Banner, KpiCard } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import { LiveMapEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { useAccountMeta, prettifySlug } from '@/lib/use-account-meta';
import type { ApiFleetEntry } from '@/lib/fleet';
import {
  AiNextZonesPanel,
  AnomaliesPanel,
  LiveActivityFeed,
  PushToFieldStrip,
} from '@/components/field-ops';
import type {
  AiZoneSuggestion,
  AnomalyItem,
  ActivityEvent,
  PushToFieldAction,
} from '@/components/field-ops/types';
import { toast } from '@/components/Toaster';
import { firstRunSnapshot } from '@/lib/first-run';

/** Human labels for the push-to-field actions, used in the honest queue toasts. */
const PUSH_ACTION_LABELS: Record<PushToFieldAction, string> = {
  broadcast_message: 'Broadcast message',
  update_pitch_script: 'Pitch script update',
  reassign_territories: 'Territory reassignment',
  end_shift_early: 'End-shift instruction',
};

// No backing AI-zone-suggestion or anomaly-detection model exists yet for
// per-account scoring (see schema.prisma) — honest empty states until those
// services land, same treatment as the HQ command-centre.
const NO_AI_SUGGESTIONS: AiZoneSuggestion[] = [];
const NO_ANOMALIES: AnomalyItem[] = [];
const NO_ACTIVITY: ActivityEvent[] = [];

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const meta = useAccountMeta(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  const accountName = meta?.name ?? prettifySlug(params.slug);
  const accountRegion = meta?.region ?? '—';

  // Live fleet — polled from /api/orgs/[slug]/fleet (real KnockSession +
  // Knock.geo, see that route). `fleetLoaded` gates the empty state so a
  // fleet that's simply mid-poll never flashes "all offline" before the
  // first response lands.
  const [fleet, setFleet] = useState<ApiFleetEntry[]>([]);
  const [fleetLoaded, setFleetLoaded] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchFleet(): Promise<void> {
      if (inFlight.current || document.visibilityState === 'hidden') return;
      inFlight.current = true;
      try {
        const res = await fetch(`/api/orgs/${params.slug}/fleet`);
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { fleet?: ApiFleetEntry[] };
          if (Array.isArray(data.fleet)) setFleet(data.fleet);
        }
      } catch {
        // Network failure — keep current state; next poll retries.
      } finally {
        inFlight.current = false;
        setFleetLoaded(true);
      }
    }

    void fetchFleet();
    const interval = setInterval(() => void fetchFleet(), 30_000);
    return (): void => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  if (fleetLoaded && fleet.length === 0) {
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

  const activeCount = fleet.filter((r) => r.status === 'active').length;
  const totalKnocks = fleet.reduce((s, r) => s + r.knocksToday, 0);

  // Detect the "between sessions" anomaly state — fleet has reps but none
  // are active. Show the LiveMapEmpty (anomaly variant) above the map so
  // operators know something's off without losing the underlying view.
  const allOffline = fleetLoaded && activeCount === 0 && totalKnocks === 0;

  const scopeLabel = `${accountName} · ${accountRegion}`;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Live field map">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Live GPS view of every <strong>{accountName}</strong> knocker currently in the field.
            Positions refresh every 30s by poll — live tracking activates when realtime is
            configured. Click any knocker for full shift detail — call, message, or send on break
            without leaving the map.
          </span>
        </Banner>

        {allOffline && (
          <LiveMapEmpty slug={params.slug} accountName={firstRun.accountName} placement="inline" />
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Reps in field" value={fleet.length} />
          <KpiCard label="Active now" value={activeCount} />
          <KpiCard label="Knocks today" value={totalKnocks} />
        </div>

        <AccountLiveMap accountSlug={params.slug} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AiNextZonesPanel zones={NO_AI_SUGGESTIONS} scopeLabel={scopeLabel} />
          <AnomaliesPanel anomalies={NO_ANOMALIES} scopeLabel={scopeLabel} />
          <LiveActivityFeed events={NO_ACTIVITY} scopeLabel={scopeLabel} />
        </div>

        <PushToFieldStrip
          scopeLabel={scopeLabel}
          onAction={(kind) => {
            // broadcast_message fires a real POST /api/broadcast inside the strip.
            // The other three actions are honest queue toasts — no silent click.
            toast.info(
              `${PUSH_ACTION_LABELS[kind]} queued for ${accountName} dispatch — wiring lands in Phase 1.2`,
            );
          }}
        />
      </div>
    </AccountShell>
  );
}
