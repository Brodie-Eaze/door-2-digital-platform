'use client';

/**
 * Per-account creative library — real Creative rows. The schema has no
 * channel/format/status(draft|review|approved|published|blocked)/spend/
 * conversions/ROAS fields on Creative — only type, prompt, model, cost,
 * safetyScanResult, c2paManifestId, and approvedAt/By. Status here is
 * derived honestly: approved (approvedAt set) vs pending (not yet).
 * Approve/reject remain disclosed toast placeholders until the review-write
 * path ships.
 *
 * Live wire: GET /api/orgs/[slug]/marketing/creatives (resolveAccountOrg-scoped).
 */
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, FileCheck2, Check, X, Search } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingLibraryEmpty } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface ApiCreative {
  id: string;
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

type TypeFilter = 'all' | string;

function scanFailed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const pass = (result as { pass?: unknown }).pass;
  return pass === false;
}

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const firstRun = firstRunSnapshot(params.slug);
  const [creatives, setCreatives] = useState<ApiCreative[] | null>(null);
  const [region, setRegion] = useState<'AU' | 'US' | 'SG'>('US');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/marketing/creatives`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load the library — please retry.');
        setCreatives([]);
        return;
      }
      const json = (await res.json()) as {
        creatives: ApiCreative[];
        org?: { regionCode?: 'AU' | 'US' | 'SG' };
      };
      setCreatives(json.creatives);
      if (json.org?.regionCode) setRegion(json.org.regionCode);
    } catch {
      setLoadError('Could not load the library — please retry.');
      setCreatives([]);
    }
  }, [params.slug]);

  useEffect(() => {
    // W3 fix: no longer gated on the fixture-keyed firstRunSnapshot — see
    // brand-safety/page.tsx for the full rationale. Real "empty" is decided
    // below from `rows.length === 0` (the actual API result).
    void load();
  }, [load]);

  const rows = creatives ?? [];
  const types = useMemo(() => Array.from(new Set(rows.map((c) => c.type))), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (type !== 'all' && c.type !== type) return false;
      if (query && !(c.prompt ?? '').toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [rows, type, query]);

  const opened = openId ? rows.find((c) => c.id === openId) : null;
  const approved = rows.filter((c) => c.approvedAt !== null).length;
  const pending = rows.length - approved;
  const totalCost = rows.reduce((s, c) => s + BigInt(c.costCents), 0n);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Library">
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="library" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ImageIcon size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{rows.length} creatives</span> in the library, C2PA
              status and safety scan shown as recorded on each row.
            </span>
          </span>
        </Banner>

        {loadError ? (
          <div className="card card-pad text-center py-8">
            <div className="text-[13px] text-ink mb-2" role="alert">
              {loadError}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : creatives === null ? (
          <div className="card card-pad text-center py-10 text-[12px] text-muted">
            Loading library…
          </div>
        ) : rows.length === 0 ? (
          <MarketingLibraryEmpty
            slug={params.slug}
            accountName={firstRun.accountName}
            placement="page"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total" value={rows.length} />
              <KpiCard label="Approved" value={approved} deltaTone="positive" />
              <KpiCard label="Pending" value={pending} />
              <KpiCard label="Total AI spend" value={<Money cents={totalCost} region={region} />} />
            </div>

            <Section
              title="Filters"
              subtitle={`${types.length} creative type${types.length === 1 ? '' : 's'} in this library`}
            >
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
                    className="text-[12px] pl-7 pr-3 py-1.5 rounded-full border border-line2 bg-paper text-ink w-[240px] focus:ring-1 focus:ring-accent focus:outline-none"
                  />
                </div>
                <Pill label="All types" active={type === 'all'} onClick={() => setType('all')} />
                {types.map((t) => (
                  <Pill key={t} label={t} active={type === t} onClick={() => setType(t)} />
                ))}
                <div className="ml-auto">
                  <DataSourceBadge source="live" />
                </div>
              </div>
            </Section>

            <Section
              title={`Creatives · ${filtered.length}`}
              subtitle="Click a row to inspect"
              paddedBody={false}
            >
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-[12.5px] text-muted">
                  No creatives match your filters.
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Prompt</th>
                      <th>Type</th>
                      <th>Model</th>
                      <th>Cost</th>
                      <th>C2PA</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer hover:bg-paper"
                        onClick={() => setOpenId(c.id)}
                      >
                        <td>
                          <div className="text-[12.5px] font-medium text-ink leading-snug line-clamp-1">
                            {c.prompt ?? '—'}
                          </div>
                          <div className="text-[10px] text-muted font-mono">{c.id}</div>
                        </td>
                        <td className="text-[12px] text-muted capitalize">{c.type}</td>
                        <td className="text-[11px] text-muted mono">{c.model ?? '—'}</td>
                        <td className="text-[12px] text-ink">
                          <Money cents={BigInt(c.costCents)} region={region} emptyAsDash />
                        </td>
                        <td>
                          {c.c2paManifestId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-success">
                              <FileCheck2 size={10} /> signed
                            </span>
                          ) : (
                            <span className="text-soft text-[10px]">—</span>
                          )}
                        </td>
                        <td>
                          {scanFailed(c.safetyScanResult) ? (
                            <StatusPill tone="danger">safety failed</StatusPill>
                          ) : c.approvedAt ? (
                            <StatusPill tone="success">approved</StatusPill>
                          ) : (
                            <StatusPill tone="muted">pending</StatusPill>
                          )}
                        </td>
                        <td className="text-[11px] text-muted">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </>
        )}
      </div>

      {opened && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpenId(null)}>
          <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
          <aside
            className="w-[480px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
              <div>
                <div className="text-[12.5px] font-semibold text-ink">{opened.id}</div>
                <div className="text-[10.5px] text-muted">{opened.type}</div>
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
              <div className="text-[12px] text-ink leading-snug">{opened.prompt ?? '—'}</div>
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <Meta label="Model" value={opened.model ?? '—'} />
                <Meta label="Model version" value={opened.modelVersion ?? '—'} />
                <Meta
                  label="Cost"
                  value={<Money cents={BigInt(opened.costCents)} region={region} emptyAsDash />}
                />
                <Meta label="Created" value={new Date(opened.createdAt).toLocaleString()} />
                <Meta label="C2PA manifest" value={opened.c2paManifestId ?? '—'} />
                <Meta label="Approved by" value={opened.approvedBy ?? '—'} />
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
                  Safety scan result
                </div>
                <pre className="text-[10px] font-mono text-ink bg-paper border border-line2 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(opened.safetyScanResult, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-line2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Check size={12} />}
                  onClick={() => toast.info("Approve isn't wired yet — no change was made.")}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X size={12} />}
                  onClick={() => toast.info("Reject isn't wired yet — no change was made.")}
                >
                  Reject
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

function Meta({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11.5px] font-semibold text-ink">{value}</div>
    </div>
  );
}
