import Link from 'next/link';
import { CheckCircle2, Activity, Globe2, Clock } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Status — Door 2 Digital',
  description: 'Live status across regions and services. Uptime, latency, and incident history.',
};

interface RegionStatus {
  code: 'US' | 'AU' | 'SG';
  name: string;
  uptime: string;
  p95: string;
}

interface ServiceStatus {
  name: string;
  category: 'core' | 'payments' | 'comms' | 'infra';
  uptime: string;
  p95: string;
  lastIncident: string;
}

interface Incident {
  id: string;
  date: string;
  title: string;
  duration: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3';
  status: 'Resolved';
  region: 'US' | 'AU' | 'SG' | 'All';
  postmortem: boolean;
}

const REGIONS: RegionStatus[] = [
  { code: 'US', name: 'United States — us-east-1', uptime: '99.98%', p95: '142ms' },
  { code: 'AU', name: 'Australia — ap-southeast-2', uptime: '99.96%', p95: '184ms' },
  { code: 'SG', name: 'Singapore — ap-southeast-1', uptime: '99.99%', p95: '129ms' },
];

const SERVICES: ServiceStatus[] = [
  {
    name: 'Core REST API',
    category: 'core',
    uptime: '99.97%',
    p95: '142ms',
    lastIncident: '38 days ago',
  },
  {
    name: 'Operator Console (web)',
    category: 'core',
    uptime: '99.99%',
    p95: '218ms',
    lastIncident: '67 days ago',
  },
  {
    name: 'Knocker iOS sync',
    category: 'core',
    uptime: '99.95%',
    p95: '276ms',
    lastIncident: '12 days ago',
  },
  {
    name: 'AI Marketing Studio',
    category: 'core',
    uptime: '99.92%',
    p95: '1.4s',
    lastIncident: '4 days ago',
  },
  {
    name: 'Audit log + chain verifier',
    category: 'core',
    uptime: '100%',
    p95: '88ms',
    lastIncident: 'No incidents 180d',
  },
  {
    name: 'MiCamp processor (US)',
    category: 'payments',
    uptime: '99.94%',
    p95: '312ms',
    lastIncident: '21 days ago',
  },
  {
    name: 'Stripe AU',
    category: 'payments',
    uptime: '99.99%',
    p95: '198ms',
    lastIncident: '54 days ago',
  },
  {
    name: 'Stripe SG',
    category: 'payments',
    uptime: '99.99%',
    p95: '174ms',
    lastIncident: '54 days ago',
  },
  {
    name: 'Twilio (SMS)',
    category: 'comms',
    uptime: '99.96%',
    p95: '892ms',
    lastIncident: '8 days ago',
  },
  {
    name: 'Resend (email)',
    category: 'comms',
    uptime: '99.98%',
    p95: '412ms',
    lastIncident: '29 days ago',
  },
  {
    name: 'Mapbox tiles',
    category: 'infra',
    uptime: '99.99%',
    p95: '64ms',
    lastIncident: '102 days ago',
  },
  {
    name: 'Ably realtime',
    category: 'infra',
    uptime: '99.97%',
    p95: '38ms',
    lastIncident: '15 days ago',
  },
  {
    name: 'AWS (us-east-1)',
    category: 'infra',
    uptime: '99.99%',
    p95: '—',
    lastIncident: '46 days ago',
  },
];

const INCIDENTS: Incident[] = [
  {
    id: 'inc-2026-05-20',
    date: '2026-05-20 14:32 UTC',
    title: 'Marketing Studio generation latency elevated',
    duration: '47 min',
    severity: 'SEV-3',
    status: 'Resolved',
    region: 'All',
    postmortem: true,
  },
  {
    id: 'inc-2026-05-12',
    date: '2026-05-12 09:14 UTC',
    title: 'Knocker iOS sync delays on Australian region',
    duration: '1h 18m',
    severity: 'SEV-2',
    status: 'Resolved',
    region: 'AU',
    postmortem: true,
  },
  {
    id: 'inc-2026-05-16',
    date: '2026-05-16 22:08 UTC',
    title: 'Twilio outbound SMS provider degradation',
    duration: '34 min',
    severity: 'SEV-3',
    status: 'Resolved',
    region: 'US',
    postmortem: false,
  },
  {
    id: 'inc-2026-05-03',
    date: '2026-05-03 11:47 UTC',
    title: 'MiCamp processor reconciliation lag',
    duration: '2h 06m',
    severity: 'SEV-2',
    status: 'Resolved',
    region: 'US',
    postmortem: true,
  },
  {
    id: 'inc-2026-04-16',
    date: '2026-04-16 03:22 UTC',
    title: 'API rate-limiter false positives on burst traffic',
    duration: '23 min',
    severity: 'SEV-3',
    status: 'Resolved',
    region: 'All',
    postmortem: true,
  },
];

function StatusDot({ tone = 'ok' }: { tone?: 'ok' | 'warn' | 'down' }): JSX.Element {
  const cls =
    tone === 'ok'
      ? 'bg-accent shadow-[0_0_0_3px_rgba(59,130,246,0.15)]'
      : tone === 'warn'
        ? 'bg-warn'
        : 'bg-danger';
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`}></span>;
}

function SevPill({ severity }: { severity: Incident['severity'] }): JSX.Element {
  const cls =
    severity === 'SEV-1'
      ? 'pill pill-danger'
      : severity === 'SEV-2'
        ? 'pill pill-warn'
        : 'pill pill-info';
  return <span className={cls}>{severity}</span>;
}

const CATEGORY_LABEL: Record<ServiceStatus['category'], string> = {
  core: 'Core platform',
  payments: 'Payments',
  comms: 'Communications',
  infra: 'Infrastructure',
};

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

            <div className="card card-pad p-8 inline-flex items-center gap-5 bg-accentSoft border border-accent/20">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-accent text-surface">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-tight">
                  All systems operational
                </h1>
                <p className="text-[13.5px] text-muted mt-1">
                  Last refreshed 38 seconds ago · Auto-refresh every 30s
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REGIONS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-1.5">
              By region
            </h2>
            <h3 className="text-2xl font-semibold text-ink tracking-tight">Regional health</h3>
          </div>
          <p className="text-[12px] text-muted">Trailing 30 days</p>
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
                <StatusDot tone="ok" />
              </div>
              <p className="text-[12.5px] text-muted">{r.name}</p>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line2">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted font-medium">
                    Uptime 30d
                  </div>
                  <div className="text-xl font-semibold text-ink mt-1 numeric">{r.uptime}</div>
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

      {/* SERVICES */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
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
                        <StatusDot tone="ok" />
                      </td>
                      <td className="px-5 py-3.5 text-[13.5px] text-ink font-medium">{s.name}</td>
                      <td className="px-5 py-3.5 text-[13px] text-ink numeric">{s.uptime}</td>
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

      {/* INCIDENT HISTORY */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-1.5">
              History
            </h2>
            <h3 className="text-2xl font-semibold text-ink tracking-tight">Past incidents</h3>
          </div>
          <p className="text-[12px] text-muted">Last 60 days · Postmortems on SEV-1/2</p>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-paper border-b border-line2">
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  When
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Severity
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Region
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Title
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Duration
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Postmortem
                </th>
              </tr>
            </thead>
            <tbody>
              {INCIDENTS.map((i) => (
                <tr key={i.id} className="border-b border-line2 last:border-b-0">
                  <td className="px-5 py-3.5 text-[12.5px] text-muted font-mono whitespace-nowrap">
                    {i.date}
                  </td>
                  <td className="px-5 py-3.5">
                    <SevPill severity={i.severity} />
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-ink">{i.region}</td>
                  <td className="px-5 py-3.5 text-[13px] text-ink">{i.title}</td>
                  <td className="px-5 py-3.5 text-[12.5px] text-muted numeric">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {i.duration}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px]">
                    {i.postmortem ? (
                      <a href="#" className="text-accent hover:underline">
                        Read postmortem
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SUBSCRIBE */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="card card-pad p-10 max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-semibold text-ink tracking-tight">
              Subscribe to incident updates
            </h3>
            <p className="mt-3 text-[14px] text-muted leading-relaxed">
              Email or RSS — we&apos;ll alert you when we open, update or resolve incidents in the
              regions you operate in.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:status-subscribe@door2digital.io"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition"
              >
                Email subscribe
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3 rounded-md border border-line hover:bg-paper transition"
              >
                RSS feed
              </a>
              <Link
                href="/public/security"
                className="inline-flex items-center justify-center gap-2 text-muted text-[14px] font-medium px-5 py-3 rounded-md hover:text-ink transition"
              >
                Security posture
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
