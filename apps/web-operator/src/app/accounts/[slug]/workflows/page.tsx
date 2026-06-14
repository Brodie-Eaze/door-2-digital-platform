'use client';

import { useState } from 'react';
import {
  Plus,
  Filter,
  Search,
  Zap,
  Play,
  Pause,
  Edit3,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  MessageSquare,
  Phone,
  DollarSign,
  CalendarClock,
  GitBranch,
  Webhook,
  TrendingUp,
} from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { WorkflowsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerIcon: typeof Zap;
  actions: number;
  runs24h: number;
  successRate: number;
  lastRun: string;
  status: 'active' | 'paused' | 'failing' | 'draft';
  category: string;
  timeSavedHrs: number;
}

interface WorkflowRun {
  id: string;
  workflow: string;
  triggeredBy: string;
  status: 'success' | 'failed' | 'running';
  durationMs: number;
  ranAt: string;
}

function buildWorkflows(slug: string): WorkflowDef[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  if (isCharity) {
    return [
      {
        id: 'w1',
        name: 'New donor onboarding',
        description: 'Welcome SMS → Tax-receipt email → Add to nurture → Notify steward',
        trigger: 'Donation form submitted',
        triggerIcon: Webhook,
        actions: 5,
        runs24h: 184,
        successRate: 99.4,
        lastRun: '2m ago',
        status: 'active',
        category: 'Onboarding',
        timeSavedHrs: 14,
      },
      {
        id: 'w2',
        name: 'Door pledge → Stripe charge',
        description: 'SALE disposition → Charge → Email receipt → Notify donor lead',
        trigger: 'Knocker logs SALE',
        triggerIcon: DollarSign,
        actions: 6,
        runs24h: 92,
        successRate: 100,
        lastRun: '8m ago',
        status: 'active',
        category: 'Field ops',
        timeSavedHrs: 11,
      },
      {
        id: 'w3',
        name: 'Lapsed donor winback',
        description: '90d no-give → Impact-story SMS → 7d → Call task → 14d → Email',
        trigger: 'Cohort enters lapsed state',
        triggerIcon: CalendarClock,
        actions: 7,
        runs24h: 32,
        successRate: 97.2,
        lastRun: '34m ago',
        status: 'active',
        category: 'Retention',
        timeSavedHrs: 8,
      },
      {
        id: 'w4',
        name: 'Tier upgrade trigger',
        description: 'Donation > tier threshold → Move tier → Email confirmation → Notify steward',
        trigger: 'Payment > $200',
        triggerIcon: TrendingUp,
        actions: 4,
        runs24h: 14,
        successRate: 100,
        lastRun: '1h ago',
        status: 'active',
        category: 'Engagement',
        timeSavedHrs: 3,
      },
      {
        id: 'w5',
        name: 'Major-gift notification',
        description: 'Gift > $1k → Slack alert → Create steward task → Brief CEO',
        trigger: 'Payment > $1000',
        triggerIcon: AlertCircle,
        actions: 4,
        runs24h: 4,
        successRate: 100,
        lastRun: '3h ago',
        status: 'active',
        category: 'Major gifts',
        timeSavedHrs: 2,
      },
      {
        id: 'w6',
        name: 'Birthday acknowledgment',
        description: 'Donor birthday → Personal note SMS → Hand-written follow-up task',
        trigger: 'Scheduled · daily 9am',
        triggerIcon: CalendarClock,
        actions: 3,
        runs24h: 22,
        successRate: 98.1,
        lastRun: '5h ago',
        status: 'active',
        category: 'Stewardship',
        timeSavedHrs: 6,
      },
      {
        id: 'w7',
        name: 'Failed payment retry',
        description: 'Stripe charge failed → 24h wait → Retry → If 2nd fail: notify donor',
        trigger: 'Stripe webhook · failed',
        triggerIcon: XCircle,
        actions: 5,
        runs24h: 8,
        successRate: 92.4,
        lastRun: '12m ago',
        status: 'active',
        category: 'Finance',
        timeSavedHrs: 4,
      },
      {
        id: 'w8',
        name: 'Volunteer credential expiry',
        description: '30d before expiry → Email → 7d → SMS → Day-of: deactivate access',
        trigger: 'Calendar trigger',
        triggerIcon: CalendarClock,
        actions: 4,
        runs24h: 2,
        successRate: 100,
        lastRun: '4h ago',
        status: 'active',
        category: 'Compliance',
        timeSavedHrs: 5,
      },
      {
        id: 'w9',
        name: 'Gala 2026 nurture',
        description: 'Registered → Reminder 1mo → 1w → Day-of → Post-event thank you',
        trigger: 'Event registration',
        triggerIcon: Webhook,
        actions: 6,
        runs24h: 1,
        successRate: 100,
        lastRun: '1d ago',
        status: 'active',
        category: 'Events',
        timeSavedHrs: 2,
      },
      {
        id: 'w10',
        name: 'Legacy giving nurture (draft)',
        description: 'Planned giving inquiry → 5-touch email seq → Schedule call',
        trigger: 'Form submission',
        triggerIcon: Webhook,
        actions: 7,
        runs24h: 0,
        successRate: 0,
        lastRun: 'never',
        status: 'draft',
        category: 'Major gifts',
        timeSavedHrs: 0,
      },
    ];
  }

  if (isHealth) {
    return [
      {
        id: 'w1',
        name: 'Capital pledge → confirmation',
        description: 'Pledge form → Personalised thank-you → Schedule steward call → Brief CEO',
        trigger: 'Pledge form submitted',
        triggerIcon: Webhook,
        actions: 5,
        runs24h: 8,
        successRate: 100,
        lastRun: '14m ago',
        status: 'active',
        category: 'Onboarding',
        timeSavedHrs: 6,
      },
      {
        id: 'w2',
        name: 'Hospital tour scheduling',
        description: 'Tour request → Calendar invite → Day-before SMS → Day-of host alert',
        trigger: 'Tour form submission',
        triggerIcon: CalendarClock,
        actions: 4,
        runs24h: 12,
        successRate: 99.1,
        lastRun: '32m ago',
        status: 'active',
        category: 'Stewardship',
        timeSavedHrs: 5,
      },
      {
        id: 'w3',
        name: 'Bequest declaration follow-up',
        description: 'Inquiry → Send brochure → 7d → Solicitor referral → Schedule call',
        trigger: 'Form submission',
        triggerIcon: Webhook,
        actions: 5,
        runs24h: 2,
        successRate: 100,
        lastRun: '3h ago',
        status: 'active',
        category: 'Major gifts',
        timeSavedHrs: 3,
      },
      {
        id: 'w4',
        name: 'Patient family check-in',
        description: 'Patient discharge → 14d → Wellness email → 30d → NPS survey',
        trigger: 'Discharge webhook',
        triggerIcon: Webhook,
        actions: 4,
        runs24h: 24,
        successRate: 98.5,
        lastRun: '8m ago',
        status: 'active',
        category: 'Engagement',
        timeSavedHrs: 9,
      },
      {
        id: 'w5',
        name: 'Volunteer credential renewal',
        description: '30d before expiry → Email → 7d → SMS → Deactivate if not renewed',
        trigger: 'Daily scheduled',
        triggerIcon: CalendarClock,
        actions: 4,
        runs24h: 1,
        successRate: 100,
        lastRun: '6h ago',
        status: 'active',
        category: 'Compliance',
        timeSavedHrs: 4,
      },
      {
        id: 'w6',
        name: 'Naming-rights inquiry alert',
        description: 'High-touch form → Slack alert ED + CEO → Steward task',
        trigger: 'Form submission',
        triggerIcon: AlertCircle,
        actions: 3,
        runs24h: 1,
        successRate: 100,
        lastRun: '4h ago',
        status: 'active',
        category: 'Major gifts',
        timeSavedHrs: 1,
      },
      {
        id: 'w7',
        name: 'Donor wall update (paused)',
        description: 'New $5k+ gift → Add to wall list → Quarterly plaque order',
        trigger: 'Payment',
        triggerIcon: DollarSign,
        actions: 3,
        runs24h: 0,
        successRate: 100,
        lastRun: '12d ago',
        status: 'paused',
        category: 'Stewardship',
        timeSavedHrs: 0,
      },
      {
        id: 'w8',
        name: 'Board meeting prep',
        description: 'Weekly cron → Pull KPIs → Generate deck → Email board',
        trigger: 'Weekly · Monday 8am',
        triggerIcon: CalendarClock,
        actions: 4,
        runs24h: 0,
        successRate: 100,
        lastRun: '4d ago',
        status: 'active',
        category: 'Operations',
        timeSavedHrs: 8,
      },
    ];
  }

  return [
    {
      id: 'w1',
      name: 'New lead → SMS welcome',
      description: 'Form submission → Welcome SMS → Add to nurture → Notify knocker',
      trigger: 'Quote form submitted',
      triggerIcon: Webhook,
      actions: 4,
      runs24h: 84,
      successRate: 99.2,
      lastRun: '4m ago',
      status: 'active',
      category: 'Onboarding',
      timeSavedHrs: 7,
    },
    {
      id: 'w2',
      name: 'SALE disposition → Stripe charge',
      description: 'Knocker logs SALE → Charge card → Email receipt → Schedule install',
      trigger: 'Disposition: SALE',
      triggerIcon: DollarSign,
      actions: 6,
      runs24h: 38,
      successRate: 100,
      lastRun: '12m ago',
      status: 'active',
      category: 'Field ops',
      timeSavedHrs: 9,
    },
    {
      id: 'w3',
      name: 'Annual renewal sequence',
      description: '60d before renewal → Email 1 → 30d → Email 2 → 14d → Call task',
      trigger: 'Calendar trigger',
      triggerIcon: CalendarClock,
      actions: 5,
      runs24h: 12,
      successRate: 98.4,
      lastRun: '1h ago',
      status: 'active',
      category: 'Retention',
      timeSavedHrs: 11,
    },
    {
      id: 'w4',
      name: 'Service callback dispatch',
      description: 'Callback request → Assign to nearest tech → SMS confirmation',
      trigger: 'Callback form',
      triggerIcon: Phone,
      actions: 3,
      runs24h: 22,
      successRate: 99.1,
      lastRun: '34m ago',
      status: 'active',
      category: 'Service',
      timeSavedHrs: 6,
    },
    {
      id: 'w5',
      name: 'NPS survey trigger',
      description: 'Service complete → 24h → SMS NPS survey → If <7: alert manager',
      trigger: 'Service complete webhook',
      triggerIcon: Webhook,
      actions: 4,
      runs24h: 28,
      successRate: 97.2,
      lastRun: '18m ago',
      status: 'active',
      category: 'CX',
      timeSavedHrs: 4,
    },
    {
      id: 'w6',
      name: 'Failed payment retry',
      description: 'Stripe failure → 24h wait → Retry → If 2nd fail: notify customer',
      trigger: 'Stripe webhook · failed',
      triggerIcon: XCircle,
      actions: 5,
      runs24h: 4,
      successRate: 88.4,
      lastRun: '22m ago',
      status: 'failing',
      category: 'Finance',
      timeSavedHrs: 3,
    },
    {
      id: 'w7',
      name: 'Tech route handoff',
      description: 'End-of-day → Auto-generate tomorrow routes → Push to iPads',
      trigger: 'Daily · 6pm',
      triggerIcon: CalendarClock,
      actions: 3,
      runs24h: 1,
      successRate: 100,
      lastRun: 'yesterday 6pm',
      status: 'active',
      category: 'Operations',
      timeSavedHrs: 4,
    },
    {
      id: 'w8',
      name: 'Multi-site quote builder (draft)',
      description: 'Enterprise form → Quote builder → Review queue → Email proposal',
      trigger: 'Enterprise form',
      triggerIcon: Webhook,
      actions: 6,
      runs24h: 0,
      successRate: 0,
      lastRun: 'never',
      status: 'draft',
      category: 'Sales',
      timeSavedHrs: 0,
    },
  ];
}

function buildRuns(slug: string): WorkflowRun[] {
  const wfs = buildWorkflows(slug);
  const triggers = [
    'Maria Santos',
    'David Chen',
    'Aisha Williams',
    'PestMax #1208',
    'Acme Warehouse',
    'Walker Estate',
    'Goldman Family',
    'Direct API call',
    'Cron · scheduled',
  ];
  const statuses: WorkflowRun['status'][] = [
    'success',
    'success',
    'success',
    'success',
    'success',
    'running',
    'failed',
    'success',
    'success',
    'success',
    'success',
    'failed',
  ];
  return Array.from({ length: 12 }, (_, i) => ({
    id: `run_${i}`,
    workflow: wfs[i % wfs.length]!.name,
    triggeredBy: triggers[i % triggers.length]!,
    status: statuses[i]!,
    durationMs: 420 + ((i * 271) % 4800),
    ranAt: `${i * 4 + 1}m ago`,
  }));
}

const STATUS_ICONS: Record<WorkflowRun['status'], { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success' },
  failed: { icon: XCircle, color: 'text-rose-600' },
  running: { icon: Play, color: 'text-accent' },
};

export default function WorkflowsPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'paused' | 'failing' | 'draft'
  >('all');
  const [query, setQuery] = useState('');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, WorkflowDef['status']>>(
    {},
  );

  function toggleWorkflow(w: WorkflowDef): void {
    const current = statusOverrides[w.id] ?? w.status;
    const next: WorkflowDef['status'] = current === 'paused' ? 'active' : 'paused';
    setStatusOverrides((prev) => ({ ...prev, [w.id]: next }));
    toast.success(`"${w.name}" ${next === 'paused' ? 'paused' : 'resumed'}`);
  }

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Workflows">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <WorkflowsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const allWfs = buildWorkflows(params.slug).map((w) => ({
    ...w,
    status: statusOverrides[w.id] ?? w.status,
  }));
  const wfs = allWfs
    .filter((w) => (statusFilter === 'all' ? true : w.status === statusFilter))
    .filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));
  const runs = buildRuns(params.slug);

  const active = allWfs.filter((w) => w.status === 'active');
  const runs24h = allWfs.reduce((s, w) => s + w.runs24h, 0);
  const successRate =
    active.length > 0
      ? (active.reduce((s, w) => s + w.successRate, 0) / active.length).toFixed(1)
      : '0';
  const timeSaved = allWfs.reduce((s, w) => s + w.timeSavedHrs, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Workflows">
      <div className="space-y-5 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Active workflows" value={active.length} hint={`${allWfs.length} total`} />
          <KpiCard
            label="Runs · 24h"
            value={runs24h.toLocaleString()}
            delta="+22%"
            deltaTone="positive"
          />
          <KpiCard
            label="Success rate"
            value={`${successRate}%`}
            delta="+1.2pp"
            deltaTone="positive"
          />
          <KpiCard label="Time saved · wk" value={`${timeSaved}h`} hint="vs manual ops" />
        </div>

        <div className="card !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              {(['all', 'active', 'paused', 'failing', 'draft'] as const).map((s) => (
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
            <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
              <Search size={12} className="text-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workflows..."
                className="flex-1 bg-transparent text-[12px] text-ink placeholder:text-soft outline-none"
              />
            </div>
            <div className="flex-1" />
            <DataSourceBadge source="fixture" />
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<GitBranch size={12} />}
              onClick={() => toast.info('Open builder — workflow builder lands in Phase 1.2')}
            >
              Open builder
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={12} />}
              onClick={() => toast.info('New workflow — builder wiring lands in Phase 1.2')}
            >
              New workflow
            </Button>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {wfs.map((w) => {
              const TriggerIcon = w.triggerIcon;
              return (
                <div
                  key={w.id}
                  className="card !shadow-none border border-line2 hover:border-line hover:shadow-md transition"
                >
                  <div className="card-pad space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-semibold text-ink truncate">
                            {w.name}
                          </div>
                          <span className="tag !text-[9px]">{w.category}</span>
                        </div>
                        <div className="text-[11px] text-muted mt-1 leading-snug">
                          {w.description}
                        </div>
                      </div>
                      <StatusPill
                        tone={
                          w.status === 'active'
                            ? 'success'
                            : w.status === 'failing'
                              ? 'danger'
                              : w.status === 'paused'
                                ? 'warn'
                                : 'muted'
                        }
                      >
                        {w.status}
                      </StatusPill>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-paper rounded-lg">
                      <TriggerIcon size={12} className="text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted">
                          Trigger
                        </div>
                        <div className="text-[12px] text-ink truncate">{w.trigger}</div>
                      </div>
                      <span className="text-soft">→</span>
                      <div className="text-[11px] text-muted whitespace-nowrap">
                        {w.actions} actions
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-line2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">24h</div>
                        <div className="text-[13px] font-semibold text-ink numeric">
                          {w.runs24h}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">
                          Success
                        </div>
                        <div
                          className={`text-[13px] font-semibold numeric ${w.successRate >= 95 ? 'text-success' : w.successRate >= 85 ? 'text-amber-600' : 'text-rose-600'}`}
                        >
                          {w.successRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Saves</div>
                        <div className="text-[13px] font-semibold text-ink numeric">
                          {w.timeSavedHrs}h
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Last</div>
                        <div className="text-[11px] text-muted truncate">{w.lastRun}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-line2">
                      <button
                        onClick={() =>
                          toast.info(`Edit "${w.name}" — workflow builder lands in Phase 1.2`)
                        }
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-ink py-1.5 rounded bg-paper hover:bg-line2 transition"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                      <button
                        onClick={() => toggleWorkflow(w)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-ink py-1.5 rounded bg-paper hover:bg-line2 transition"
                      >
                        {w.status === 'paused' ? (
                          <>
                            <Play size={11} /> Resume
                          </>
                        ) : (
                          <>
                            <Pause size={11} /> Pause
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          toast.info(`Clone "${w.name}" — wiring lands in Phase 1.2`)
                        }
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted hover:text-ink py-1.5 rounded bg-paper hover:bg-line2 transition"
                      >
                        <Copy size={11} /> Clone
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Section
          title="Recent runs"
          subtitle="Last 12 executions across all workflows"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Triggered by</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Ran at</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const SIcon = STATUS_ICONS[r.status];
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="text-[13px] font-medium text-ink truncate max-w-md">
                        {r.workflow}
                      </div>
                    </td>
                    <td>
                      <span className="text-[12px] text-muted">{r.triggeredBy}</span>
                    </td>
                    <td>
                      <span
                        className={`flex items-center gap-1 text-[12px] font-medium ${SIcon.color}`}
                      >
                        <SIcon.icon size={12} /> {r.status}
                      </span>
                    </td>
                    <td className="numeric text-[12px]">{r.durationMs}ms</td>
                    <td className="text-[12px] text-muted">{r.ranAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Action types · 24h" subtitle="Send breakdown" paddedBody={false}>
            <div className="divide-y divide-line2">
              {[
                { label: 'SMS sent', icon: MessageSquare, count: 482, color: 'text-blue-600' },
                { label: 'Emails sent', icon: Mail, count: 318, color: 'text-violet-600' },
                { label: 'Calls auto-dialled', icon: Phone, count: 94, color: 'text-emerald-600' },
                {
                  label: 'Payments processed',
                  icon: DollarSign,
                  count: 41,
                  color: 'text-amber-600',
                },
              ].map((a) => (
                <div key={a.label} className="px-5 py-3 flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg bg-paper flex items-center justify-center ${a.color}`}
                  >
                    <a.icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-ink truncate">{a.label}</div>
                  </div>
                  <div className="text-[14px] font-bold text-ink numeric">{a.count}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Top workflows" subtitle="By runs · 24h" paddedBody={false}>
            <div className="divide-y divide-line2">
              {[...allWfs]
                .filter((w) => w.status === 'active')
                .sort((a, b) => b.runs24h - a.runs24h)
                .slice(0, 5)
                .map((w, i) => (
                  <div key={w.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="text-[11px] font-bold text-soft w-4">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-ink truncate">{w.name}</div>
                      <div className="text-[10px] text-muted numeric">
                        {w.runs24h} runs · {w.successRate}% success
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </Section>

          <Section title="Templates" subtitle="Get started fast">
            <div className="space-y-2">
              {[
                { name: 'New lead nurture', icon: Zap },
                { name: 'Failed payment retry', icon: XCircle },
                { name: 'Renewal reminder seq', icon: CalendarClock },
                { name: 'Post-purchase NPS', icon: TrendingUp },
              ].map((t) => (
                <button
                  key={t.name}
                  onClick={() =>
                    toast.info(`Use "${t.name}" template — builder wiring lands in Phase 1.2`)
                  }
                  className="w-full text-left p-2.5 rounded-lg bg-paper border border-line2 hover:border-line transition flex items-center gap-2"
                >
                  <t.icon size={12} className="text-accent" />
                  <div className="text-[12px] font-medium text-ink flex-1">{t.name}</div>
                  <span className="text-[10px] text-accent">Use →</span>
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </AccountShell>
  );
}
