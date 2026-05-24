'use client';

import { useMemo, useState, useEffect, type DragEvent } from 'react';
import {
  Phone,
  Mail,
  MessageSquare,
  Plus,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  TableProperties,
  BarChart3,
  MoreVertical,
  Clock,
  X,
  MapPin,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  User,
  Heart,
  ShoppingBag,
  UserPlus,
  AlertCircle,
  CheckSquare,
  Square,
  Zap,
  Bot,
  Target,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { PipelineLeadConversation } from '@/components/PipelineLeadConversation';
import { accountData, PIPELINE_STAGES, type LeadRow } from '@/lib/account-fixtures';

interface PipelineLead extends LeadRow {
  valueCents: bigint;
  daysInStage: number;
  aiScore: number;
  aiSuggestion: string;
  activity: { calls: number; sms: number; emails: number };
}

type PipelineKey = 'donation' | 'sales' | 'recruiting';

const PIPELINES: Record<
  PipelineKey,
  { name: string; icon: typeof Heart; description: string; valueLabel: string }
> = {
  donation: {
    name: 'Donation pipeline',
    icon: Heart,
    description: 'Recurring + one-off donor pipeline',
    valueLabel: 'annual value',
  },
  sales: {
    name: 'Commercial sales',
    icon: ShoppingBag,
    description: 'One-shot product / service contracts',
    valueLabel: 'contract value',
  },
  recruiting: {
    name: 'Knocker recruiting',
    icon: UserPlus,
    description: 'Field-rep applicant funnel (high-churn)',
    valueLabel: 'lifetime productivity',
  },
};

const SOURCE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'door', label: 'Door' },
  { value: 'inside_sales', label: 'Inside' },
  { value: 'retargeting', label: 'Retarget' },
] as const;

const SAVED_VIEWS = [
  { name: 'My pipeline', count: 36 },
  { name: 'High value > $500', count: 18 },
  { name: 'Stuck > 5 days', count: 7 },
  { name: 'AI score > 80', count: 22 },
];

export default function PipelinePage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, leads: initialLeads } = accountData(params.slug);

  const initialEnriched: PipelineLead[] = useMemo(
    () =>
      initialLeads.map((l, i) => ({
        ...l,
        valueCents: BigInt((240 + ((i * 137) % 1200)) * 100),
        daysInStage: (i * 3) % 9,
        aiScore: 40 + ((i * 19) % 60),
        aiSuggestion: [
          'Call within 24h',
          'Send impact-story email',
          'Schedule callback Tue 3pm',
          'Move to high-priority queue',
          'Try alternate angle: monthly micro-donation',
          'Tag for VIP closer',
        ][i % 6]!,
        activity: { calls: i % 3, sms: 1 + (i % 4), emails: i % 2 },
      })),
    [initialLeads],
  );
  const [leads, setLeads] = useState<PipelineLead[]>(initialEnriched);
  const [activePipeline, setActivePipeline] = useState<PipelineKey>('donation');
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selected, setSelected] = useState<PipelineLead | null>(null);
  const [view, setView] = useState<'kanban' | 'list' | 'forecast'>('kanban');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [quickAddStage, setQuickAddStage] = useState<string | null>(null);

  const filtered = leads.filter((l) => {
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
    return true;
  });

  const stageAgg = PIPELINE_STAGES.map((s) => {
    const stageLeads = filtered.filter((l) => l.status === s.status);
    const total = stageLeads.reduce((sum, l) => sum + l.valueCents, 0n);
    const avgDays =
      stageLeads.length > 0
        ? Math.round(stageLeads.reduce((s, l) => s + l.daysInStage, 0) / stageLeads.length)
        : 0;
    return {
      ...s,
      leads: stageLeads,
      count: stageLeads.length,
      totalCents: total,
      avgDaysInStage: avgDays,
    };
  });

  const totalOpen = filtered.filter(
    (l) => !['converted', 'lost', 'do_not_contact'].includes(l.status),
  ).length;
  const totalConverted = filtered.filter((l) => l.status === 'converted').length;
  const totalValueOpen = stageAgg
    .filter((s) => s.status !== 'converted')
    .reduce((sum, s) => sum + s.totalCents, 0n);
  const weightedForecast = stageAgg.reduce((sum, s) => {
    const w =
      s.status === 'converted'
        ? 1
        : s.status === 'appointment_set'
          ? 0.75
          : s.status === 'qualified'
            ? 0.5
            : s.status === 'contacted'
              ? 0.25
              : 0.1;
    return sum + BigInt(Math.floor(Number(s.totalCents) * w));
  }, 0n);
  const winRate =
    totalConverted + filtered.filter((l) => l.status === 'lost').length > 0
      ? Math.round(
          (totalConverted / (totalConverted + filtered.filter((l) => l.status === 'lost').length)) *
            100,
        )
      : 0;
  const avgAiScore =
    filtered.length > 0
      ? Math.round(filtered.reduce((s, l) => s + l.aiScore, 0) / filtered.length)
      : 0;

  function onDragStart(id: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setDragId(id);
    };
  }
  function onDragOver(stage: LeadRow['status']) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setHoverStage(stage);
    };
  }
  function onDrop(stage: LeadRow['status']) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id)
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: stage, daysInStage: 0 } : l)),
        );
      setDragId(null);
      setHoverStage(null);
    };
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function bulkMoveStage(stage: LeadRow['status']) {
    setLeads((prev) =>
      prev.map((l) => (selectedIds.has(l.id) ? { ...l, status: stage, daysInStage: 0 } : l)),
    );
    clearSelection();
  }

  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelected(null);
        clearSelection();
      }
    }
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  if (!account)
    return (
      <AccountShell accountSlug={params.slug}>
        <div>Not found</div>
      </AccountShell>
    );

  const PipelineIcon = PIPELINES[activePipeline].icon;
  const region = account.region === 'AU' ? 'AU' : 'US';

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Pipeline">
      <div className="space-y-4 max-w-[1700px]">
        {/* Multi-pipeline tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(PIPELINES) as PipelineKey[]).map((key) => {
            const p = PIPELINES[key];
            const Icon = p.icon;
            const active = key === activePipeline;
            return (
              <button
                key={key}
                onClick={() => setActivePipeline(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition ${
                  active
                    ? 'bg-ink text-surface border-ink shadow-sm'
                    : 'bg-surface text-muted border-line2 hover:border-line hover:text-ink'
                }`}
              >
                <Icon size={14} />
                <div className="text-left">
                  <div className="text-[12.5px] font-semibold leading-tight">{p.name}</div>
                  <div className={`text-[10px] ${active ? 'text-surface/70' : 'text-soft'}`}>
                    {p.description}
                  </div>
                </div>
              </button>
            );
          })}
          <div className="flex-1" />
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-line text-[12px] text-muted hover:text-ink hover:border-line">
            <Plus size={13} /> New pipeline
          </button>
        </div>

        {/* Top metrics rail */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiCard label="Open leads" value={totalOpen} hint={`${filtered.length} total`} />
          <KpiCard
            label="Open pipeline"
            value={<Money cents={totalValueOpen} region={region} />}
            delta="+18%"
            deltaTone="positive"
            hint={PIPELINES[activePipeline].valueLabel}
          />
          <KpiCard
            label="Weighted forecast"
            value={<Money cents={weightedForecast} region={region} />}
            hint="stage probability"
          />
          <KpiCard
            label="Win rate"
            value={`${winRate}%`}
            delta="+2pp"
            deltaTone="positive"
            hint="L30D"
          />
          <KpiCard label="Avg AI score" value={avgAiScore} hint="0–100 propensity" />
          <KpiCard label="Avg cycle" value="4.2d" hint="capture → close" />
        </div>

        {/* Toolbar */}
        <div className="card !p-0 sticky top-14 z-20">
          <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <div className="flex items-center bg-paper rounded-lg p-0.5 border border-line2">
              {[
                { v: 'kanban' as const, icon: LayoutGrid, label: 'Kanban' },
                { v: 'list' as const, icon: TableProperties, label: 'List' },
                { v: 'forecast' as const, icon: BarChart3, label: 'Forecast' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setView(opt.v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition ${view === opt.v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                >
                  <opt.icon size={13} />
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-line2" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">View</span>
              <div className="flex items-center gap-1">
                {SAVED_VIEWS.slice(0, 3).map((sv) => (
                  <button
                    key={sv.name}
                    className="px-2 py-1 rounded text-[11px] font-medium bg-paper text-muted hover:bg-line2 hover:text-ink flex items-center gap-1"
                  >
                    {sv.name} <span className="numeric text-soft">{sv.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="h-6 w-px bg-line2" />
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              <div className="flex items-center gap-1">
                {SOURCE_FILTERS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSourceFilter(s.value)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${sourceFilter === s.value ? 'bg-ink text-surface' : 'bg-paper text-muted hover:bg-line2 hover:text-ink'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" leftIcon={<ArrowUpDown size={13} />}>
              Sort
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Bot size={13} />}
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className={aiPanelOpen ? '!text-accent' : ''}
            >
              AI insights
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
              New lead
            </Button>
          </div>

          {selectedIds.size > 0 && (
            <div className="bg-accent text-surface px-4 py-2 flex items-center gap-3 text-[12px] flex-wrap">
              <span className="font-semibold">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-surface/30" />
              <span className="text-surface/80">Move to:</span>
              <div className="flex items-center gap-1">
                {PIPELINE_STAGES.map((s) => (
                  <button
                    key={s.status}
                    onClick={() => bulkMoveStage(s.status)}
                    className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 text-[11px] font-medium"
                  >
                    {s.stage}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <button className="hover:bg-surface/10 px-2 py-1 rounded text-[11px]">
                Assign owner
              </button>
              <button className="hover:bg-surface/10 px-2 py-1 rounded text-[11px]">
                Add to list
              </button>
              <button
                onClick={clearSelection}
                className="hover:bg-surface/10 w-7 h-7 rounded flex items-center justify-center"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        <Banner tone="success">
          <span className="text-[13px] flex items-center gap-2">
            <PipelineIcon size={13} />
            <span>
              <span className="font-semibold">{PIPELINES[activePipeline].name}.</span> Drag cards ·
              multi-select to bulk-move · click for full chat &amp; detail · check{' '}
              <Bot size={11} className="inline" /> AI insights for ML-ranked next actions.
            </span>
          </span>
        </Banner>

        {/* Main grid */}
        <div className={`grid gap-4 ${aiPanelOpen ? 'grid-cols-12' : 'grid-cols-1'}`}>
          <div className={aiPanelOpen ? 'col-span-9' : 'col-span-1'}>
            {view === 'kanban' && (
              <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 620 }}>
                {stageAgg.map((s) => {
                  const isHover = hoverStage === s.status;
                  return (
                    <div
                      key={s.status}
                      onDragOver={onDragOver(s.status)}
                      onDragLeave={() => setHoverStage(null)}
                      onDrop={onDrop(s.status)}
                      className={`flex flex-col shrink-0 w-[280px] rounded-xl border transition ${isHover ? 'border-accent shadow-lg bg-accentSoft/30' : 'border-line2 bg-surface'}`}
                    >
                      <div className="px-3 py-3 border-b border-line2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${s.status === 'converted' || s.status === 'appointment_set' ? 'bg-success' : s.status === 'qualified' || s.status === 'contacted' ? 'bg-accent' : 'bg-soft'}`}
                            />
                            <div className="text-[13px] font-semibold text-ink tracking-tight">
                              {s.stage}
                            </div>
                            <span className="mono !w-5 !h-5 !text-[10px]">{s.count}</span>
                          </div>
                          <button className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center">
                            <MoreVertical size={13} className="text-soft" />
                          </button>
                        </div>
                        <div className="mt-1 text-[10px] text-muted truncate">{s.description}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-[14px] font-bold text-ink numeric">
                            <Money cents={s.totalCents} region={region} emptyAsDash />
                          </div>
                          <div className="text-[10px] text-muted numeric flex items-center gap-1">
                            <Clock size={9} /> ~{s.avgDaysInStage}d avg
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 p-2 space-y-2 overflow-y-auto bg-paper/30">
                        {s.leads.map((l) => {
                          const isDragging = dragId === l.id;
                          const isSelected = selectedIds.has(l.id);
                          const tierColor =
                            l.tier === 'high'
                              ? 'bg-success'
                              : l.tier === 'low'
                                ? 'bg-soft'
                                : 'bg-accent';
                          const ageColor =
                            l.daysInStage > 5
                              ? 'text-rose-600'
                              : l.daysInStage > 2
                                ? 'text-warn'
                                : 'text-success';
                          const isStuck = l.daysInStage > 5;
                          return (
                            <div
                              key={l.id}
                              draggable
                              onDragStart={onDragStart(l.id)}
                              onDragEnd={() => {
                                setDragId(null);
                                setHoverStage(null);
                              }}
                              onClick={() => setSelected(l)}
                              className={`group relative bg-surface border rounded-lg transition cursor-grab active:cursor-grabbing hover:shadow-md ${
                                isDragging ? 'opacity-30 scale-95 rotate-1' : ''
                              } ${isSelected ? 'border-accent ring-1 ring-accent/40' : isStuck ? 'border-rose-200' : 'border-line2 hover:border-line'}`}
                            >
                              <div
                                className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${tierColor}`}
                              />

                              {isStuck && (
                                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-surface flex items-center gap-0.5 shadow">
                                  <AlertCircle size={9} /> STUCK
                                </div>
                              )}

                              <div className="p-3">
                                <div className="flex items-start gap-2">
                                  <button
                                    onClick={(e) => toggleSelect(l.id, e)}
                                    className="mt-0.5 shrink-0 text-soft hover:text-ink"
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={13} className="text-accent" />
                                    ) : (
                                      <Square size={13} />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="text-[12px] font-semibold text-ink leading-tight truncate">
                                        {l.name}
                                      </div>
                                      <div className="text-[12px] font-bold text-ink numeric whitespace-nowrap">
                                        <Money cents={l.valueCents} region={region} />
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-muted truncate mt-1 flex items-center gap-1">
                                      <MapPin size={9} /> {l.address}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <AiScoreBadge score={l.aiScore} />
                                  <div className="flex items-center gap-1.5 text-[10px] text-soft">
                                    {l.activity.calls > 0 && (
                                      <span
                                        className="flex items-center gap-0.5"
                                        title={`${l.activity.calls} calls`}
                                      >
                                        <Phone size={9} /> {l.activity.calls}
                                      </span>
                                    )}
                                    {l.activity.sms > 0 && (
                                      <span
                                        className="flex items-center gap-0.5"
                                        title={`${l.activity.sms} SMS`}
                                      >
                                        <MessageSquare size={9} /> {l.activity.sms}
                                      </span>
                                    )}
                                    {l.activity.emails > 0 && (
                                      <span
                                        className="flex items-center gap-0.5"
                                        title={`${l.activity.emails} emails`}
                                      >
                                        <Mail size={9} /> {l.activity.emails}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-line2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="tag !text-[9px] !px-1.5">
                                      {l.source.replace('_', ' ')}
                                    </span>
                                    {l.assignee && (
                                      <span className="mono !w-4 !h-4 !text-[8px]">
                                        {l.assignee}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[10px] font-medium numeric flex items-center gap-0.5 ${ageColor}`}
                                  >
                                    <Clock size={9} /> {l.daysInStage}d
                                  </span>
                                </div>

                                <div className="opacity-0 group-hover:opacity-100 transition mt-2 pt-2 border-t border-line2 flex items-center gap-1 justify-center">
                                  <button
                                    className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
                                    title="Call"
                                  >
                                    <Phone size={12} className="text-muted" />
                                  </button>
                                  <button
                                    className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
                                    title="SMS"
                                  >
                                    <MessageSquare size={12} className="text-muted" />
                                  </button>
                                  <button
                                    className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
                                    title="Email"
                                  >
                                    <Mail size={12} className="text-muted" />
                                  </button>
                                  <button
                                    className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
                                    title="AI suggest"
                                  >
                                    <Sparkles size={12} className="text-accent" />
                                  </button>
                                  <button
                                    className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
                                    title="View"
                                  >
                                    <ChevronRight size={12} className="text-muted" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {s.count === 0 && (
                          <div className="text-[11px] text-soft text-center py-10 border border-dashed border-line2 rounded-lg">
                            Drop leads here
                          </div>
                        )}

                        {quickAddStage === s.status && (
                          <div className="bg-surface border-2 border-accent rounded-lg p-2 space-y-2 shadow-sm">
                            <input
                              autoFocus
                              className="w-full px-2 py-1.5 bg-paper border border-line2 rounded text-[12px]"
                              placeholder="Lead name"
                            />
                            <input
                              className="w-full px-2 py-1.5 bg-paper border border-line2 rounded text-[12px] numeric"
                              placeholder="Phone"
                            />
                            <div className="flex items-center gap-1">
                              <Button variant="primary" size="sm" className="!flex-1">
                                Add
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setQuickAddStage(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setQuickAddStage(s.status)}
                        className="px-3 py-2 border-t border-line2 text-[11px] text-soft hover:text-ink hover:bg-paper transition flex items-center gap-1.5 justify-center"
                      >
                        <Plus size={12} /> Quick add lead
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'list' && (
              <div className="card !p-0">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Stage</th>
                      <th>AI</th>
                      <th>Value</th>
                      <th>Source</th>
                      <th>Days</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id} onClick={() => setSelected(l)} className="cursor-pointer">
                        <td>
                          <div className="text-[13px] font-medium text-ink">{l.name}</div>
                          <div className="text-[10px] text-muted">{l.address}</div>
                        </td>
                        <td>
                          <StatusPill
                            tone={
                              l.status === 'converted'
                                ? 'success'
                                : l.status === 'lost'
                                  ? 'muted'
                                  : 'info'
                            }
                          >
                            {l.status.replace('_', ' ')}
                          </StatusPill>
                        </td>
                        <td>
                          <AiScoreBadge score={l.aiScore} />
                        </td>
                        <td>
                          <Money cents={l.valueCents} region={region} />
                        </td>
                        <td>
                          <span className="tag">{l.source.replace('_', ' ')}</span>
                        </td>
                        <td className="numeric text-[13px]">{l.daysInStage}d</td>
                        <td>{l.assignee && <span className="mono">{l.assignee}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {view === 'forecast' && (
              <div className="card card-pad">
                <div className="text-[13px] font-semibold text-ink mb-4">
                  Pipeline forecast by stage
                </div>
                <div className="space-y-3">
                  {stageAgg.map((s) => {
                    const max =
                      Number(
                        stageAgg.reduce((m, x) => (x.totalCents > m ? x.totalCents : m), 0n),
                      ) || 1;
                    const pct = (Number(s.totalCents) / max) * 100;
                    return (
                      <div key={s.status} className="flex items-center gap-3">
                        <div className="w-32 text-[12px] text-ink truncate">{s.stage}</div>
                        <div className="flex-1 h-7 bg-paper rounded relative overflow-hidden border border-line2">
                          <div
                            className={`h-full ${s.status === 'converted' ? 'bg-success' : s.status === 'appointment_set' ? 'bg-accent' : s.status === 'qualified' ? 'bg-accent/70' : s.status === 'contacted' ? 'bg-accent/50' : 'bg-soft/50'} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-[11px] font-medium text-ink numeric">
                              <Money cents={s.totalCents} region={region} emptyAsDash /> · {s.count}{' '}
                              leads · ~{s.avgDaysInStage}d
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-line2 flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span className="text-[12px] text-muted">Weighted forecast:</span>
                  <span className="text-[14px] font-bold text-ink numeric">
                    <Money cents={weightedForecast} region={region} />
                  </span>
                  <span className="text-[11px] text-success ml-auto flex items-center gap-1">
                    <TrendingUp size={12} /> +22% vs LM
                  </span>
                </div>
              </div>
            )}
          </div>

          {aiPanelOpen && (
            <div className="col-span-3 space-y-3">
              <div className="card !p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-line2 bg-accentSoft/30 flex items-center gap-2">
                  <Bot size={14} className="text-accent" />
                  <div className="text-[13px] font-semibold text-ink">AI insights</div>
                  <div className="flex-1" />
                  <button
                    onClick={() => setAiPanelOpen(false)}
                    className="w-6 h-6 rounded hover:bg-surface flex items-center justify-center"
                  >
                    <X size={12} className="text-muted" />
                  </button>
                </div>
                <div className="divide-y divide-line2">
                  <Insight
                    icon={Target}
                    title="7 high-value leads stuck > 5 days"
                    detail="Combined value $4,820 at risk. Suggested: bulk-assign to top closer Sarah H."
                    action="Apply suggestion"
                  />
                  <Insight
                    icon={Zap}
                    title="Convert 'Appointment' faster"
                    detail="Cohort with Day-1 video DM converts 38% vs 22% baseline. Trigger drip?"
                    action="Enable A/B test"
                  />
                  <Insight
                    icon={Sparkles}
                    title="Maria Santos · likely to convert in 24h"
                    detail="AI score 87 · last activity: read SMS 14m ago. Send the impact-story now."
                    action="Send personalised SMS"
                  />
                  <Insight
                    icon={TrendingUp}
                    title="Forecast +22% vs last month"
                    detail="Weighted pipeline trending up. Top driver: door-attribution leads (+18%)."
                  />
                  <Insight
                    icon={AlertCircle}
                    title="Tomás M. conv. rate dropped 11pp"
                    detail="Last 7d vs trailing 30d. Suggest 1:1 + script review."
                    action="Schedule 1:1"
                    tone="warn"
                  />
                </div>
                <div className="p-3 border-t border-line2 bg-paper/40">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    leftIcon={<Bot size={12} />}
                  >
                    Ask AI about pipeline
                  </Button>
                </div>
              </div>

              <div className="card !p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-line2">
                  <div className="text-[12px] font-semibold text-ink">Stuck &gt; 5 days</div>
                </div>
                <div className="divide-y divide-line2 max-h-[200px] overflow-y-auto">
                  {filtered
                    .filter((l) => l.daysInStage > 5)
                    .slice(0, 6)
                    .map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setSelected(l)}
                        className="w-full text-left px-4 py-2.5 hover:bg-paper transition flex items-center gap-2"
                      >
                        <AlertCircle size={11} className="text-rose-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-ink truncate">{l.name}</div>
                          <div className="text-[10px] text-rose-600 numeric">
                            stuck {l.daysInStage}d
                          </div>
                        </div>
                      </button>
                    ))}
                  {filtered.filter((l) => l.daysInStage > 5).length === 0 && (
                    <div className="text-[11px] text-soft text-center py-4">No stuck leads</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-muted px-2">
          Drag-drop native HTML5 · POST <code className="kbd">/v1/leads/:id/transitions</code> with
          same-TX audit row · Sequence auto-advances · AI scores refresh every 15min.
        </div>
      </div>

      {/* Lead detail side panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-line2 shadow-2xl z-40 overflow-y-auto">
          <div className="sticky top-0 bg-surface border-b border-line2 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-success" />
              <div className="text-[13px] font-semibold text-ink">Lead detail</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
            >
              <X size={14} className="text-muted" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-ink/5 flex items-center justify-center">
                <User size={20} className="text-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-ink truncate">{selected.name}</div>
                <div className="text-[11px] text-muted truncate">{selected.address}</div>
                <div className="text-[11px] text-muted numeric mt-0.5">{selected.phone}</div>
              </div>
              <AiScoreBadge score={selected.aiScore} />
            </div>

            <div className="bg-accentSoft/30 border border-accent/20 rounded-lg p-3 flex items-start gap-2">
              <Sparkles size={13} className="text-accent shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-muted uppercase tracking-wider">AI suggests</div>
                <div className="text-[13px] text-ink font-medium mt-0.5">
                  {selected.aiSuggestion}
                </div>
              </div>
              <Button variant="primary" size="sm">
                Do it
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-paper border border-line2 rounded-lg p-3">
                <div className="text-[10px] text-muted uppercase tracking-wider">Value</div>
                <div className="text-[16px] font-semibold text-ink numeric mt-1">
                  <Money cents={selected.valueCents} region={region} />
                </div>
              </div>
              <div className="bg-paper border border-line2 rounded-lg p-3">
                <div className="text-[10px] text-muted uppercase tracking-wider">Days in stage</div>
                <div
                  className={`text-[16px] font-semibold numeric mt-1 ${selected.daysInStage > 5 ? 'text-rose-600' : 'text-ink'}`}
                >
                  {selected.daysInStage}d
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-section">Move to stage</div>
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_STAGES.map((s) => (
                  <button
                    key={s.status}
                    onClick={() => {
                      setLeads((prev) =>
                        prev.map((l) =>
                          l.id === selected.id ? { ...l, status: s.status, daysInStage: 0 } : l,
                        ),
                      );
                      setSelected((curr) =>
                        curr ? { ...curr, status: s.status, daysInStage: 0 } : null,
                      );
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${selected.status === s.status ? 'bg-ink text-surface' : 'bg-paper text-muted hover:bg-line2 hover:text-ink'}`}
                  >
                    {s.stage}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-section">Quick actions</div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" size="sm" leftIcon={<Phone size={12} />}>
                  Call
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={12} />}>
                  SMS
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Mail size={12} />}>
                  Email
                </Button>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              rightIcon={<ChevronRight size={14} />}
            >
              Open full lead journey
            </Button>

            <div className="pt-4 border-t border-line2">
              <PipelineLeadConversation />
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

function AiScoreBadge({ score }: { score: number }): JSX.Element {
  const tone =
    score >= 80
      ? 'text-success bg-successSoft'
      : score >= 60
        ? 'text-accent bg-accentSoft'
        : 'text-muted bg-line2';
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${tone}`}
      title={`AI lead score: ${score}/100`}
    >
      <Sparkles size={9} />
      <span className="numeric">{score}</span>
    </span>
  );
}

function Insight({
  icon: Icon,
  title,
  detail,
  action,
  tone,
}: {
  icon: typeof Bot;
  title: string;
  detail: string;
  action?: string;
  tone?: 'warn';
}): JSX.Element {
  return (
    <div className="p-4">
      <div className="flex items-start gap-2">
        <Icon
          size={13}
          className={`shrink-0 mt-0.5 ${tone === 'warn' ? 'text-warn' : 'text-accent'}`}
        />
        <div>
          <div className="text-[12px] font-semibold text-ink">{title}</div>
          <div className="text-[11px] text-muted mt-0.5">{detail}</div>
          {action && (
            <button className="mt-2 text-[11px] text-accent font-medium hover:underline">
              {action} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
