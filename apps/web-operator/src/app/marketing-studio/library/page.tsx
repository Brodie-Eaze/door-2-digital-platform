'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  FileCheck2,
  Check,
  Clock,
  X,
  Eye,
  Search,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { Banner, Button, FilterChip, FilterChipStrip, KpiCard, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { pickCreativeImage, inferTheme } from '@/lib/creative-images';
import { CreativeLibraryEmpty } from '@/components/MarketingEmptyStates';

/**
 * Creative library — every Creative row across HQ orgs, live from Prisma.
 *
 * The fixture version filtered by vertical/region/channel/ROAS/conversions —
 * none of that exists on the `Creative` model. The real columns are type,
 * prompt, model, costCents, safetyScanResult, c2paManifestId, approvedAt,
 * approvedBy. Filters below are rebuilt around what's actually queryable.
 */

interface LibraryCreative {
  id: string;
  account: string;
  type: string;
  prompt: string | null;
  model: string | null;
  modelVersion: string | null;
  costCents: string;
  safetyScanResult: unknown;
  c2paManifestId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
}

type ApprovalFilter = 'all' | 'approved' | 'awaiting';

function headline(c: LibraryCreative): string {
  return c.prompt && c.prompt.trim().length > 0 ? c.prompt : `Creative ${c.id}`;
}

function safetyLabel(result: unknown): { label: string; tone: 'success' | 'warn' | 'muted' } {
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (r.pass === true || r.status === 'pass') return { label: 'Pass', tone: 'success' };
    if (r.pass === false || r.status === 'fail') return { label: 'Flagged', tone: 'warn' };
  }
  return { label: 'Not scanned', tone: 'muted' };
}

const TYPE_OPTS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'copy', label: 'Copy' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
];

const APPROVAL_OPTS: Array<{ value: ApprovalFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'awaiting', label: 'Awaiting review' },
];

export default function CreativeLibraryPage(): JSX.Element {
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryCreative[]>([]);
  const [type, setType] = useState<string>('all');
  const [approval, setApproval] = useState<ApprovalFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketing/creatives', { method: 'GET' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { creatives?: LibraryCreative[] };
      setLibrary(Array.isArray(data.creatives) ? data.creatives : []);
      setLoadError(null);
      markFresh();
    } catch (err) {
      console.error('[creative-library] fetch failed:', err);
      setLoadError('Could not load the creative library — try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      library.filter((c) => {
        if (type !== 'all' && c.type !== type) return false;
        if (approval === 'approved' && !c.approvedAt) return false;
        if (approval === 'awaiting' && c.approvedAt) return false;
        if (query && !headline(c).toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [library, type, approval, query],
  );

  const opened = openId ? library.find((c) => c.id === openId) : null;
  const approvedCount = library.filter((c) => c.approvedAt).length;
  const awaitingCount = library.filter((c) => !c.approvedAt).length;
  const c2paCount = library.filter((c) => c.c2paManifestId).length;
  const totalCostCents = library.reduce((s, c) => s + BigInt(c.costCents || '0'), 0n);

  return (
    <PlatformShell pageTitle="Creative library">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="library" />
          <div className="flex items-center gap-2">
            {updatedAt && <DataSourceBadge source={source} updatedAt={updatedAt} />}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {loadError && (
          <Banner tone="warn">
            <span className="text-[13px]">{loadError}</span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ImageIcon size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{library.length} creatives</span> across all accounts
              · every row is a real <span className="font-semibold">Creative</span> record — filter
              by type or approval status, search the prompt.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={library.length} />
          <KpiCard label="Approved" value={approvedCount} deltaTone="positive" />
          <KpiCard label="Awaiting review" value={awaitingCount} />
          <KpiCard label="C2PA signed" value={c2paCount} hint={`of ${library.length}`} />
        </div>

        <Section title="Filters" subtitle="Live-filters the grid below">
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
                placeholder="Search prompt"
                className="text-[12px] pl-7 pr-3 py-1.5 rounded-full border border-line2 bg-paper text-ink w-[260px] focus:ring-1 focus:ring-accent focus:outline-none"
              />
            </div>
            <span className="w-px h-4 bg-line2 mx-1" />
            <FilterChipStrip label="Type">
              {TYPE_OPTS.map((opt) => (
                <FilterChip
                  key={opt.value}
                  active={type === opt.value}
                  onClick={() => setType(opt.value)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterChipStrip>
            <span className="w-px h-4 bg-line2 mx-1" />
            <FilterChipStrip label="Status">
              {APPROVAL_OPTS.map((opt) => (
                <FilterChip
                  key={opt.value}
                  active={approval === opt.value}
                  onClick={() => setApproval(opt.value)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterChipStrip>
            <div className="ml-auto text-[11px] text-muted">
              spend across library:{' '}
              <span className="text-ink font-semibold">
                ${(Number(totalCostCents) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </Section>

        <Section
          title={`Creatives · ${filtered.length}`}
          subtitle="Click a tile to inspect full metadata"
        >
          {loading ? (
            <div className="text-center py-12 text-[12.5px] text-muted">Loading…</div>
          ) : library.length === 0 ? (
            <CreativeLibraryEmpty />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[12.5px] text-muted">
              No creatives match your filters. Clear filters to see all {library.length}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((c) => (
                <LibraryCard key={c.id} creative={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </div>
          )}
        </Section>
      </div>

      {opened && <DetailDrawer creative={opened} onClose={() => setOpenId(null)} />}
    </PlatformShell>
  );
}

function LibraryCard({
  creative,
  onOpen,
}: {
  creative: LibraryCreative;
  onOpen: () => void;
}): JSX.Element {
  const safety = safetyLabel(creative.safetyScanResult);
  return (
    <div
      className="card overflow-hidden cursor-pointer transition hover:ring-1 hover:ring-accent"
      onClick={onOpen}
    >
      <div className="aspect-square relative overflow-hidden bg-paper">
        <img
          src={pickCreativeImage(
            inferTheme({ headline: headline(creative), copy: creative.prompt ?? '' }),
            creative.id,
            { w: 600, h: 600 },
          )}
          alt={headline(creative)}
          width={600}
          height={600}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
        <div className="absolute top-1.5 left-1.5">
          <span className="rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold bg-surface/95 backdrop-blur text-ink capitalize">
            {creative.type}
          </span>
        </div>
        {creative.c2paManifestId && (
          <div className="absolute top-1.5 right-1.5">
            <span
              className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
              title="C2PA signed"
            >
              <FileCheck2 size={9} /> C2PA
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <div className="text-surface text-[11.5px] font-semibold leading-snug drop-shadow-md line-clamp-2">
            {headline(creative)}
          </div>
        </div>
      </div>
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted">{creative.account}</span>
          <span className="text-ink font-semibold">
            ${(Number(BigInt(creative.costCents || '0')) / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium ${
              safety.tone === 'success'
                ? 'text-success'
                : safety.tone === 'warn'
                  ? 'text-warn'
                  : 'text-soft'
            }`}
          >
            {safety.tone === 'success' ? <Check size={10} /> : <Clock size={10} />}
            {safety.label}
          </span>
          {creative.approvedAt ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
              <Check size={10} /> approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted font-medium">
              <Eye size={10} /> awaiting
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({
  creative,
  onClose,
}: {
  creative: LibraryCreative;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
      <aside
        className="w-[480px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
          <div>
            <div className="text-[12.5px] font-semibold text-ink">{creative.id}</div>
            <div className="text-[10.5px] text-muted">{creative.account}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center text-soft"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="aspect-square relative overflow-hidden bg-paper rounded-lg">
            <img
              src={pickCreativeImage(
                inferTheme({ headline: headline(creative), copy: creative.prompt ?? '' }),
                creative.id,
                { w: 600, h: 600 },
              )}
              alt={headline(creative)}
              width={600}
              height={600}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-[13px] text-ink leading-snug">{headline(creative)}</div>
          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <Meta label="Type" value={creative.type} />
            <Meta label="Model" value={creative.model ?? '—'} />
            <Meta label="Model version" value={creative.modelVersion ?? '—'} />
            <Meta
              label="Cost"
              value={`$${(Number(BigInt(creative.costCents || '0')) / 100).toFixed(2)}`}
            />
            <Meta label="C2PA" value={creative.c2paManifestId ?? '—'} mono />
            <Meta label="Approved by" value={creative.approvedBy ?? '—'} />
          </div>
          <div className="pt-3 border-t border-line2 space-y-1.5 text-[11px] text-muted">
            <div className="flex items-center gap-1.5">
              <Calendar size={11} className="text-accent" />
              Created {new Date(creative.createdAt).toLocaleString()}
            </div>
            {creative.approvedAt && (
              <div className="flex items-center gap-1.5">
                <Check size={11} className="text-success" />
                Approved {new Date(creative.approvedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-[11.5px] font-semibold text-ink ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}
