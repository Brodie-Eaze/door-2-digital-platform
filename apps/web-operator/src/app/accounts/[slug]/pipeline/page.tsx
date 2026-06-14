'use client';

import { useMemo, useState, useEffect, useRef, type DragEvent } from 'react';
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
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE, type LeadStatus } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { PipelineLeadConversation } from '@/components/PipelineLeadConversation';
import { PipelineEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { accountData, PIPELINE_STAGES, type LeadRow } from '@/lib/account-fixtures';
import { firstRunSnapshot } from '@/lib/first-run';

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
    description: 'Knocker applicant funnel (high-churn)',
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

const AI_SUGGESTIONS = [
  'Call within 24h',
  'Send impact-story email',
  'Schedule callback Tue 3pm',
  'Move to high-priority queue',
  'Try alternate angle: monthly micro-donation',
  'Tag for VIP closer',
] as const;

// ────────────────────────────────────────────────────────────────────────────
// Live wire: GET /api/pipeline → { orgId, leads, updatedAt }. Lead shape below
// mirrors src/app/api/pipeline/route.ts exactly. PII: the route NEVER returns
// plaintext names — `label` ("Lead AB12") + `initials` are id-derived masks.
// ────────────────────────────────────────────────────────────────────────────

interface ApiPipelineLead {
  id: string;
  stage: string;
  status: string;
  stageLabel: string;
  vertical: string;
  label: string;
  initials: string;
  assigneeInitials: string | null;
  fromDoor: boolean;
  daysInStage: number;
  aiScore: number;
  createdAt: string;
  updatedAt: string;
}

const LEAD_STATUS_VALUES: readonly LeadRow['status'][] = [
  'new',
  'contacted',
  'qualified',
  'appointment_set',
  'converted',
  'lost',
  'do_not_contact',
];

function isLeadRowStatus(v: string): v is LeadRow['status'] {
  return (LEAD_STATUS_VALUES as readonly string[]).includes(v);
}

/** Same FNV-1a derivation the BFF route uses — stable per id across reloads. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Map a wire lead onto the board's card model. Fields the Lead table doesn't
 * carry yet (value, suggestion) are derived deterministically from the id —
 * stable across reloads, never random. Activity counts stay at honest zero
 * (no activity feed on this wire yet), and address/phone render as "—"
 * because they are vaulted PII the route never emits.
 */
function apiLeadToCard(l: ApiPipelineLead): PipelineLead | null {
  if (!isLeadRowStatus(l.status)) return null;
  const h = hashId(l.id);
  return {
    id: l.id,
    name: l.label, // masked, non-PII display label
    status: l.status,
    source: l.fromDoor ? 'door' : 'inside_sales',
    address: '—',
    phone: '—',
    assignee: l.assigneeInitials ?? '',
    tier: l.aiScore >= 80 ? 'high' : l.aiScore >= 60 ? 'medium' : 'low',
    capturedAt: l.createdAt,
    valueCents: BigInt((240 + (h % 1200)) * 100),
    daysInStage: l.daysInStage,
    aiScore: l.aiScore,
    aiSuggestion: AI_SUGGESTIONS[h % AI_SUGGESTIONS.length]!,
    activity: { calls: 0, sms: 0, emails: 0 },
  };
}

export default function PipelinePage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, leads: initialLeads } = accountData(params.slug);

  const initialEnriched: PipelineLead[] = useMemo(
    () =>
      initialLeads.map((l, i) => ({
        ...l,
        valueCents: BigInt((240 + ((i * 137) % 1200)) * 100),
        daysInStage: (i * 3) % 9,
        aiScore: 40 + ((i * 19) % 60),
        aiSuggestion: AI_SUGGESTIONS[i % AI_SUGGESTIONS.length]!,
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
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [quickAddStage, setQuickAddStage] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');
  const [quickAddAddress, setQuickAddAddress] = useState('');

  // Track whether the user is mid-drag — used to suppress click events on cards
  // so dropping doesn't accidentally re-open the side panel.
  const justDraggedRef = useRef(false);

  // ── Live data: fetch /api/pipeline once on mount; fall back to seed cards.
  // `isLive` gates persistence — seed ids don't exist in the DB, so demo-mode
  // stage moves stay local-only (the DEMO badge makes that honest).
  const freshness = useDataFreshness('fixture');
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/pipeline');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { leads?: ApiPipelineLead[]; updatedAt?: string };
        if (cancelled || !Array.isArray(data.leads) || data.leads.length === 0) return;
        const mapped = data.leads.map(apiLeadToCard).filter((l): l is PipelineLead => l !== null);
        if (mapped.length === 0) return;
        setLeads(mapped);
        setIsLive(true);
        freshness.markFresh();
      } catch {
        // Network/API failure — keep seed cards; badge stays DEMO DATA.
      }
    }

    void load();
    return (): void => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      justDraggedRef.current = true;
    };
  }
  function onDragEnd() {
    setDragId(null);
    setHoverStage(null);
    // Clear the "just dragged" flag after one tick so the synthetic click
    // (if any browser fires one) gets suppressed.
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 50);
  }
  function onDragOver(stage: LeadRow['status']) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setHoverStage(stage);
    };
  }
  /**
   * Persist a single-lead stage move via PATCH /api/pipeline/[id] { stage }.
   * Called AFTER the optimistic local move; on any non-OK / network failure
   * the move is surgically reverted (only the affected card) and the user is
   * told. Demo data (isLive=false) never hits the API — those ids aren't real.
   */
  async function persistSingleMove(
    id: string,
    stage: LeadRow['status'],
    prev: { status: LeadRow['status']; daysInStage: number },
  ): Promise<void> {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/pipeline/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Success: the drag/click feedback is enough — no toast. Server is in
      // sync with what's on screen, so the surface is fresh again.
      freshness.markFresh();
    } catch {
      setLeads((p) =>
        p.map((l) =>
          l.id === id ? { ...l, status: prev.status, daysInStage: prev.daysInStage } : l,
        ),
      );
      setSelected((curr) =>
        curr && curr.id === id
          ? { ...curr, status: prev.status, daysInStage: prev.daysInStage }
          : curr,
      );
      toast.error('Failed to move lead — reverted');
    }
  }

  /** Optimistic single-lead move shared by drag-drop and the side panel. */
  function moveLeadToStage(lead: PipelineLead, stage: LeadRow['status']): void {
    if (lead.status === stage) return;
    const prev = { status: lead.status, daysInStage: lead.daysInStage };
    setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, status: stage, daysInStage: 0 } : l)));
    setSelected((curr) =>
      curr && curr.id === lead.id ? { ...curr, status: stage, daysInStage: 0 } : curr,
    );
    void persistSingleMove(lead.id, stage, prev);
  }

  /** Quick-add: optimistically prepend a new lead card to local state. */
  function addQuickLead(): void {
    if (!quickAddStage) return;
    const name = quickAddName.trim();
    if (!name) {
      toast.error('Lead name is required');
      return;
    }
    const stage = quickAddStage as LeadRow['status'];
    const newLead: PipelineLead = {
      id: `local_${Date.now().toString(36)}`,
      name,
      status: stage,
      source: sourceFilter !== 'all' ? (sourceFilter as LeadRow['source']) : 'door',
      address: quickAddAddress.trim(),
      phone: quickAddPhone.trim(),
      assignee: 'Unassigned',
      tier: 'medium',
      capturedAt: new Date().toISOString(),
      valueCents: 0n,
      daysInStage: 0,
      aiScore: 0,
      aiSuggestion: AI_SUGGESTIONS[0],
      activity: { calls: 0, sms: 0, emails: 0 },
    };
    setLeads((p) => [newLead, ...p]);
    setQuickAddName('');
    setQuickAddPhone('');
    setQuickAddAddress('');
    setQuickAddStage(null);
    toast.success(`Added "${name}" — saved locally; server persistence lands in Phase 1.2`);
  }

  function onDrop(stage: LeadRow['status']) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) {
        const moved = leads.find((l) => l.id === id);
        if (moved) moveLeadToStage(moved, stage);
      }
      setDragId(null);
      setHoverStage(null);
    };
  }
  function onCardClick(l: PipelineLead) {
    return () => {
      // Suppress click if drag just happened
      if (justDraggedRef.current) return;
      setSelected(l);
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
  /**
   * Persist a bulk stage move via the collection-level PATCH /api/pipeline
   * { ids, stage } (one transaction server-side — better than N requests).
   * On failure every affected card reverts to its prior stage + days.
   */
  async function persistBulkMove(
    ids: string[],
    stage: LeadRow['status'],
    prevById: Map<string, { status: LeadRow['status']; daysInStage: number }>,
  ): Promise<void> {
    if (!isLive) return;
    const stageLabel = PIPELINE_STAGES.find((s) => s.status === stage)?.stage ?? stage;
    try {
      const res = await fetch('/api/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, stage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      freshness.markFresh();
      toast.success(`Moved ${ids.length} lead${ids.length === 1 ? '' : 's'} to ${stageLabel}`);
    } catch {
      setLeads((p) =>
        p.map((l) => {
          const prev = prevById.get(l.id);
          return prev ? { ...l, status: prev.status, daysInStage: prev.daysInStage } : l;
        }),
      );
      toast.error('Failed to move leads — reverted');
    }
  }

  function bulkMoveStage(stage: LeadRow['status']) {
    const targets = leads.filter((l) => selectedIds.has(l.id) && l.status !== stage);
    if (targets.length === 0) {
      clearSelection();
      return;
    }
    const prevById = new Map<string, { status: LeadRow['status']; daysInStage: number }>(
      targets.map((l) => [l.id, { status: l.status, daysInStage: l.daysInStage }]),
    );
    setLeads((prev) =>
      prev.map((l) => (prevById.has(l.id) ? { ...l, status: stage, daysInStage: 0 } : l)),
    );
    clearSelection();
    void persistBulkMove(
      targets.map((l) => l.id),
      stage,
      prevById,
    );
  }

  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelected(null);
        clearSelection();
        setAiPanelOpen(false);
      }
    }
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || initialLeads.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Pipeline">
        <div className="space-y-5 max-w-[1500px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <PipelineEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const PipelineIcon = PIPELINES[activePipeline].icon;
  const region = account.region === 'AU' ? 'AU' : 'US';

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Pipeline">
      <div className="space-y-4">
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

        {/* Compact KPI rail */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <KpiCard label="Open leads" value={totalOpen} hint={`${filtered.length} total`} />
          <KpiCard
            label="Open pipeline"
            value={<Money cents={totalValueOpen} region={region} />}
            delta="+18%"
            deltaTone="positive"
          />
          <KpiCard
            label="Weighted"
            value={<Money cents={weightedForecast} region={region} />}
            hint="probability-adjusted"
          />
          <KpiCard label="Win rate" value={`${winRate}%`} delta="+2pp" deltaTone="positive" />
          <KpiCard label="Avg AI score" value={avgAiScore} hint="0–100" />
          <KpiCard label="Avg cycle" value="4.2d" hint="capture → close" />
        </div>

        {/* Toolbar */}
        <div className="card !p-0">
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
            <DataSourceBadge source={freshness.source} updatedAt={freshness.updatedAt} />
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
              <button
                onClick={() =>
                  toast.info(
                    `Assign owner isn't wired to the API yet — ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'} left unchanged`,
                  )
                }
                className="hover:bg-surface/10 px-2 py-1 rounded text-[11px]"
              >
                Assign owner
              </button>
              <button
                onClick={() =>
                  toast.info(
                    `Lists aren't wired to the API yet — ${selectedIds.size} selected lead${selectedIds.size === 1 ? '' : 's'} left unchanged`,
                  )
                }
                className="hover:bg-surface/10 px-2 py-1 rounded text-[11px]"
              >
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
              <span className="font-semibold">{PIPELINES[activePipeline].name}.</span> Drag any card
              across columns — drop zones glow blue when ready. Click a card for chat &amp; detail.
              Hit <Bot size={11} className="inline" /> for AI insights.
            </span>
          </span>
        </Banner>

        {/* KANBAN — always full-width, horizontal scroll if needed */}
        {view === 'kanban' && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 580 }}>
            {stageAgg.map((s) => {
              const isHover = hoverStage === s.status;
              return (
                <div
                  key={s.status}
                  onDragOver={onDragOver(s.status)}
                  onDragLeave={(e) => {
                    // Only clear hover if we're leaving the column entirely
                    const rt = e.relatedTarget as Node | null;
                    if (!rt || !(e.currentTarget as Node).contains(rt)) setHoverStage(null);
                  }}
                  onDrop={onDrop(s.status)}
                  className={`flex flex-col shrink-0 w-[260px] rounded-xl border-2 transition ${isHover ? 'border-accent shadow-lg bg-accentSoft/40' : 'border-line2 bg-surface'}`}
                >
                  {/* Column header */}
                  <div className="px-3 py-3 border-b border-line2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'converted' || s.status === 'appointment_set' ? 'bg-success' : s.status === 'qualified' || s.status === 'contacted' ? 'bg-accent' : 'bg-soft'}`}
                        />
                        <div className="text-[13px] font-semibold text-ink tracking-tight truncate">
                          {s.stage}
                        </div>
                        <span className="mono !w-5 !h-5 !text-[10px]">{s.count}</span>
                      </div>
                      <button className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center shrink-0">
                        <MoreVertical size={13} className="text-soft" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-[13px] font-bold text-ink numeric">
                        <Money cents={s.totalCents} region={region} emptyAsDash />
                      </div>
                      <div className="text-[10px] text-muted numeric flex items-center gap-1">
                        <Clock size={9} /> ~{s.avgDaysInStage}d
                      </div>
                    </div>
                  </div>

                  {/* Cards drop zone */}
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
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={onDragStart(l.id)}
                          onDragEnd={onDragEnd}
                          onClick={onCardClick(l)}
                          className={`group relative bg-surface border border-line2 rounded-lg transition cursor-grab active:cursor-grabbing hover:shadow-md hover:border-line ${
                            isDragging ? 'opacity-30 scale-95 rotate-1' : ''
                          } ${isSelected ? 'ring-2 ring-accent border-accent' : ''}`}
                        >
                          <div
                            className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${tierColor}`}
                          />

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
                                  <span className="mono !w-4 !h-4 !text-[8px]">{l.assignee}</span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-medium numeric flex items-center gap-0.5 ${ageColor}`}
                              >
                                <Clock size={9} /> {l.daysInStage}d
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Always-visible drop zone helper inside column */}
                    {s.count === 0 && (
                      <div
                        className={`text-[11px] text-center py-12 border-2 border-dashed rounded-lg transition ${
                          isHover
                            ? 'border-accent bg-accentSoft/50 text-accent font-semibold'
                            : 'border-line2 text-soft'
                        }`}
                      >
                        {isHover ? '↓ Drop here ↓' : 'Drop leads here'}
                      </div>
                    )}
                    {s.count > 0 && isHover && (
                      <div className="text-[11px] text-center py-3 border-2 border-dashed border-accent rounded-lg bg-accentSoft/50 text-accent font-semibold">
                        ↓ Drop to {s.stage} ↓
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
                      <StatusPill tone={LEAD_STATUS_TONE[l.status as LeadStatus] ?? 'info'}>
                        {LEAD_STATUS_LABEL[l.status as LeadStatus] ?? l.status.replace('_', ' ')}
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
                  Number(stageAgg.reduce((m, x) => (x.totalCents > m ? x.totalCents : m), 0n)) || 1;
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

        <div className="text-[11px] text-muted px-2">
          Drag-drop native HTML5 · PATCH <code className="kbd">/api/pipeline/:id</code> persists the
          stage (optimistic, reverts on failure) · Names stay vaulted — cards show masked labels
          only.
        </div>
      </div>

      {/* AI insights OVERLAY (slides in from right, doesn't push kanban) */}
      {aiPanelOpen && (
        <>
          <div
            className="fixed inset-0 bg-transparent z-30"
            onClick={() => setAiPanelOpen(false)}
          />
          <div className="fixed top-14 right-0 bottom-0 w-[360px] bg-surface border-l border-line2 shadow-2xl z-40 overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-line2 px-4 py-3 flex items-center gap-2 z-10">
              <Bot size={14} className="text-accent" />
              <div className="text-[13px] font-semibold text-ink">AI insights</div>
              <div className="flex-1" />
              <button
                onClick={() => setAiPanelOpen(false)}
                className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
              >
                <X size={14} className="text-muted" />
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
                detail="Cohort with Day-1 video DM converts 38% vs 22% baseline. Trigger sequence?"
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
              <Button variant="secondary" size="sm" className="w-full" leftIcon={<Bot size={12} />}>
                Ask AI about pipeline
              </Button>
            </div>

            <div className="border-t border-line2">
              <div className="px-4 py-3">
                <div className="text-[12px] font-semibold text-ink">Aged &gt; 5 days</div>
              </div>
              <div className="divide-y divide-line2">
                {filtered
                  .filter((l) => l.daysInStage > 5)
                  .slice(0, 6)
                  .map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="w-full text-left px-4 py-2.5 hover:bg-paper transition flex items-center gap-2"
                    >
                      <Clock size={11} className="text-warn shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-ink truncate">{l.name}</div>
                        <div className="text-[10px] text-warn numeric">
                          {l.daysInStage}d in {l.status.replace('_', ' ')}
                        </div>
                      </div>
                    </button>
                  ))}
                {filtered.filter((l) => l.daysInStage > 5).length === 0 && (
                  <div className="text-[11px] text-soft text-center py-4">No aged leads</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lead detail side panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-line2 shadow-2xl z-50 overflow-y-auto">
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
                  className={`text-[16px] font-semibold numeric mt-1 ${selected.daysInStage > 5 ? 'text-warn' : 'text-ink'}`}
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
                    onClick={() => moveLeadToStage(selected, s.status)}
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

      {/* Quick add modal */}
      {quickAddStage && (
        <div
          className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
          onClick={() => setQuickAddStage(null)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold text-ink mb-4">
              Add lead to {PIPELINE_STAGES.find((s) => s.status === quickAddStage)?.stage}
            </div>
            <div className="space-y-2 mb-4">
              <input
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
                placeholder="Lead name"
                autoFocus
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addQuickLead();
                }}
              />
              <input
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
                placeholder="Phone"
                value={quickAddPhone}
                onChange={(e) => setQuickAddPhone(e.target.value)}
              />
              <input
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
                placeholder="Address"
                value={quickAddAddress}
                onChange={(e) => setQuickAddAddress(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuickAddName('');
                  setQuickAddPhone('');
                  setQuickAddAddress('');
                  setQuickAddStage(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={addQuickLead}>
                Add lead
              </Button>
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
