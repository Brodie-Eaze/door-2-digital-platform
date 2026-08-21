'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Server,
  Cpu,
  Webhook,
  Database,
  Zap,
  Map,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Section, StatusPill, KpiCard, Banner } from '@d2d/ui-web';
import type { Tone } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import type { RealtimeMetrics } from '@/app/api/metrics/realtime/route';

type ServiceStatus = 'operational' | 'degraded' | 'down';

interface ServiceRow {
  name: string;
  icon: typeof Server;
  status: ServiceStatus;
  latency: string;
  uptime: string;
  note: string;
}

const STATUS_META: Record<ServiceStatus, { tone: Tone; label: string }> = {
  operational: { tone: 'success', label: 'operational' },
  degraded: { tone: 'warn', label: 'degraded' },
  down: { tone: 'danger', label: 'down' },
};

// Demo data — live wiring lands in Phase 1.x (per-service health probes).
const SERVICES: ServiceRow[] = [
  {
    name: 'API (Next.js)',
    icon: Server,
    status: 'operational',
    latency: '74 ms p95',
    uptime: '99.98%',
    note: 'edge + node runtimes healthy',
  },
  {
    name: 'Background workers',
    icon: Cpu,
    status: 'operational',
    latency: '12 jobs/min',
    uptime: '99.95%',
    note: 'queue depth 4 · no stuck jobs',
  },
  {
    name: 'Webhooks',
    icon: Webhook,
    status: 'degraded',
    latency: '310 ms p95',
    uptime: '99.40%',
    note: '2 deliveries in DLQ — MiCamp endpoint slow',
  },
  {
    name: 'Database (Postgres)',
    icon: Database,
    status: 'operational',
    latency: '6 ms p95',
    uptime: '99.99%',
    note: 'pool 18/40 · replica lag 80 ms',
  },
  {
    name: 'Redis (cache/queue)',
    icon: Zap,
    status: 'operational',
    latency: '0.8 ms p95',
    uptime: '99.97%',
    note: 'mem 41% · evictions 0',
  },
  {
    name: 'Mapbox (geocode/tiles)',
    icon: Map,
    status: 'operational',
    latency: '120 ms p95',
    uptime: '99.90%',
    note: 'quota 38% of monthly',
  },
  {
    name: 'MiCamp Gateway',
    icon: CreditCard,
    status: 'degraded',
    latency: '880 ms p95',
    uptime: '98.70%',
    note: 'sandbox — elevated latency, retries holding',
  },
];

interface Incident {
  id: string;
  severity: ServiceStatus;
  title: string;
  detail: string;
  when: string;
  resolved: boolean;
}

const INCIDENTS: Incident[] = [
  {
    id: 'inc_03',
    severity: 'degraded',
    title: 'Webhook delivery latency to MiCamp',
    detail: 'p95 climbed to 310 ms; 2 deliveries parked in DLQ. Auto-retry with backoff in progress.',
    when: 'ongoing · 14 min',
    resolved: false,
  },
  {
    id: 'inc_02',
    severity: 'operational',
    title: 'Redis failover completed',
    detail: 'Primary node replaced during maintenance window. Zero dropped jobs, 40s read-only blip.',
    when: '2026-06-12 02:10 UTC',
    resolved: true,
  },
  {
    id: 'inc_01',
    severity: 'operational',
    title: 'Mapbox geocode timeouts',
    detail: 'Upstream returned 5xx for ~6 min. Fell back to cached tiles; geocode queued and drained.',
    when: '2026-06-09 18:42 UTC',
    resolved: true,
  },
];

export default function HealthPage(): JSX.Element {
  const { source, updatedAt, markFresh, markFixture } = useDataFreshness('fixture');
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  const poll = useCallback(async (announce = false): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/metrics/realtime', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as RealtimeMetrics;
      if (!mounted.current) return;
      setMetrics(data);
      markFresh();
      if (announce) toast.success('Realtime tile refreshed from live API');
    } catch {
      if (!mounted.current) return;
      markFixture();
      if (announce) toast.info('Live API unreachable — showing demo fallback');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [markFresh, markFixture]);

  useEffect(() => {
    mounted.current = true;
    void poll(false);
    const interval = setInterval(() => void poll(false), 30_000);
    return (): void => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [poll]);

  const degraded = SERVICES.filter((s) => s.status === 'degraded').length;
  const down = SERVICES.filter((s) => s.status === 'down').length;
  const operational = SERVICES.length - degraded - down;
  const overallTone: Tone = down > 0 ? 'danger' : degraded > 0 ? 'warn' : 'success';
  const overallLabel = down > 0 ? 'Partial outage' : degraded > 0 ? 'Degraded' : 'All systems operational';

  const activeReps = metrics?.activeReps;

  return (
    <OperatorShell pageTitle="System health">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone={overallTone}>
          <span className="text-[13px] flex items-center gap-2">
            {down > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            <span className="font-semibold">{overallLabel}</span> · {operational} operational,{' '}
            {degraded} degraded, {down} down.{' '}
            <span className="text-muted">
              Service tiles are demo data — the &quot;Active reps&quot; tile fetches the live{' '}
              <code className="kbd">/api/metrics/realtime</code> endpoint.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Active reps (live)"
            value={activeReps ?? '—'}
            hint={source === 'live' ? 'from realtime API' : 'demo fallback'}
            deltaTone={source === 'live' ? 'positive' : 'neutral'}
          />
          <KpiCard label="Services operational" value={`${operational} / ${SERVICES.length}`} />
          <KpiCard
            label="Degraded"
            value={degraded}
            delta={degraded > 0 ? 'watching' : 'none'}
            deltaTone={degraded > 0 ? 'negative' : 'positive'}
          />
          <KpiCard label="Error budget (30d)" value="92%" hint="SLO 99.9%" />
        </div>

        <Section
          title="Services"
          subtitle="Per-service status, latency, and uptime"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source={source} updatedAt={updatedAt} />
              <button
                type="button"
                onClick={() => void poll(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          }
        >
          <ul className="divide-y divide-line2">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              const meta = STATUS_META[s.status];
              return (
                <li key={s.name} className="px-5 py-3.5 flex items-center gap-3.5">
                  <span
                    className={`shrink-0 grid place-items-center w-8 h-8 rounded-lg ${
                      s.status === 'operational'
                        ? 'bg-successSoft text-success'
                        : s.status === 'degraded'
                          ? 'bg-warnSoft text-warn'
                          : 'bg-dangerSoft text-danger'
                    }`}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">{s.name}</span>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </div>
                    <p className="text-[12px] text-soft mt-0.5">{s.note}</p>
                  </div>
                  <div className="shrink-0 text-right hidden sm:block">
                    <div className="numeric text-[12.5px] text-ink">{s.latency}</div>
                    <div className="text-[11px] text-soft">uptime {s.uptime}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="SLO targets" subtitle="Service-level objectives this window">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'API availability', value: '99.98%', target: '99.9%', ok: true },
                { label: 'API latency p95', value: '74 ms', target: '< 200 ms', ok: true },
                { label: 'Webhook success', value: '99.4%', target: '99.5%', ok: false },
                { label: 'Job success', value: '99.95%', target: '99.9%', ok: true },
              ].map((slo) => (
                <div key={slo.label} className="rounded-lg border border-line2 p-3.5">
                  <div className="text-[11px] text-muted">{slo.label}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`numeric text-[18px] font-semibold ${slo.ok ? 'text-ink' : 'text-warn'}`}
                    >
                      {slo.value}
                    </span>
                    <span className="text-[11px] text-soft">target {slo.target}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Recent incidents"
            subtitle="Last 7 days"
            paddedBody={false}
            action={
              <button
                type="button"
                onClick={() => toast.info('Full incident timeline lands in Phase 1.x')}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                View all
              </button>
            }
          >
            <ul className="divide-y divide-line2">
              {INCIDENTS.map((inc) => (
                <li key={inc.id} className="px-5 py-3.5 flex items-start gap-3">
                  <span
                    className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                      inc.resolved
                        ? 'bg-emerald-500'
                        : inc.severity === 'degraded'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-ink">{inc.title}</span>
                      <StatusPill tone={inc.resolved ? 'muted' : STATUS_META[inc.severity].tone}>
                        {inc.resolved ? 'resolved' : 'active'}
                      </StatusPill>
                    </div>
                    <p className="text-[12px] text-muted mt-0.5 leading-relaxed">{inc.detail}</p>
                    <div className="text-[11px] text-soft mt-1">{inc.when}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </OperatorShell>
  );
}
