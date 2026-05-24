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
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { PipelineLeadConversation } from '@/components/PipelineLeadConversation';
import { accountData, PIPELINE_STAGES, type LeadRow } from '@/lib/account-fixtures';

interface PipelineLead extends LeadRow {
  valueCents: bigint;
  daysInStage: number;
}

const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'door', label: 'Door' },
  { value: 'inside_sales', label: 'Inside sales' },
  { value: 'retargeting', label: 'Retargeting' },
] as const;

const STAGE_META: Record<LeadRow['status'], { color: string; bg: string; border: string }> = {
  new: { color: 'text-soft', bg: 'bg-paper', border: 'border-line' },
  contacted: { color: 'text-accent', bg: 'bg-accentSoft', border: 'border-accent/30' },
  qualified: { color: 'text-accent', bg: 'bg-accentSoft', border: 'border-accent/40' },
  appointment_set: { color: 'text-success', bg: 'bg-successSoft', border: 'border-success/40' },
  converted: { color: 'text-success', bg: 'bg-successSoft', border: 'border-success/50' },
  lost: { color: 'text-soft', bg: 'bg-line2', border: 'border-line2' },
  do_not_contact: { color: 'text-soft', bg: 'bg-line2', border: 'border-line2' },
};

export default function PipelinePage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, leads: initialLeads } = accountData(params.slug);

  // Enrich with value + days-in-stage; persisted in local state
  const initialEnriched: PipelineLead[] = useMemo(
    () =>
      initialLeads.map((l, i) => ({
        ...l,
        valueCents: BigInt((240 + ((i * 137) % 1200)) * 100),
        daysInStage: (i * 3) % 8,
      })),
    [initialLeads],
  );
  const [leads, setLeads] = useState<PipelineLead[]>(initialEnriched);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selected, setSelected] = useState<PipelineLead | null>(null);
  const [view, setView] = useState<'kanban' | 'list' | 'forecast'>('kanban');

  // Filtered leads (drives both kanban + list view)
  const filtered = leads.filter((l) => {
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
    if (tierFilter !== 'all' && l.tier !== tierFilter) return false;
    return true;
  });

  // Per-stage aggregates
  const stageAgg = PIPELINE_STAGES.map((s) => {
    const stageLeads = filtered.filter((l) => l.status === s.status);
    const total = stageLeads.reduce((sum, l) => sum + l.valueCents, 0n);
    return { ...s, leads: stageLeads, count: stageLeads.length, totalCents: total };
  });

  // Overall pipeline KPIs
  const totalOpen = filtered.filter(
    (l) => l.status !== 'converted' && l.status !== 'lost' && l.status !== 'do_not_contact',
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
      if (id) {
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: stage, daysInStage: 0 } : l)),
        );
      }
      setDragId(null);
      setHoverStage(null);
    };
  }

  // Close detail panel on ESC
  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
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

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Pipeline">
      <div className="space-y-4 max-w-[1700px]">
        {/* Top metrics rail */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Open leads"
            value={totalOpen}
            hint={`${filtered.length} total · filtered`}
          />
          <KpiCard
            label="Open pipeline"
            value={<Money cents={totalValueOpen} region={account.region === 'AU' ? 'AU' : 'US'} />}
            delta="+18%"
            deltaTone="positive"
            hint="annual value"
          />
          <KpiCard
            label="Weighted forecast"
            value={
              <Money cents={weightedForecast} region={account.region === 'AU' ? 'AU' : 'US'} />
            }
            hint="stage probability"
          />
          <KpiCard
            label="Win rate"
            value={`${winRate}%`}
            delta="+2pp"
            deltaTone="positive"
            hint="L30D"
          />
          <KpiCard label="Avg cycle" value="4.2d" hint="capture → close" />
        </div>

        {/* Toolbar: view switcher + filters + actions */}
        <div className="card !p-0 sticky top-14 z-20">
          <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            {/* View switcher */}
            <div className="flex items-center bg-paper rounded-lg p-0.5 border border-line2">
              {[
                { v: 'kanban' as const, icon: LayoutGrid, label: 'Kanban' },
                { v: 'list' as const, icon: TableProperties, label: 'List' },
                { v: 'forecast' as const, icon: BarChart3, label: 'Forecast' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setView(opt.v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium tracking-tight transition ${
                    view === opt.v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  <opt.icon size={13} />
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-line2" />

            {/* Source filter */}
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              <span className="text-[11px] text-muted">Source</span>
              <div className="flex items-center gap-1">
                {SOURCE_FILTERS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSourceFilter(s.value)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      sourceFilter === s.value
                        ? 'bg-ink text-surface'
                        : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-6 w-px bg-line2" />

            {/* Tier filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">Tier</span>
              <div className="flex items-center gap-1">
                {['all', 'high', 'medium', 'low'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
                    className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition ${
                      tierFilter === t
                        ? 'bg-ink text-surface'
                        : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" leftIcon={<ArrowUpDown size={13} />}>
              Sort
            </Button>
            <Button variant="ghost" size="sm">
              Save view
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
              New lead
            </Button>
          </div>
        </div>

        <Banner tone="success">
          <span className="text-[13px]">
            <span className="font-semibold">Drag any card</span> between columns. Stage totals +
            weighted forecast update live. Click a card for the full lead detail panel.
          </span>
        </Banner>

        {/* KANBAN VIEW */}
        {view === 'kanban' && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 620 }}>
            {stageAgg.map((s) => {
              const meta = STAGE_META[s.status];
              const isHover = hoverStage === s.status;
              const region = account.region === 'AU' ? 'AU' : 'US';
              return (
                <div
                  key={s.status}
                  onDragOver={onDragOver(s.status)}
                  onDragLeave={() => setHoverStage(null)}
                  onDrop={onDrop(s.status)}
                  className={`flex flex-col shrink-0 w-[280px] rounded-xl border transition ${
                    isHover
                      ? 'border-accent shadow-lg bg-accentSoft/30'
                      : `${meta.border} bg-surface`
                  }`}
                >
                  {/* Column header */}
                  <div className="px-3 py-3 border-b border-line2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            s.status === 'converted'
                              ? 'bg-success'
                              : s.status === 'appointment_set'
                                ? 'bg-success'
                                : s.status === 'qualified'
                                  ? 'bg-accent'
                                  : s.status === 'contacted'
                                    ? 'bg-accent'
                                    : 'bg-soft'
                          }`}
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
                    <div className="text-[10px] text-muted mt-0.5 truncate">{s.description}</div>
                    <div className="mt-2 text-[14px] font-bold text-ink numeric">
                      <Money cents={s.totalCents} region={region} emptyAsDash />
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto bg-paper/30">
                    {s.leads.map((l) => {
                      const isDragging = dragId === l.id;
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
                          className={`group relative bg-surface border border-line2 rounded-lg transition cursor-grab active:cursor-grabbing hover:shadow-md hover:border-line ${
                            isDragging ? 'opacity-30 scale-95 rotate-1' : ''
                          }`}
                        >
                          {/* Tier left-border */}
                          <div
                            className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${tierColor}`}
                          />

                          <div className="p-3">
                            {/* Name + value */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-[12px] font-semibold text-ink leading-tight truncate flex-1">
                                {l.name}
                              </div>
                              <div className="text-[12px] font-bold text-ink numeric whitespace-nowrap">
                                <Money cents={l.valueCents} region={region} />
                              </div>
                            </div>

                            {/* Address */}
                            <div className="text-[10px] text-muted truncate mt-1 flex items-center gap-1">
                              <MapPin size={9} />
                              {l.address}
                            </div>

                            {/* Bottom row: source + assignee + age */}
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="tag !text-[9px] !px-1.5">
                                  {l.source.replace('_', ' ')}
                                </span>
                                {l.assignee && (
                                  <span className="mono !w-4 !h-4 !text-[8px]">{l.assignee}</span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-medium numeric flex items-center gap-0.5 ${ageColor}`}
                              >
                                <Clock size={9} /> {l.daysInStage}d
                              </span>
                            </div>

                            {/* Hover quick actions */}
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
                      <div
                        className={`text-[11px] text-soft text-center py-10 border border-dashed ${meta.border} rounded-lg`}
                      >
                        Drop leads here
                      </div>
                    )}
                  </div>

                  {/* Column footer — add lead */}
                  <button className="px-3 py-2 border-t border-line2 text-[11px] text-soft hover:text-ink hover:bg-paper transition flex items-center gap-1.5 justify-center">
                    <Plus size={12} />
                    Add lead to {s.stage}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="card !p-0">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Stage</th>
                  <th>Source</th>
                  <th>Value</th>
                  <th>Tier</th>
                  <th>Days in stage</th>
                  <th>Owner</th>
                  <th></th>
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
                      <span className="tag">{l.source.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <Money cents={l.valueCents} region={account.region === 'AU' ? 'AU' : 'US'} />
                    </td>
                    <td
                      className={`text-[12px] font-medium capitalize ${
                        l.tier === 'high'
                          ? 'text-success'
                          : l.tier === 'low'
                            ? 'text-soft'
                            : 'text-muted'
                      }`}
                    >
                      {l.tier}
                    </td>
                    <td className="numeric text-[13px]">{l.daysInStage}d</td>
                    <td>{l.assignee && <span className="mono">{l.assignee}</span>}</td>
                    <td>
                      <ChevronRight size={14} className="text-soft" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FORECAST VIEW */}
        {view === 'forecast' && (
          <div className="card card-pad">
            <div className="text-[13px] font-semibold text-ink mb-4">
              Pipeline forecast by stage
            </div>
            <div className="space-y-3">
              {stageAgg.map((s) => {
                const region = account.region === 'AU' ? 'AU' : 'US';
                const max =
                  Number(stageAgg.reduce((m, x) => (x.totalCents > m ? x.totalCents : m), 0n)) || 1;
                const pct = (Number(s.totalCents) / max) * 100;
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <div className="w-32 text-[12px] text-ink truncate">{s.stage}</div>
                    <div className="flex-1 h-7 bg-paper rounded relative overflow-hidden border border-line2">
                      <div
                        className={`h-full ${
                          s.status === 'converted'
                            ? 'bg-success'
                            : s.status === 'appointment_set'
                              ? 'bg-accent'
                              : s.status === 'qualified'
                                ? 'bg-accent/70'
                                : s.status === 'contacted'
                                  ? 'bg-accent/50'
                                  : 'bg-soft/50'
                        } transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-[11px] font-medium text-ink numeric mix-blend-difference text-surface">
                          <Money cents={s.totalCents} region={region} emptyAsDash /> · {s.count}{' '}
                          leads
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-line2 flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-[12px] text-muted">
                Weighted forecast (stage probability × value):
              </span>
              <span className="text-[14px] font-bold text-ink numeric">
                <Money cents={weightedForecast} region={account.region === 'AU' ? 'AU' : 'US'} />
              </span>
              <span className="text-[11px] text-success ml-auto flex items-center gap-1">
                <TrendingUp size={12} /> on track to close +22% vs LM
              </span>
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="text-[11px] text-muted px-2">
          Drag-drop wired with native HTML5 API · Backend writes{' '}
          <code className="kbd">POST /v1/leads/:id/transitions</code> with same-TX audit row ·
          Sequence auto-advances on stage change.
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-paper border border-line2 rounded-lg p-3">
                <div className="text-[10px] text-muted uppercase tracking-wider">Value</div>
                <div className="text-[16px] font-semibold text-ink numeric mt-1">
                  <Money
                    cents={selected.valueCents}
                    region={account.region === 'AU' ? 'AU' : 'US'}
                  />
                </div>
              </div>
              <div className="bg-paper border border-line2 rounded-lg p-3">
                <div className="text-[10px] text-muted uppercase tracking-wider">Days in stage</div>
                <div className="text-[16px] font-semibold text-ink numeric mt-1">
                  {selected.daysInStage}d
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-section">Attributes</div>
              <Row label="Stage">
                <StatusPill tone="info">{selected.status.replace('_', ' ')}</StatusPill>
              </Row>
              <Row label="Source">
                <span className="tag">{selected.source.replace('_', ' ')}</span>
              </Row>
              <Row label="Tier">
                <span
                  className={`text-[12px] font-medium capitalize ${
                    selected.tier === 'high'
                      ? 'text-success'
                      : selected.tier === 'low'
                        ? 'text-soft'
                        : 'text-muted'
                  }`}
                >
                  {selected.tier}
                </span>
              </Row>
              <Row label="Owner">
                {selected.assignee ? (
                  <span className="mono">{selected.assignee}</span>
                ) : (
                  <span className="text-soft text-[12px]">Unassigned</span>
                )}
              </Row>
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
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      selected.status === s.status
                        ? 'bg-ink text-surface'
                        : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                    }`}
                  >
                    {s.stage}
                  </button>
                ))}
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

            {/* Team conversation thread — chat + poll + multi-user */}
            <div className="pt-4 border-t border-line2">
              <PipelineLeadConversation />
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}
