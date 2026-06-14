'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  ShieldAlert,
  WifiOff,
  TrendingDown,
  Activity,
  Check,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { Banner, Section, StatusPill, KpiCard, FilterChip, FilterChipStrip } from '@d2d/ui-web';
import type { Tone } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

type Severity = 'critical' | 'warning' | 'info';
type AlertKind = 'dnc' | 'offline' | 'territory' | 'anomaly' | 'compliance';

interface AlertRow {
  id: string;
  severity: Severity;
  kind: AlertKind;
  title: string;
  detail: string;
  org: string;
  source: string;
  timestamp: string;
}

const KIND_META: Record<AlertKind, { label: string; icon: typeof Bell }> = {
  dnc: { label: 'DNC violation', icon: ShieldAlert },
  offline: { label: 'Knocker offline', icon: WifiOff },
  territory: { label: 'Low-converting territory', icon: TrendingDown },
  anomaly: { label: 'Anomaly', icon: Activity },
  compliance: { label: 'Compliance', icon: ShieldAlert },
};

const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'danger',
  warning: 'warn',
  info: 'info',
};

// Demo data — live wiring lands in Phase 1.4 (AlertEvent table + webhook fan-in).
const ALERTS: AlertRow[] = [
  {
    id: 'al_dnc_01',
    severity: 'critical',
    kind: 'dnc',
    title: 'Knock logged at a Do-Not-Knock address',
    detail:
      'Rep Devon R. captured a knock at 114 Cedar Ln (flagged do_not_knock on 2026-05-30). Auto-voided server-side; rep notified. Review required for repeat offender.',
    org: 'Hope Forward International',
    source: 'mobile · knock-capture',
    timestamp: '4 min ago',
  },
  {
    id: 'al_off_01',
    severity: 'critical',
    kind: 'offline',
    title: 'Active rep offline > 45 min mid-shift',
    detail:
      'Marcus L. last ping 09:07, shift open, no end-shift event. Houston SE territory now uncovered. Safety check recommended.',
    org: 'Hope Forward International',
    source: 'KnockSession heartbeat',
    timestamp: '12 min ago',
  },
  {
    id: 'al_terr_01',
    severity: 'warning',
    kind: 'territory',
    title: 'Territory conversion 3.1% — below 8% floor',
    detail:
      'Plano 75024 has logged 64 knocks today at 3.1% conversion vs 11% account average. Propensity engine suggests reassigning 1 rep to Austin South.',
    org: 'PestMax Services',
    source: 'propensity engine',
    timestamp: '38 min ago',
  },
  {
    id: 'al_anom_01',
    severity: 'warning',
    kind: 'anomaly',
    title: 'Knock volume spike — 2.4x baseline',
    detail:
      'SunHaven Solar logged 220 knocks in the last hour vs ~90 baseline. Possible duplicate capture or GPS spoof. Flagged for data-quality review.',
    org: 'SunHaven Solar',
    source: 'anomaly detector',
    timestamp: '1 hr ago',
  },
  {
    id: 'al_comp_01',
    severity: 'warning',
    kind: 'compliance',
    title: 'Campaign targeting an uncleared state (IL)',
    detail:
      'A draft campaign includes IL ZIPs. Paid-solicitor registration for IL is still pending (ETA week 7). Delivery blocked server-side; remove IL or hold.',
    org: 'Hope Forward International',
    source: 'CampaignStateClearance',
    timestamp: '2 hr ago',
  },
  {
    id: 'al_info_01',
    severity: 'info',
    kind: 'anomaly',
    title: 'Webhook retry succeeded after backoff',
    detail:
      'MiCamp settlement webhook delivery for batch B-2291 recovered on the 3rd retry. No action needed — logged for visibility.',
    org: 'Platform',
    source: 'webhook delivery',
    timestamp: '3 hr ago',
  },
];

const SEVERITY_FILTERS: { key: Severity | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'warning', label: 'Warning' },
  { key: 'info', label: 'Info' },
];

export default function AlertsPage(): JSX.Element {
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [showAcked, setShowAcked] = useState(false);

  const counts = useMemo(() => {
    const open = ALERTS.filter((a) => !acked.has(a.id));
    return {
      critical: open.filter((a) => a.severity === 'critical').length,
      warning: open.filter((a) => a.severity === 'warning').length,
      info: open.filter((a) => a.severity === 'info').length,
      open: open.length,
      acked: acked.size,
    };
  }, [acked]);

  const visible = useMemo(() => {
    return ALERTS.filter((a) => {
      if (!showAcked && acked.has(a.id)) return false;
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      return true;
    });
  }, [acked, severityFilter, showAcked]);

  function acknowledge(a: AlertRow): void {
    setAcked((prev) => {
      const next = new Set(prev);
      next.add(a.id);
      return next;
    });
    toast.success(`Acknowledged · ${a.title}`);
  }

  function acknowledgeAll(): void {
    const open = ALERTS.filter((a) => !acked.has(a.id));
    if (open.length === 0) {
      toast.info('No open alerts to acknowledge');
      return;
    }
    setAcked(new Set(ALERTS.map((a) => a.id)));
    toast.success(`Acknowledged all ${open.length} open alert${open.length === 1 ? '' : 's'}`);
  }

  return (
    <OperatorShell pageTitle="Alerts">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Bell size={14} />
            Cross-account alert feed — DNC violations, offline knockers, low-converting territories,
            and anomalies surface here in real time.{' '}
            <span className="text-muted">Demo data — live wiring lands in Phase 1.4.</span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Open alerts" value={counts.open} hint="across all accounts" />
          <KpiCard
            label="Critical"
            value={counts.critical}
            delta={counts.critical > 0 ? 'needs action' : 'clear'}
            deltaTone={counts.critical > 0 ? 'negative' : 'positive'}
          />
          <KpiCard label="Warning" value={counts.warning} hint="review when free" />
          <KpiCard label="Acknowledged" value={counts.acked} hint="this session" />
        </div>

        <Section
          title="Alert feed"
          subtitle="Severity-tagged events from field ops, compliance, and the anomaly detector"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <button
                type="button"
                onClick={acknowledgeAll}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors"
              >
                <CheckCheck size={13} />
                Ack all
              </button>
            </div>
          }
        >
          <div className="px-5 pt-4 pb-3 border-b border-line2 flex items-center justify-between gap-3 flex-wrap">
            <FilterChipStrip label="Severity">
              {SEVERITY_FILTERS.map((f) => (
                <FilterChip
                  key={f.key}
                  active={severityFilter === f.key}
                  onClick={() => setSeverityFilter(f.key)}
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterChipStrip>
            <button
              type="button"
              onClick={() => setShowAcked((s) => !s)}
              aria-pressed={showAcked}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-paper text-muted hover:text-ink border border-line2 transition-colors"
            >
              <Filter size={11} />
              {showAcked ? 'Showing acknowledged' : 'Show acknowledged'}
            </button>
          </div>

          <ul className="divide-y divide-line2">
            {visible.length === 0 && (
              <li className="px-5 py-10 text-center text-[13px] text-muted">
                No alerts match the current filter.
              </li>
            )}
            {visible.map((a) => {
              const meta = KIND_META[a.kind];
              const Icon = meta.icon;
              const isAcked = acked.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`px-5 py-4 flex items-start gap-3.5 ${isAcked ? 'opacity-55' : ''}`}
                >
                  <span
                    className={`mt-0.5 shrink-0 grid place-items-center w-8 h-8 rounded-lg ${
                      a.severity === 'critical'
                        ? 'bg-dangerSoft text-danger'
                        : a.severity === 'warning'
                          ? 'bg-warnSoft text-warn'
                          : 'bg-accentSoft text-accent'
                    }`}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold text-ink">{a.title}</span>
                      <StatusPill tone={SEVERITY_TONE[a.severity]}>{a.severity}</StatusPill>
                      <span className="text-[11px] text-soft uppercase tracking-wider">
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{a.detail}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-soft">
                      <span className="font-medium text-ink2">{a.org}</span>
                      <span>·</span>
                      <span className="mono">{a.source}</span>
                      <span>·</span>
                      <span>{a.timestamp}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isAcked ? (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-emerald-600 font-medium">
                        <Check size={13} />
                        Acked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => acknowledge(a)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium bg-ink text-surface hover:bg-ink2 transition-colors"
                      >
                        <Check size={13} />
                        Acknowledge
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </OperatorShell>
  );
}
