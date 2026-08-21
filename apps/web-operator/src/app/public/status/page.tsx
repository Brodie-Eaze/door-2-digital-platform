import Link from 'next/link';
import { CheckCircle2, Activity, Globe2, Mail, ShieldCheck } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { SubscribeForm } from './SubscribeForm';

export const metadata = {
  title: 'Status — Door 2 Digital',
  description:
    'Live status across regions and services — per-region uptime, per-service health, and a 30-day incident ribbon.',
};

/**
 * Status page data shape — mirrors what Phase 1.3 will return from the
 * real aggregator. Today: hardcoded but realistic fixtures so the page is
 * believable without lying about coverage. The shape is the contract the
 * /v1/health aggregator will satisfy.
 */
interface RegionStatus {
  code: 'US' | 'AU' | 'SG';
  name: string;
  uptime30d: string;
  p95: string;
}

type ServiceTone = 'ok' | 'warn' | 'down';

interface ServiceStatus {
  name: string;
  category: 'core' | 'payments' | 'comms' | 'infra';
  tone: ServiceTone;
  statusLabel: string;
  uptime30d: string;
  p95: string;
  lastIncident: string;
}

interface IncidentBar {
  /** ISO day, e.g. 2026-05-12. */
  day: string;
  tone: ServiceTone;
  /** Tooltip body shown on hover; null for green days. */
  detail: string | null;
}

// Phase 1.3: wire to /v1/health aggregator + incident timeline.
const REGIONS: RegionStatus[] = [
  { code: 'US', name: 'United States — us-east-1 (Virginia)', uptime30d: '99.97%', p95: '142ms' },
  { code: 'AU', name: 'Australia — ap-southeast-2 (Sydney)', uptime30d: '99.96%', p95: '184ms' },
  { code: 'SG', name: 'Singapore — ap-southeast-1', uptime30d: '99.99%', p95: '129ms' },
];

// Phase 1.3: each row will come from a per-service probe (Twilio status.json,
// Stripe status.io, Mapbox status, MiCamp status, Esri tile fetch latency,
// Ably stats, backend /v1/healthz roundtrip).
const SERVICES: ServiceStatus[] = [
  // Core
  {
    name: 'Core REST API',
    category: 'core',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.97%',
    p95: '142ms',
    lastIncident: '38d ago',
  },
  {
    name: 'Database (Aurora Postgres)',
    category: 'core',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.99%',
    p95: '12ms',
    lastIncident: 'No incidents 180d',
  },
  {
    name: 'Knocker iOS sync',
    category: 'core',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.95%',
    p95: '276ms',
    lastIncident: '12d ago',
  },
  // Payments
  {
    name: 'MiCamp processor (US)',
    category: 'payments',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.94%',
    p95: '312ms',
    lastIncident: '21d ago',
  },
  {
    name: 'Stripe AU',
    category: 'payments',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.99%',
    p95: '198ms',
    lastIncident: '54d ago',
  },
  {
    name: 'Stripe SG',
    category: 'payments',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.99%',
    p95: '174ms',
    lastIncident: '54d ago',
  },
  // Comms
  {
    name: 'Twilio (SMS)',
    category: 'comms',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.96%',
    p95: '892ms',
    lastIncident: '8d ago',
  },
  {
    name: 'Resend (email)',
    category: 'comms',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.98%',
    p95: '412ms',
    lastIncident: '29d ago',
  },
  // Infra
  {
    name: 'Mapbox tiles',
    category: 'infra',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.99%',
    p95: '64ms',
    lastIncident: '102d ago',
  },
  {
    name: 'Esri tiles',
    category: 'infra',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.98%',
    p95: '88ms',
    lastIncident: '76d ago',
  },
  {
    name: 'Ably realtime',
    category: 'infra',
    tone: 'ok',
    statusLabel: 'Operational',
    uptime30d: '99.97%',
    p95: '38ms',
    lastIncident: '15d ago',
  },
];

/**
 * 30-day incident ribbon fixture. Two real-ish past incidents painted in,
 * the rest green. Phase 1.3: generate from `audit_event` + `incident` tables
 * with bucket-per-day rollups.
 */
function buildRibbon(): IncidentBar[] {
  const today = new Date('2026-05-27T00:00:00Z');
  const bars: IncidentBar[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    bars.push({ day: iso, tone: 'ok', detail: null });
  }
  // 2026-05-12 — Knocker iOS sync delays (AU)
  const may12 = bars.find((b) => b.day === '2026-05-12');
  if (may12) {
    may12.tone = 'warn';
    may12.detail = '2026-05-12 · partial outage · 12 min · root cause: webhook DLQ backpressure';
  }
  // 2026-05-20 — Marketing Studio latency
  const may20 = bars.find((b) => b.day === '2026-05-20');
  if (may20) {
    may20.tone = 'warn';
    may20.detail =
      '2026-05-20 · degraded performance · 47 min · root cause: AI Marketing Studio queue saturation';
  }
  // 2026-05-03 — MiCamp reconciliation lag
  const may03 = bars.find((b) => b.day === '2026-05-03');
  if (may03) {
    may03.tone = 'warn';
    may03.detail = '2026-05-03 · reconciliation lag · 2h 06m · root cause: MiCamp upstream timeout';
  }
  return bars;
}

const RIBBON: IncidentBar[] = buildRibbon();

const CATEGORY_LABEL: Record<ServiceStatus['category'], string> = {
  core: 'Core platform',
  payments: 'Payments',
  comms: 'Communications',
  infra: 'Infrastructure',
};

function StatusDot({
  tone,
  pulse = false,
  size = 'sm',
}: {
  tone: ServiceTone;
  pulse?: boolean;
  size?: 'sm' | 'md';
}): JSX.Element {
  const color =
    tone === 'ok'
      ? 'bg-success text-success'
      : tone === 'warn'
        ? 'bg-warn text-warn'
        : 'bg-danger text-danger';
  const dim = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  return (
    <span
      className={`relative inline-flex items-center justify-center ${dim} rounded-full ${color.split(' ')[0]} ${
        pulse ? 'd2d-status-pulse-halo' : ''
      }`}
      style={{ color: 'currentColor' }}
    />
  );
}

function StatusPill({ tone, label }: { tone: ServiceTone; label: string }): JSX.Element {
  const cls =
    tone === 'ok' ? 'pill pill-success' : tone === 'warn' ? 'pill pill-warn' : 'pill pill-danger';
  return <span className={cls}>{label}</span>;
}

function IncidentRibbon({ bars }: { bars: IncidentBar[] }): JSX.Element {
  return (
    <div className="card card-pad p-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-1.5">
            Last 30 days
          </h2>
          <h3 className="text-[17px] font-semibold text-ink tracking-tight">Incident ribbon</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-success" /> Operational
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-warn" /> Degraded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-danger" /> Outage
          </span>
        </div>
      </div>
      <div className="flex items-end gap-[3px] h-12">
        {bars.map((bar) => {
          const color =
            bar.tone === 'ok' ? 'bg-success/80' : bar.tone === 'warn' ? 'bg-warn' : 'bg-danger';
          return (
            <div
              key={bar.day}
              className={`flex-1 rounded-sm ${color} hover:scale-y-110 transition-transform origin-bottom relative group cursor-default`}
              style={{ height: '100%' }}
              title={bar.detail ?? `${bar.day} · operational`}
            >
              {bar.detail && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-ink text-surface text-[11px] px-2.5 py-1.5 rounded-md shadow-lg z-10 pointer-events-none">
                  {bar.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
        <span>{bars[0]?.day}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function PublicStatusPage(): JSX.Element {
  const byCategory = SERVICES.reduce<Record<string, ServiceStatus[]>>((acc, s) => {
    const bucket = acc[s.category] ?? [];
    bucket.push(s);
    acc[s.category] = bucket;
    return acc;
  }, {});

  return (
    <PublicShell activeNav="home">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              <Activity className="h-3 w-3" />
              Status
            </div>
            <div className="card card-pad p-8 inline-flex items-center gap-5 bg-successSoft border border-success/20">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success text-surface">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-tight">
                  All systems operational
                </h1>
                <p className="text-[13.5px] text-muted mt-1">
                  Demo data — live /v1/health aggregator wiring lands in Phase 1.3
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REGIONS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-1.5">
              By region
            </h2>
            <h3 className="text-2xl font-semibold text-ink tracking-tight">Regional health</h3>
          </div>
          <p className="text-[12px] text-muted">Trailing 30 days · region-pinned (ADR-0016)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REGIONS.map((r) => (
            <div key={r.code} className="card card-pad p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accentSoft text-accent">
                    <Globe2 className="h-4 w-4" />
                  </span>
                  <span className="text-[15px] font-semibold text-ink tracking-tight">
                    {r.code}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 text-success">
                  <StatusDot tone="ok" pulse />
                  <span className="text-[11.5px] font-medium uppercase tracking-wider">
                    Operational
                  </span>
                </div>
              </div>
              <p className="text-[12.5px] text-muted">{r.name}</p>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line2">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted font-medium">
                    Uptime 30d
                  </div>
                  <div className="text-xl font-semibold text-ink mt-1 numeric">{r.uptime30d}</div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted font-medium">
                    P95 latency
                  </div>
                  <div className="text-xl font-semibold text-ink mt-1 numeric">{r.p95}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INCIDENT RIBBON */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-6">
        <IncidentRibbon bars={RIBBON} />
      </section>

      {/* SERVICES */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-1.5">
              By service
            </h2>
            <h3 className="text-2xl font-semibold text-ink tracking-tight">Service health</h3>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(byCategory).map(([cat, services]) => (
            <div key={cat} className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-line2 bg-paper/50">
                <h4 className="text-[12px] uppercase tracking-[0.12em] text-muted font-semibold">
                  {CATEGORY_LABEL[cat as ServiceStatus['category']]}
                </h4>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-paper/30">
                    <th className="text-left px-5 py-2.5 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium w-10"></th>
                    <th className="text-left px-5 py-2.5 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                      Service
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                      Status
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                      Uptime 30d
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                      P95
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                      Last incident
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.name} className="border-b border-line2 last:border-b-0">
                      <td className="px-5 py-3.5">
                        <StatusDot tone={s.tone} pulse />
                      </td>
                      <td className="px-5 py-3.5 text-[13.5px] text-ink font-medium">{s.name}</td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={s.tone} label={s.statusLabel} />
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-ink numeric">{s.uptime30d}</td>
                      <td className="px-5 py-3.5 text-[13px] text-muted numeric">{s.p95}</td>
                      <td className="px-5 py-3.5 text-[12.5px] text-muted">{s.lastIncident}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* SUBSCRIBE BANNER */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="card card-pad p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent shrink-0">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-ink tracking-tight">
                  Get incident notifications
                </h3>
                <p className="text-[13px] text-muted mt-1">
                  Email or RSS — we&apos;ll alert you when we open, update or resolve incidents in
                  the regions you operate in.
                </p>
              </div>
            </div>
            <SubscribeForm />
          </div>
        </div>
      </section>

      {/* POWERED BY */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-muted">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              <span>
                Powered by D2D Reliability ·{' '}
                <Link href="/public/security" className="text-ink hover:text-accent transition">
                  See our security posture
                </Link>
              </span>
            </div>
            <Link href="/public/changelog" className="text-ink hover:text-accent transition">
              What changed this month →
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
