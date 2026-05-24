'use client';

import { useState, useMemo } from 'react';
import {
  ListChecks,
  Plus,
  Sparkles,
  Filter,
  X,
  Copy,
  Trash2,
  ArrowRight,
  Megaphone,
  MailPlus,
  MessageSquare,
  Phone,
  ChevronDown,
  TrendingUp,
  Eye,
  Edit3,
  Play,
  Pause,
  ChevronRight,
  Layers,
  Zap,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

/* ─────────────────────────────────────────────────────────────────────────
 * Types + fixtures
 * ───────────────────────────────────────────────────────────────────────── */

type Operator = '=' | '!=' | 'IN' | 'NOT IN' | '>=' | '<=' | 'CONTAINS' | 'EXISTS';
type LogicOp = 'AND' | 'OR';

interface Condition {
  id: string;
  field: string;
  op: Operator;
  value: string;
}
interface ConditionGroup {
  id: string;
  logic: LogicOp;
  conditions: Condition[];
}

interface SmartList {
  id: string;
  name: string;
  description: string;
  type: 'smart' | 'static' | 'ai';
  groups: ConditionGroup[];
  memberCount: number;
  growthDelta: number;
  campaigns: string[];
  drips: string[];
  lastUsed: string;
  status: 'active' | 'paused';
  preview: Array<{ name: string; addr: string; tier: string; score: number }>;
}

const LISTS: SmartList[] = [
  {
    id: 'l1',
    name: 'High-tier door, not converted, last 7d',
    description: 'Hot retargeting audience for Meta + Google',
    type: 'smart',
    memberCount: 142,
    growthDelta: 18,
    campaigns: ['Q3 push — TX retargeting'],
    drips: ['Day-7 nurture', 'High-intent re-engage'],
    lastUsed: '12m ago',
    status: 'active',
    groups: [
      {
        id: 'g1',
        logic: 'AND',
        conditions: [
          { id: 'c1', field: 'attributionSource', op: '=', value: 'door' },
          { id: 'c2', field: 'tier', op: '=', value: 'high' },
          { id: 'c3', field: 'status', op: 'NOT IN', value: 'converted, lost, do_not_contact' },
          { id: 'c4', field: 'capturedAt', op: '>=', value: '7d ago' },
        ],
      },
    ],
    preview: [
      { name: 'Maria Santos', addr: '4218 Lakeview Dr, Austin TX', tier: 'high', score: 87 },
      { name: 'David Chen', addr: '887 Maple Ave, Dallas TX', tier: 'high', score: 84 },
      { name: 'Sophia Patel', addr: '4502 Walnut Cir, Atlanta GA', tier: 'high', score: 79 },
      { name: 'Robert Kim', addr: '3098 Birch Ln, Houston TX', tier: 'high', score: 76 },
      { name: 'Aisha Williams', addr: '1502 Cedar St, Austin TX', tier: 'high', score: 73 },
    ],
  },
  {
    id: 'l2',
    name: 'Texas-only door knocks, last 30d',
    description: 'Geo-targeted recruit ads for new TX Knockers',
    type: 'smart',
    memberCount: 1240,
    growthDelta: 82,
    campaigns: ['TX Meta ads', 'Recruit funnel'],
    drips: ['TX onboarding'],
    lastUsed: '2h ago',
    status: 'active',
    groups: [
      {
        id: 'g1',
        logic: 'AND',
        conditions: [
          { id: 'c1', field: 'territory.state', op: '=', value: 'TX' },
          { id: 'c2', field: 'attributionSource', op: '=', value: 'door' },
          { id: 'c3', field: 'capturedAt', op: '>=', value: '30d ago' },
        ],
      },
    ],
    preview: [
      { name: 'Kevin Murphy', addr: '729 Elm Pl, Dallas TX', tier: 'medium', score: 62 },
      { name: 'Liam Nguyen', addr: '1141 Willow Ln, Houston TX', tier: 'medium', score: 58 },
      { name: 'Zara Ahmed', addr: '2204 Oak St, Phoenix AZ', tier: 'high', score: 71 },
    ],
  },
  {
    id: 'l3',
    name: 'Converted donors, $20+/mo recurring',
    description: 'Upsell to $40 tier · "Double your impact"',
    type: 'smart',
    memberCount: 481,
    growthDelta: 12,
    campaigns: ['Donor upgrade — $20 → $40'],
    drips: ['Donor upgrade drip', 'Annual impact report'],
    lastUsed: 'Yesterday',
    status: 'active',
    groups: [
      {
        id: 'g1',
        logic: 'AND',
        conditions: [
          { id: 'c1', field: 'status', op: '=', value: 'converted' },
          { id: 'c2', field: 'donation.amountCents', op: '>=', value: '2000' },
          { id: 'c3', field: 'donation.frequency', op: 'IN', value: 'monthly, fortnightly' },
        ],
      },
    ],
    preview: [
      { name: 'Jennifer López', addr: '2204 Oak St, Phoenix AZ', tier: 'high', score: 92 },
      { name: 'Marcus Brown', addr: '1855 Pine Rd, Atlanta GA', tier: 'high', score: 88 },
      { name: 'Priya Sharma', addr: '887 Maple Ave, Dallas TX', tier: 'high', score: 85 },
    ],
  },
  {
    id: 'l4',
    name: 'AI: Look-alike of top 50 donors',
    description: 'AI-generated · matches signal pattern of top donors',
    type: 'ai',
    memberCount: 318,
    growthDelta: 24,
    campaigns: ['Look-alike Meta + Google'],
    drips: [],
    lastUsed: '4h ago',
    status: 'active',
    groups: [
      {
        id: 'g1',
        logic: 'AND',
        conditions: [
          { id: 'c1', field: 'AI.lookalikeScore', op: '>=', value: '0.72' },
          { id: 'c2', field: 'baseSet', op: '=', value: 'top_50_donors' },
        ],
      },
    ],
    preview: [
      { name: 'Mira Chen', addr: '3318 Magnolia, Austin TX', tier: 'high', score: 81 },
      { name: 'Ethan Brooks', addr: '927 Sycamore, Phoenix AZ', tier: 'high', score: 79 },
    ],
  },
  {
    id: 'l5',
    name: 'Cold leads — 90d reactivation push',
    description: 'Last-ditch re-engage before close-out',
    type: 'smart',
    memberCount: 826,
    growthDelta: 44,
    campaigns: ['Reactivation Meta'],
    drips: ['90-day re-engage'],
    lastUsed: '1d ago',
    status: 'active',
    groups: [
      {
        id: 'g1',
        logic: 'AND',
        conditions: [
          { id: 'c1', field: 'status', op: '=', value: 'lost' },
          { id: 'c2', field: 'age', op: '>=', value: '90d' },
          { id: 'c3', field: 'consent.granted', op: '=', value: 'true' },
        ],
      },
    ],
    preview: [],
  },
  {
    id: 'l6',
    name: 'Bay Area appointment-set (manual)',
    description: 'Curated VIP list — manual review only',
    type: 'static',
    memberCount: 31,
    growthDelta: 2,
    campaigns: ['VIP closer'],
    drips: [],
    lastUsed: '3d ago',
    status: 'paused',
    groups: [],
    preview: [],
  },
];

const FIELDS = [
  { value: 'attributionSource', label: 'Attribution source' },
  { value: 'status', label: 'Lead status' },
  { value: 'tier', label: 'Lead tier' },
  { value: 'territory.state', label: 'Territory state' },
  { value: 'territory.name', label: 'Territory name' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'donation.amountCents', label: 'Donation $' },
  { value: 'donation.frequency', label: 'Donation frequency' },
  { value: 'capturedAt', label: 'Captured date' },
  { value: 'age', label: 'Lead age (days)' },
  { value: 'consent.sms', label: 'SMS consent' },
  { value: 'consent.email', label: 'Email consent' },
  { value: 'AI.leadScore', label: 'AI lead score' },
  { value: 'AI.intent', label: 'AI intent classifier' },
  { value: 'engagement.lastActivity', label: 'Last activity' },
  { value: 'knocker.id', label: 'Captured by Knocker' },
];

/* ─────────────────────────────────────────────────────────────────────────
 * Page
 * ───────────────────────────────────────────────────────────────────────── */

export default function SmartListsPage({ params }: { params: { slug: string } }): JSX.Element {
  const [selectedId, setSelectedId] = useState<string>('l1');
  const [aiPrompt, setAiPrompt] = useState('');
  const [showPushModal, setShowPushModal] = useState(false);

  const selected = useMemo(() => LISTS.find((l) => l.id === selectedId)!, [selectedId]);
  const totalMembers = LISTS.reduce((s, l) => s + l.memberCount, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Smart Lists">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={14} />
            <span>
              <span className="font-semibold">Smart Lists are the spine of marketing.</span> Build a
              rule, the list auto-updates as leads flow in. Push to any campaign in one click. Or
              describe what you want and let AI build the list.
            </span>
          </span>
        </Banner>

        {/* KPI rail */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Lists"
            value={LISTS.length}
            hint={`${LISTS.filter((l) => l.type === 'ai').length} AI · ${LISTS.filter((l) => l.type === 'smart').length} smart · ${LISTS.filter((l) => l.type === 'static').length} static`}
          />
          <KpiCard
            label="Total members"
            value={totalMembers.toLocaleString()}
            delta="+184"
            deltaTone="positive"
            hint="auto-updating"
          />
          <KpiCard
            label="Active in campaigns"
            value={LISTS.filter((l) => l.campaigns.length > 0).length}
            hint={`${[...new Set(LISTS.flatMap((l) => l.campaigns))].length} unique campaigns`}
          />
          <KpiCard
            label="AI lists"
            value={LISTS.filter((l) => l.type === 'ai').length}
            delta="+1 this week"
            deltaTone="positive"
          />
          <KpiCard
            label="Engagement"
            value="34%"
            delta="+6pp"
            deltaTone="positive"
            hint="opens · clicks · replies"
          />
        </div>

        {/* AI list builder */}
        <Section
          title="Describe a list — AI will build it"
          subtitle="Plain English · Claude parses intent into rule conditions"
        >
          <div className="flex items-stretch gap-2">
            <div className="flex-1 relative">
              <Sparkles
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-accent"
              />
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='e.g. "high-value donors in Texas who haven&apos;t given in 60 days"'
                className="w-full pl-10 pr-3 h-11 bg-paper border border-line2 rounded-xl text-[13px] focus:outline-none focus:border-accent focus:bg-surface"
              />
            </div>
            <Button variant="primary" size="lg" leftIcon={<Sparkles size={14} />}>
              Build with AI
            </Button>
          </div>
          {aiPrompt && (
            <div className="mt-3 bg-accentSoft/30 border border-accent/20 rounded-xl p-3 text-[12px] flex items-start gap-2">
              <Sparkles size={13} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-ink font-medium">AI interpretation preview</div>
                <div className="text-muted mt-0.5 font-mono text-[11px]">
                  status = converted AND donation.amountCents &gt;= 5000 AND territory.state = TX
                  AND engagement.lastActivity &lt;= -60d
                </div>
                <div className="text-muted mt-1">
                  → <span className="font-semibold text-ink numeric">~217 members</span> match
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Two-pane layout: list library + selected list detail */}
        <div className="grid grid-cols-12 gap-5">
          {/* Left: list library */}
          <div className="col-span-12 lg:col-span-4">
            <Section
              title="Lists library"
              subtitle={`${LISTS.length} lists`}
              action={
                <Button leftIcon={<Plus size={13} />} variant="primary" size="sm">
                  New list
                </Button>
              }
              paddedBody={false}
            >
              <div className="divide-y divide-line2 max-h-[640px] overflow-y-auto">
                {LISTS.map((l) => {
                  const isSel = l.id === selectedId;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-paper transition ${isSel ? 'bg-accentSoft/40 border-l-2 border-l-accent' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            l.type === 'ai'
                              ? 'bg-accentSoft text-accent'
                              : l.type === 'smart'
                                ? 'bg-paper border border-line2 text-ink'
                                : 'bg-line2 text-muted'
                          }`}
                        >
                          {l.type === 'ai' ? (
                            <Sparkles size={13} />
                          ) : l.type === 'smart' ? (
                            <Zap size={13} />
                          ) : (
                            <ListChecks size={13} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold text-ink truncate">
                            {l.name}
                          </div>
                          <div className="text-[10.5px] text-muted truncate mt-0.5">
                            {l.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-ink font-semibold numeric">
                              {l.memberCount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-success numeric">
                              +{l.growthDelta}
                            </span>
                            {l.status === 'paused' ? (
                              <span className="pill pill-muted !text-[9px]">paused</span>
                            ) : (
                              <span className="text-[10px] text-soft">· {l.lastUsed}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* Right: selected list detail */}
          <div className="col-span-12 lg:col-span-8 space-y-5">
            {/* Header */}
            <div className="card card-pad">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      selected.type === 'ai'
                        ? 'bg-accentSoft text-accent'
                        : selected.type === 'smart'
                          ? 'bg-paper border border-line2 text-ink'
                          : 'bg-line2 text-muted'
                    }`}
                  >
                    {selected.type === 'ai' ? (
                      <Sparkles size={20} />
                    ) : selected.type === 'smart' ? (
                      <Zap size={20} />
                    ) : (
                      <ListChecks size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-ink truncate">
                      {selected.name}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">{selected.description}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`pill ${
                          selected.type === 'ai'
                            ? 'pill-info'
                            : selected.type === 'smart'
                              ? 'pill-success'
                              : 'pill-muted'
                        }`}
                      >
                        {selected.type === 'ai'
                          ? 'AI-generated'
                          : selected.type === 'smart'
                            ? 'Auto-updating smart'
                            : 'Static'}
                      </span>
                      <span className="text-[11px] text-muted">Last used {selected.lastUsed}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="w-8 h-8 rounded hover:bg-paper flex items-center justify-center"
                    title="Edit"
                  >
                    <Edit3 size={14} className="text-muted" />
                  </button>
                  <button
                    className="w-8 h-8 rounded hover:bg-paper flex items-center justify-center"
                    title="Duplicate"
                  >
                    <Copy size={14} className="text-muted" />
                  </button>
                  <button
                    className="w-8 h-8 rounded hover:bg-paper flex items-center justify-center"
                    title="Pause"
                  >
                    {selected.status === 'active' ? (
                      <Pause size={14} className="text-muted" />
                    ) : (
                      <Play size={14} className="text-success" />
                    )}
                  </button>
                  <button
                    className="w-8 h-8 rounded hover:bg-paper flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-rose-600" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-3 pt-4 border-t border-line2">
                <Stat
                  label="Members"
                  value={selected.memberCount.toLocaleString()}
                  sub={`+${selected.growthDelta} this week`}
                />
                <Stat
                  label="In campaigns"
                  value={selected.campaigns.length.toString()}
                  sub={selected.campaigns[0] ?? 'unused'}
                />
                <Stat
                  label="In drips"
                  value={selected.drips.length.toString()}
                  sub={selected.drips[0] ?? 'unused'}
                />
                <Stat label="Avg lead score" value="74" sub="↑ 4 vs avg" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Megaphone size={14} />}
                  onClick={() => setShowPushModal(true)}
                >
                  Push to campaign
                </Button>
                <Button variant="secondary" size="md" leftIcon={<MailPlus size={14} />}>
                  Add to drip
                </Button>
                <Button variant="secondary" size="md" leftIcon={<Phone size={14} />}>
                  Send to dialer queue
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="md" leftIcon={<Eye size={14} />}>
                  View all {selected.memberCount}
                </Button>
              </div>
            </div>

            {/* Rule builder */}
            <Section
              title="Rule builder"
              subtitle="Conditions evaluated server-side on every lead create/update"
              action={
                <Button variant="ghost" size="sm" leftIcon={<Plus size={13} />}>
                  Add group
                </Button>
              }
            >
              {selected.groups.length === 0 ? (
                <div className="text-[12px] text-muted italic">
                  Static list — no rules. Members managed manually.
                </div>
              ) : (
                <div className="space-y-3">
                  {selected.groups.map((g, gi) => (
                    <div key={g.id} className="bg-paper rounded-xl border border-line2 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted uppercase tracking-wider">
                            Group {gi + 1} · all conditions must be
                          </span>
                          <select
                            className="bg-surface border border-line2 rounded text-[11px] px-1.5 py-0.5 font-semibold text-ink"
                            defaultValue={g.logic}
                          >
                            <option>AND</option>
                            <option>OR</option>
                          </select>
                        </div>
                        <button className="w-6 h-6 rounded hover:bg-surface flex items-center justify-center">
                          <X size={12} className="text-soft" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {g.conditions.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 bg-surface border border-line2 rounded-lg p-2"
                          >
                            <select
                              className="flex-[2] min-w-0 bg-transparent text-[12px] text-ink outline-none"
                              defaultValue={c.field}
                            >
                              {FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className="w-24 bg-transparent text-[12px] text-ink font-medium outline-none"
                              defaultValue={c.op}
                            >
                              <option>=</option>
                              <option>!=</option>
                              <option>IN</option>
                              <option>NOT IN</option>
                              <option>&gt;=</option>
                              <option>&lt;=</option>
                              <option>CONTAINS</option>
                              <option>EXISTS</option>
                            </select>
                            <input
                              defaultValue={c.value}
                              className="flex-[3] min-w-0 bg-transparent text-[12px] text-ink outline-none font-mono"
                            />
                            <button className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center shrink-0">
                              <X size={11} className="text-soft" />
                            </button>
                          </div>
                        ))}
                        <button className="w-full text-[11px] text-accent hover:text-accent-strong py-1.5 flex items-center justify-center gap-1">
                          <Plus size={11} /> Add condition
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[12px] text-muted">
                      Live count:{' '}
                      <span className="text-ink font-semibold numeric">
                        {selected.memberCount.toLocaleString()}
                      </span>{' '}
                      leads match
                    </div>
                    <Button variant="primary" size="sm" leftIcon={<Filter size={13} />}>
                      Preview members
                    </Button>
                  </div>
                </div>
              )}
            </Section>

            {/* Member preview */}
            {selected.preview.length > 0 && (
              <Section
                title="Sample members"
                subtitle={`Showing ${selected.preview.length} of ${selected.memberCount.toLocaleString()} · sorted by AI lead score`}
                paddedBody={false}
              >
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Address</th>
                      <th>Tier</th>
                      <th>AI score</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.preview.map((m, i) => (
                      <tr key={i}>
                        <td>
                          <span className="text-[13px] font-medium text-ink">{m.name}</span>
                        </td>
                        <td className="text-[12px] text-muted">{m.addr}</td>
                        <td>
                          <span
                            className={`text-[12px] font-medium capitalize ${m.tier === 'high' ? 'text-success' : 'text-muted'}`}
                          >
                            {m.tier}
                          </span>
                        </td>
                        <td>
                          <AiScore score={m.score} />
                        </td>
                        <td>
                          <ChevronRight size={14} className="text-soft" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Linked campaigns + drips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Linked campaigns" subtitle={`${selected.campaigns.length} active`}>
                {selected.campaigns.length > 0 ? (
                  <div className="space-y-2">
                    {selected.campaigns.map((c) => (
                      <div
                        key={c}
                        className="flex items-center justify-between p-2.5 bg-paper rounded-lg border border-line2"
                      >
                        <div className="flex items-center gap-2">
                          <Megaphone size={13} className="text-accent" />
                          <span className="text-[13px] text-ink">{c}</span>
                        </div>
                        <ArrowRight size={12} className="text-soft" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px] text-muted italic">
                    Not linked to any campaigns yet
                  </div>
                )}
              </Section>
              <Section title="Linked drips" subtitle={`${selected.drips.length} active`}>
                {selected.drips.length > 0 ? (
                  <div className="space-y-2">
                    {selected.drips.map((d) => (
                      <div
                        key={d}
                        className="flex items-center justify-between p-2.5 bg-paper rounded-lg border border-line2"
                      >
                        <div className="flex items-center gap-2">
                          <MailPlus size={13} className="text-accent" />
                          <span className="text-[13px] text-ink">{d}</span>
                        </div>
                        <ArrowRight size={12} className="text-soft" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px] text-muted italic">Not linked to any drips yet</div>
                )}
              </Section>
            </div>

            {/* Performance */}
            <Section
              title="List performance"
              subtitle="Last 30 days · members who reached each step"
            >
              <div className="space-y-2">
                {[
                  { stage: 'Enrolled', count: selected.memberCount, pct: 100 },
                  {
                    stage: 'Engaged (open/click)',
                    count: Math.round(selected.memberCount * 0.48),
                    pct: 48,
                  },
                  {
                    stage: 'Replied / clicked CTA',
                    count: Math.round(selected.memberCount * 0.21),
                    pct: 21,
                  },
                  {
                    stage: 'Booked appointment',
                    count: Math.round(selected.memberCount * 0.09),
                    pct: 9,
                  },
                  { stage: 'Converted', count: Math.round(selected.memberCount * 0.05), pct: 5 },
                ].map((row) => (
                  <div key={row.stage} className="flex items-center gap-3">
                    <div className="w-44 text-[12px] text-ink truncate">{row.stage}</div>
                    <div className="flex-1 h-6 bg-paper rounded relative overflow-hidden border border-line2">
                      <div
                        className="h-full bg-accent/70 transition-all"
                        style={{ width: `${row.pct}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-ink numeric">
                        {row.count.toLocaleString()} · {row.pct}%
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-muted flex items-center gap-1.5 pt-2">
                  <TrendingUp size={12} className="text-success" />
                  Engagement up <span className="font-semibold text-success">+6pp</span> vs cohort
                  avg
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* Push to campaign modal */}
      {showPushModal && (
        <PushModal
          listName={selected.name}
          count={selected.memberCount}
          onClose={() => setShowPushModal(false)}
        />
      )}
    </AccountShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Small helpers
 * ───────────────────────────────────────────────────────────────────────── */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className="text-[18px] font-semibold text-ink numeric mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

function AiScore({ score }: { score: number }): JSX.Element {
  const tone =
    score >= 80
      ? 'text-success bg-successSoft'
      : score >= 60
        ? 'text-accent bg-accentSoft'
        : 'text-muted bg-line2';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${tone}`}
    >
      <Sparkles size={10} />
      <span className="numeric">{score}</span>
    </span>
  );
}

function PushModal({
  listName,
  count,
  onClose,
}: {
  listName: string;
  count: number;
  onClose: () => void;
}): JSX.Element {
  const [channels, setChannels] = useState<string[]>(['meta', 'google']);
  const [campaign, setCampaign] = useState('new');
  function toggle(ch: string) {
    setChannels((s) => (s.includes(ch) ? s.filter((x) => x !== ch) : [...s, ch]));
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line2 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold text-ink">Push to campaign</div>
            <div className="text-[11px] text-muted mt-0.5">
              <span className="font-semibold text-ink">{count.toLocaleString()}</span> members from
              "{listName}"
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider mb-2">Campaign</div>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer ${campaign === 'new' ? 'border-accent bg-accentSoft/30' : 'border-line2'}`}
              >
                <input
                  type="radio"
                  checked={campaign === 'new'}
                  onChange={() => setCampaign('new')}
                  className="accent-accent"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Create new campaign</div>
                  <div className="text-[11px] text-muted">
                    From scratch · AI will draft creatives
                  </div>
                </div>
              </label>
              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer ${campaign === 'existing' ? 'border-accent bg-accentSoft/30' : 'border-line2'}`}
              >
                <input
                  type="radio"
                  checked={campaign === 'existing'}
                  onChange={() => setCampaign('existing')}
                  className="accent-accent"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Add to existing</div>
                  <div className="text-[11px] text-muted">Append as a new audience segment</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-muted uppercase tracking-wider mb-2">Channels</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'meta', label: 'Meta (FB/IG)', sub: 'custom audience' },
                { id: 'google', label: 'Google Ads', sub: 'customer match' },
                { id: 'tiktok', label: 'TikTok', sub: 'custom audience' },
                { id: 'email', label: 'Email', sub: 'broadcast' },
                { id: 'sms', label: 'SMS', sub: 'broadcast' },
                { id: 'dialer', label: 'Dialer queue', sub: 'auto-routed' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggle(ch.id)}
                  className={`text-left p-2.5 rounded-lg border transition ${channels.includes(ch.id) ? 'border-accent bg-accentSoft/30' : 'border-line2 hover:border-line'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-ink">{ch.label}</span>
                    {channels.includes(ch.id) && (
                      <span className="w-4 h-4 rounded-full bg-accent text-surface flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{ch.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-accentSoft/30 border border-accent/20 rounded-lg p-3 text-[12px] flex items-start gap-2">
            <Sparkles size={13} className="text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-ink font-medium">AI will auto-suggest</div>
              <div className="text-muted">
                Best creative angle · ideal time-of-day · channel mix optimisation
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line2 bg-paper/40 flex items-center justify-between">
          <span className="text-[11px] text-muted">
            {channels.length} channels · ~{(count * 0.05).toFixed(0)} predicted conversions
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Layers size={13} />}>
              Push to {channels.length} channels
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
