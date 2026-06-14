'use client';

import { useState } from 'react';
import {
  Plus,
  Edit3,
  Copy,
  Eye,
  ExternalLink,
  Filter,
  Search,
  QrCode,
  Globe,
  Smartphone,
  ArrowUpRight,
} from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FormsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

interface FormDef {
  id: string;
  name: string;
  category: string;
  fields: number;
  submissions: number;
  lastSubmission: string;
  conversion: number;
  status: 'live' | 'draft' | 'paused';
  source: 'web' | 'qr' | 'door' | 'embedded';
}

interface Submission {
  id: string;
  formName: string;
  contact: string;
  fieldsFilled: number;
  totalFields: number;
  capturedAt: string;
  source: 'web' | 'qr' | 'door' | 'embedded';
  amountCents?: bigint;
}

function buildForms(slug: string): FormDef[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  if (isCharity) {
    return [
      {
        id: 'f1',
        name: 'Monthly giving signup',
        category: 'Donation',
        fields: 9,
        submissions: 4831,
        lastSubmission: '8m ago',
        conversion: 32.1,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f2',
        name: 'One-off donation',
        category: 'Donation',
        fields: 6,
        submissions: 2104,
        lastSubmission: '21m ago',
        conversion: 28.4,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f3',
        name: 'Volunteer signup',
        category: 'Volunteer',
        fields: 12,
        submissions: 318,
        lastSubmission: '2h ago',
        conversion: 18.9,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f4',
        name: 'Door-knock pledge card',
        category: 'Field capture',
        fields: 8,
        submissions: 1208,
        lastSubmission: '4m ago',
        conversion: 41.2,
        status: 'live',
        source: 'door',
      },
      {
        id: 'f5',
        name: 'Major-donor brief request',
        category: 'High-touch',
        fields: 7,
        submissions: 64,
        lastSubmission: '1d ago',
        conversion: 22.5,
        status: 'live',
        source: 'embedded',
      },
      {
        id: 'f6',
        name: 'Newsletter signup',
        category: 'Top of funnel',
        fields: 3,
        submissions: 11420,
        lastSubmission: '1m ago',
        conversion: 56.3,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f7',
        name: 'Event registration · Gala 2026',
        category: 'Events',
        fields: 11,
        submissions: 184,
        lastSubmission: '5h ago',
        conversion: 24.8,
        status: 'live',
        source: 'qr',
      },
      {
        id: 'f8',
        name: 'Legacy giving inquiry (draft)',
        category: 'Planned giving',
        fields: 14,
        submissions: 0,
        lastSubmission: 'never',
        conversion: 0,
        status: 'draft',
        source: 'web',
      },
    ];
  }

  if (isHealth) {
    return [
      {
        id: 'f1',
        name: 'Capital campaign pledge',
        category: 'Pledge',
        fields: 11,
        submissions: 89,
        lastSubmission: '1h ago',
        conversion: 31.2,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f2',
        name: 'Bequest declaration',
        category: 'Planned giving',
        fields: 14,
        submissions: 18,
        lastSubmission: '2d ago',
        conversion: 12.4,
        status: 'live',
        source: 'embedded',
      },
      {
        id: 'f3',
        name: 'Patient family registration',
        category: 'Engagement',
        fields: 9,
        submissions: 412,
        lastSubmission: '12m ago',
        conversion: 38.1,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f4',
        name: 'Hospital tour booking',
        category: 'Donor stewardship',
        fields: 7,
        submissions: 64,
        lastSubmission: '4h ago',
        conversion: 22.9,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f5',
        name: 'Volunteer credentialing',
        category: 'Volunteer',
        fields: 16,
        submissions: 128,
        lastSubmission: '1d ago',
        conversion: 14.2,
        status: 'live',
        source: 'web',
      },
      {
        id: 'f6',
        name: 'Naming-rights inquiry (draft)',
        category: 'High-touch',
        fields: 8,
        submissions: 0,
        lastSubmission: 'never',
        conversion: 0,
        status: 'draft',
        source: 'embedded',
      },
    ];
  }

  return [
    {
      id: 'f1',
      name: 'Service quote request',
      category: 'Lead capture',
      fields: 9,
      submissions: 1208,
      lastSubmission: '6m ago',
      conversion: 38.1,
      status: 'live',
      source: 'web',
    },
    {
      id: 'f2',
      name: 'Door-knock work order',
      category: 'Field capture',
      fields: 7,
      submissions: 824,
      lastSubmission: '3m ago',
      conversion: 44.8,
      status: 'live',
      source: 'door',
    },
    {
      id: 'f3',
      name: 'Annual contract renewal',
      category: 'Retention',
      fields: 11,
      submissions: 312,
      lastSubmission: '1h ago',
      conversion: 62.1,
      status: 'live',
      source: 'embedded',
    },
    {
      id: 'f4',
      name: 'Pest inspection booking',
      category: 'Scheduling',
      fields: 8,
      submissions: 612,
      lastSubmission: '24m ago',
      conversion: 41.4,
      status: 'live',
      source: 'qr',
    },
    {
      id: 'f5',
      name: 'Service callback',
      category: 'Support',
      fields: 5,
      submissions: 188,
      lastSubmission: '2h ago',
      conversion: 28.9,
      status: 'live',
      source: 'web',
    },
    {
      id: 'f6',
      name: 'Commercial RFP',
      category: 'High-value',
      fields: 18,
      submissions: 42,
      lastSubmission: '1d ago',
      conversion: 9.2,
      status: 'paused',
      source: 'embedded',
    },
    {
      id: 'f7',
      name: 'Multi-site quote builder (draft)',
      category: 'High-value',
      fields: 22,
      submissions: 0,
      lastSubmission: 'never',
      conversion: 0,
      status: 'draft',
      source: 'web',
    },
  ];
}

function buildSubmissions(slug: string): Submission[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';
  const names = [
    'Maria Santos',
    'David Chen',
    'Aisha Williams',
    'Robert Kim',
    'Jennifer López',
    'Sophia Patel',
    'Marcus Brown',
    'Olivia Park',
    'Priya Sharma',
    'James Walker',
    'Liam Nguyen',
    'Ava Singh',
  ];
  const formNames = isCharity
    ? [
        'Monthly giving',
        'Newsletter signup',
        'Pledge card',
        'Volunteer signup',
        'Gala registration',
      ]
    : isHealth
      ? [
          'Capital pledge',
          'Hospital tour',
          'Patient family',
          'Bequest declaration',
          'Volunteer cred.',
        ]
      : ['Service quote', 'Inspection booking', 'Work order', 'Renewal', 'Callback request'];
  return names.map((n, i) => ({
    id: `sub_${i}`,
    formName: formNames[i % formNames.length]!,
    contact: n,
    fieldsFilled: 5 + (i % 7),
    totalFields: 8 + (i % 8),
    capturedAt: `${i * 7 + 4}m ago`,
    source: (['web', 'qr', 'door', 'embedded'] as const)[i % 4]!,
    amountCents: isCharity
      ? BigInt((25 + i * 7) * 100)
      : isHealth
        ? BigInt((500 + i * 50) * 100)
        : undefined,
  }));
}

const SOURCE_ICONS = { web: Globe, qr: QrCode, door: Smartphone, embedded: ExternalLink };

export default function FormsPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'draft' | 'paused'>('all');
  const [query, setQuery] = useState('');

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Forms">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <FormsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const allForms = buildForms(params.slug);
  const forms = allForms
    .filter((f) => (statusFilter === 'all' ? true : f.status === statusFilter))
    .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  const submissions = buildSubmissions(params.slug);

  const totalForms = allForms.length;
  const subsMonth = allForms.reduce((s, f) => s + f.submissions, 0);
  const liveForms = allForms.filter((f) => f.status === 'live');
  const avgConv =
    liveForms.length > 0
      ? (liveForms.reduce((s, f) => s + f.conversion, 0) / liveForms.length).toFixed(1)
      : '0';

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Forms">
      <div className="space-y-5 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total forms" value={totalForms} hint={`${liveForms.length} live`} />
          <KpiCard
            label="Submissions · 30d"
            value={subsMonth.toLocaleString()}
            delta="+24%"
            deltaTone="positive"
          />
          <KpiCard
            label="Avg conversion"
            value={`${avgConv}%`}
            delta="+1.8pp"
            deltaTone="positive"
          />
          <KpiCard label="Avg completion time" value="1m 42s" hint="median across live forms" />
        </div>

        <div className="card !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              {(['all', 'live', 'draft', 'paused'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition ${
                    statusFilter === s
                      ? 'bg-ink text-surface'
                      : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-line2" />
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
              <Search size={12} className="text-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search forms..."
                className="flex-1 bg-transparent text-[12px] text-ink placeholder:text-soft outline-none"
              />
            </div>
            <div className="flex-1" />
            <DataSourceBadge source="fixture" />
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Edit3 size={12} />}
              onClick={() => toast.info('Open builder — form builder lands in Phase 1.2')}
            >
              Open builder
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={12} />}
              onClick={() => toast.info('New form — form builder lands in Phase 1.2')}
            >
              New form
            </Button>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {forms.map((f) => {
              const SourceIcon = SOURCE_ICONS[f.source];
              return (
                <div
                  key={f.id}
                  className="card !shadow-none border border-line2 hover:border-line hover:shadow-md transition group"
                >
                  <div className="card-pad space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink truncate">{f.name}</div>
                        <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">
                          {f.category}
                        </div>
                      </div>
                      <StatusPill
                        tone={
                          f.status === 'live' ? 'success' : f.status === 'paused' ? 'warn' : 'muted'
                        }
                      >
                        {f.status}
                      </StatusPill>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Fields</div>
                        <div className="text-[14px] font-semibold text-ink numeric">{f.fields}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Subs</div>
                        <div className="text-[14px] font-semibold text-ink numeric">
                          {f.submissions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Conv</div>
                        <div className="text-[14px] font-semibold text-ink numeric">
                          {f.conversion}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-line2">
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <SourceIcon size={10} /> {f.source}
                      </span>
                      <span className="text-[10px] text-soft">Last: {f.lastSubmission}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          toast.info(`Edit "${f.name}" — form builder lands in Phase 1.2`)
                        }
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-ink py-1.5 rounded bg-paper hover:bg-line2 transition"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                      <button
                        onClick={() =>
                          toast.info(`Preview "${f.name}" — live preview lands in Phase 1.2`)
                        }
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-ink py-1.5 rounded bg-paper hover:bg-line2 transition"
                      >
                        <Eye size={11} /> Preview
                      </button>
                      <button
                        onClick={() =>
                          toast.info(`Embed "${f.name}" — embed-snippet copy lands in Phase 1.2`)
                        }
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-ink py-1.5 rounded bg-paper hover:bg-line2 transition"
                      >
                        <Copy size={11} /> Embed
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Section
          title="Recent submissions"
          subtitle="Last 12 captures across all live forms"
          paddedBody={false}
          action={
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowUpRight size={11} />}
              onClick={() =>
                toast.info('View all submissions — submissions inbox lands in Phase 1.2')
              }
            >
              View all
            </Button>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Form</th>
                <th>Fields</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Captured</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const SourceIcon = SOURCE_ICONS[s.source];
                const pct = Math.round((s.fieldsFilled / s.totalFields) * 100);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="text-[13px] font-medium text-ink">{s.contact}</div>
                    </td>
                    <td>
                      <span className="text-[12px] text-ink">{s.formName}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-paper rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-muted numeric">
                          {s.fieldsFilled}/{s.totalFields}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="tag inline-flex items-center gap-1">
                        <SourceIcon size={10} /> {s.source}
                      </span>
                    </td>
                    <td className="numeric text-[13px]">
                      {s.amountCents ? `$${(Number(s.amountCents) / 100).toFixed(2)}` : '—'}
                    </td>
                    <td className="text-[12px] text-muted">{s.capturedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Top performers" subtitle="By 30d submissions" paddedBody={false}>
            <div className="divide-y divide-line2">
              {[...allForms]
                .filter((f) => f.status === 'live')
                .sort((a, b) => b.submissions - a.submissions)
                .slice(0, 5)
                .map((f, i) => (
                  <div key={f.id} className="px-5 py-2.5 flex items-center gap-3">
                    <div className="text-[11px] font-bold text-soft w-4">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-ink truncate">{f.name}</div>
                      <div className="text-[10px] text-muted numeric">
                        {f.submissions.toLocaleString()} subs · {f.conversion}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </Section>

          <Section title="By source" subtitle="Submissions split" paddedBody={false}>
            <div className="divide-y divide-line2">
              {(['web', 'qr', 'door', 'embedded'] as const).map((src) => {
                const subs = allForms
                  .filter((f) => f.source === src)
                  .reduce((s, f) => s + f.submissions, 0);
                const Icon = SOURCE_ICONS[src];
                const max = Math.max(
                  ...(['web', 'qr', 'door', 'embedded'] as const).map((s) =>
                    allForms
                      .filter((f) => f.source === s)
                      .reduce((sum, f) => sum + f.submissions, 0),
                  ),
                );
                const pct = max > 0 ? (subs / max) * 100 : 0;
                return (
                  <div key={src} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon size={11} className="text-soft" />
                      <span className="text-[12px] text-ink capitalize">{src}</span>
                      <div className="flex-1" />
                      <span className="text-[12px] font-semibold text-ink numeric">
                        {subs.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Workflow triggers" subtitle="Forms → automations">
            <div className="space-y-2">
              {[
                { form: 'Monthly giving', wf: '→ Welcome SMS · Add to nurture' },
                { form: 'Volunteer signup', wf: '→ Onboarding email seq' },
                { form: 'Door pledge card', wf: '→ Stripe charge · Receipt' },
              ].map((w) => (
                <div key={w.form} className="p-2.5 rounded-lg bg-paper border border-line2">
                  <div className="text-[11.5px] font-medium text-ink">{w.form}</div>
                  <div className="text-[10px] text-muted mt-0.5">{w.wf}</div>
                </div>
              ))}
              <button
                onClick={() =>
                  toast.info('Wire new trigger — workflow builder lands in Phase 1.2')
                }
                className="w-full text-[11px] text-accent font-medium hover:underline py-1"
              >
                + Wire new trigger
              </button>
            </div>
          </Section>
        </div>
      </div>
    </AccountShell>
  );
}
