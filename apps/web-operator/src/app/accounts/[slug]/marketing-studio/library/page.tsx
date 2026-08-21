'use client';

import { use, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  Plus,
  FileCheck2,
  Check,
  X,
  Eye,
  Search,
  Download,
  Send,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingLibraryEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';
import {
  getAccountMarketing,
  CHANNEL_LABEL,
  CHANNEL_BADGE,
  type Channel,
  type CreativeStatus,
} from '@/lib/account-marketing';
import { pickCreativeImage } from '@/lib/creative-images';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

/**
 * Per-account creative library — only this account's creatives, filtered
 * by channel/status/free-text search. Images come from /creative-bank/
 * via pickCreativeImage(creative.theme, creative.id) so every tile maps
 * to a theme that's appropriate for this account's vertical.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

const STATUS_OPTS: Array<{ value: CreativeStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All status' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'blocked', label: 'Blocked' },
];

function statusTone(s: CreativeStatus): 'success' | 'info' | 'warn' | 'danger' | 'muted' {
  switch (s) {
    case 'published':
      return 'success';
    case 'approved':
      return 'info';
    case 'review':
      return 'warn';
    case 'blocked':
      return 'danger';
    case 'draft':
      return 'muted';
  }
}

export default function Page({ params: paramsPromise }: PageProps): JSX.Element {
  const params = use(paramsPromise);
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);

  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [status, setStatus] = useState<CreativeStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, CreativeStatus>>({});

  function approveCreative(id: string, headline: string): void {
    setStatusOverrides((prev) => ({ ...prev, [id]: 'approved' }));
    toast.success(`Approved "${headline}" — marked approved locally (publish wiring: Phase 1.2)`);
  }

  function rejectCreative(id: string, headline: string): void {
    setStatusOverrides((prev) => ({ ...prev, [id]: 'blocked' }));
    toast.success(`Rejected "${headline}" — marked blocked locally (publish wiring: Phase 1.2)`);
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.creatives.filter((c) => {
      if (channel !== 'all' && c.channel !== channel) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!c.headline.toLowerCase().includes(q) && !c.copy.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [data, channel, status, query]);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || !data || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Library">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <MarketingLibraryEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const opened = openId ? data.creatives.find((c) => c.id === openId) : null;
  const drafts = data.creatives.filter((c) => c.status === 'draft').length;
  const reviews = data.creatives.filter((c) => c.status === 'review').length;
  const approved = data.creatives.filter((c) => c.status === 'approved').length;
  const published = data.creatives.filter((c) => c.status === 'published').length;
  const blocked = data.creatives.filter((c) => c.status === 'blocked').length;
  const totalSpend = data.creatives.reduce((s, c) => s + c.spendCents, 0);

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered(): void {
    if (filtered.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const selectedCount = selectedIds.size;
  const channelOpts: Array<{ value: Channel | 'all'; label: string }> = [
    { value: 'all', label: 'All channels' },
    ...data.channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] })),
  ];

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Library`}
    >
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="library" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ImageIcon size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.creatives.length} creatives</span> in the{' '}
              <span className="font-semibold">{data.scopeLabel}</span> library — all signed with
              C2PA, all scoped to this account&apos;s {data.vertical} vertical and {data.region}{' '}
              regulatory stack.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total" value={data.creatives.length} />
          <KpiCard label="Drafts" value={drafts} />
          <KpiCard label="In review" value={reviews} deltaTone="negative" />
          <KpiCard label="Approved" value={approved} deltaTone="positive" />
          <KpiCard label="Published" value={published} deltaTone="positive" />
          <KpiCard label="Blocked" value={blocked} deltaTone="negative" />
        </div>

        <Section
          title="Filters & bulk actions"
          subtitle={`Channels available to ${account.shortName}: ${data.channels.map((c) => CHANNEL_LABEL[c]).join(' · ')}`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft pointer-events-none"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search headline or copy"
                  className="text-[12px] pl-7 pr-3 py-1.5 rounded-full border border-line2 bg-paper text-ink w-[260px] focus:ring-1 focus:ring-accent focus:outline-none"
                />
              </div>
              <span className="w-px h-4 bg-line2 mx-1" />
              {channelOpts.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  active={channel === opt.value}
                  onClick={() => setChannel(opt.value)}
                />
              ))}
              <span className="w-px h-4 bg-line2 mx-1" />
              {STATUS_OPTS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  active={status === opt.value}
                  onClick={() => setStatus(opt.value)}
                />
              ))}
              <div className="ml-auto flex items-center gap-2">
                <DataSourceBadge source="fixture" />
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={13} />}
                  onClick={() => toast.info('New creative builder — wiring lands in Phase 1.2')}
                >
                  New creative
                </Button>
              </div>
            </div>
            <div className="pt-3 border-t border-line2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-[11.5px] text-muted">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={selectAllFiltered}
                    className="accent-accent"
                  />
                  <span>
                    {selectedCount > 0
                      ? `${selectedCount} of ${filtered.length} selected`
                      : `Select all ${filtered.length}`}
                  </span>
                </label>
                <span className="text-soft">·</span>
                <span>
                  spend across library:{' '}
                  <span className="text-ink font-semibold">
                    <Money cents={BigInt(totalSpend)} region={data.region} />
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Send size={13} />}
                  disabled={selectedCount === 0}
                  onClick={() => {
                    setStatusOverrides((prev) => {
                      const next = { ...prev };
                      selectedIds.forEach((id) => {
                        next[id] = 'review';
                      });
                      return next;
                    });
                    toast.success(
                      `${selectedCount} creative${selectedCount === 1 ? '' : 's'} sent to review locally (publish wiring: Phase 1.2)`,
                    );
                  }}
                >
                  Send to review
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Check size={13} />}
                  disabled={selectedCount === 0}
                  onClick={() => {
                    setStatusOverrides((prev) => {
                      const next = { ...prev };
                      selectedIds.forEach((id) => {
                        next[id] = 'approved';
                      });
                      return next;
                    });
                    toast.success(
                      `${selectedCount} creative${selectedCount === 1 ? '' : 's'} approved locally (publish wiring: Phase 1.2)`,
                    );
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Download size={13} />}
                  disabled={selectedCount === 0}
                  onClick={() =>
                    toast.info(
                      `Export ${selectedCount} creative${selectedCount === 1 ? '' : 's'} — wiring lands in Phase 1.2`,
                    )
                  }
                >
                  Export
                </Button>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title={`Creatives · ${filtered.length}`}
          subtitle={`Scoped to ${account.shortName} · click a tile to inspect`}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[12.5px] text-muted">
              No creatives match your filters. Clear filters to see all {data.creatives.length}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className={`card overflow-hidden cursor-pointer transition relative ${
                    selectedIds.has(c.id) ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-accent'
                  }`}
                  onClick={() => setOpenId(c.id)}
                >
                  <div className="aspect-[4/5] relative overflow-hidden bg-paper">
                    <img
                      src={pickCreativeImage(c.theme, c.id)}
                      alt={c.headline}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-accent"
                      />
                      <span
                        className={`rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold ${CHANNEL_BADGE[c.channel]}`}
                      >
                        {CHANNEL_LABEL[c.channel]}
                      </span>
                    </div>
                    <div className="absolute top-1.5 right-1.5">
                      <span
                        className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
                        title="C2PA signed"
                      >
                        <FileCheck2 size={9} /> C2PA
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <div className="text-surface text-[11.5px] font-semibold leading-snug drop-shadow-md line-clamp-2">
                        {c.headline}
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <div className="text-[10.5px] text-muted line-clamp-2 leading-snug">
                      {c.copy}
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-line2 text-[10px]">
                      <span className="text-muted capitalize">
                        {data.vertical} · {c.format}
                      </span>
                      {c.roas > 0 ? (
                        <span className="text-success font-semibold">{c.roas.toFixed(1)}x</span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <StatusPill tone={statusTone(statusOverrides[c.id] ?? c.status)}>
                        {statusOverrides[c.id] ?? c.status}
                      </StatusPill>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            approveCreative(c.id, c.headline);
                          }}
                          className="w-5 h-5 rounded hover:bg-successSoft flex items-center justify-center text-success"
                          title="Approve"
                        >
                          <Check size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectCreative(c.id, c.headline);
                          }}
                          className="w-5 h-5 rounded hover:bg-dangerSoft flex items-center justify-center text-danger"
                          title="Reject"
                        >
                          <X size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(c.id);
                          }}
                          className="w-5 h-5 rounded hover:bg-paper flex items-center justify-center text-soft"
                          title="Inspect"
                        >
                          <Eye size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {opened && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpenId(null)}>
          <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
          <aside
            className="w-[520px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
              <div>
                <div className="text-[12.5px] font-semibold text-ink">{opened.id}</div>
                <div className="text-[10.5px] text-muted">
                  {account.shortName} · {data.vertical} · {data.region}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center text-soft"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="aspect-[4/5] relative overflow-hidden bg-paper rounded-lg">
                <img
                  src={pickCreativeImage(opened.theme, opened.id)}
                  alt={opened.headline}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-ink leading-snug">
                  {opened.headline}
                </div>
                <div className="text-[12px] text-muted mt-1 leading-snug">{opened.copy}</div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <DrawerMetric label="Conversions" value={opened.conversions.toString()} />
                <DrawerMetric
                  label="ROAS"
                  value={opened.roas > 0 ? `${opened.roas.toFixed(1)}x` : '—'}
                />
                <DrawerMetric
                  label="Spend"
                  value={
                    opened.spendCents > 0 ? (
                      <Money cents={BigInt(opened.spendCents)} region={data.region} />
                    ) : (
                      '—'
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <Meta label="Channel" value={CHANNEL_LABEL[opened.channel]} />
                <Meta label="Format" value={opened.format} />
                <Meta label="Status" value={opened.status} />
                <Meta label="Theme" value={opened.theme} />
                <Meta label="Conv %" value={`${opened.convRate.toFixed(2)}%`} />
                <Meta label="Live since" value={opened.liveAt ?? '—'} />
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-line2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Check size={12} />}
                  onClick={() => approveCreative(opened.id, opened.headline)}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X size={12} />}
                  onClick={() => rejectCreative(opened.id, opened.headline)}
                >
                  Reject
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Send size={12} />}
                  onClick={() => {
                    setStatusOverrides((prev) => ({ ...prev, [opened.id]: 'review' }));
                    toast.success(
                      `"${opened.headline}" sent to review locally (publish wiring: Phase 1.2)`,
                    );
                  }}
                >
                  Send to review
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AccountShell>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface transition'
          : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full border border-line2 text-muted hover:text-ink hover:border-soft transition'
      }
    >
      {label}
    </button>
  );
}

function DrawerMetric({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="border border-line2 rounded-md p-2">
      <div className="text-[9.5px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">{value}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11.5px] font-semibold text-ink capitalize">{value}</div>
    </div>
  );
}
