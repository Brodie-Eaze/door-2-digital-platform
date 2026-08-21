'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, RefreshCw, Info } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { pickCreativeImage, inferTheme } from '@/lib/creative-images';
import { BrandSafetyEmpty } from '@/components/MarketingEmptyStates';

/**
 * Brand-safety control room.
 *
 * There is no RulePack, SafetyBlock, CustomRule, or LegalHold model in the
 * schema — only `Creative.safetyScanResult` (a Json column written by
 * whatever scanner ran, shape not enforced). This page reads that real column
 * across every Creative row rather than inventing rule packs / legal-hold
 * queues that have no backing table. Per-vertical rule packs and legal-hold
 * routing are roadmap items — the banner below says so honestly instead of
 * rendering fabricated rule cards.
 */

interface SafetyCreative {
  id: string;
  account: string;
  type: string;
  prompt: string | null;
  model: string | null;
  safetyScanResult: unknown;
  approvedAt: string | null;
  createdAt: string;
}

type SafetyState = 'pass' | 'flagged' | 'not_scanned';

function headline(c: SafetyCreative): string {
  return c.prompt && c.prompt.trim().length > 0 ? c.prompt : `Creative ${c.id}`;
}

function safetyState(result: unknown): SafetyState {
  if (result && typeof result === 'object' && Object.keys(result).length > 0) {
    const r = result as Record<string, unknown>;
    if (r.pass === true || r.status === 'pass') return 'pass';
    if (r.pass === false || r.status === 'fail' || r.status === 'review') return 'flagged';
  }
  return 'not_scanned';
}

function stateTone(s: SafetyState): 'success' | 'warn' | 'muted' {
  return s === 'pass' ? 'success' : s === 'flagged' ? 'warn' : 'muted';
}

function stateLabel(s: SafetyState): string {
  return s === 'pass' ? 'Pass' : s === 'flagged' ? 'Flagged' : 'Not scanned';
}

export default function BrandSafetyPage(): JSX.Element {
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<SafetyCreative[]>([]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketing/creatives', { method: 'GET' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { creatives?: SafetyCreative[] };
      setCreatives(Array.isArray(data.creatives) ? data.creatives : []);
      setLoadError(null);
      markFresh();
    } catch (err) {
      console.error('[brand-safety] fetch failed:', err);
      setLoadError('Could not load safety scan data — try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const withState = useMemo(
    () => creatives.map((c) => ({ ...c, state: safetyState(c.safetyScanResult) })),
    [creatives],
  );
  const passCount = withState.filter((c) => c.state === 'pass').length;
  const flaggedCount = withState.filter((c) => c.state === 'flagged').length;
  const unscannedCount = withState.filter((c) => c.state === 'not_scanned').length;
  const flagged = withState.filter((c) => c.state === 'flagged');

  return (
    <PlatformShell pageTitle="Brand safety control room">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="brand-safety" />
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
            <ShieldCheck size={14} className="text-accent" />
            <span>
              Reading <span className="font-semibold">Creative.safetyScanResult</span> across every
              account. Per-vertical rule packs, a custom-rule engine, and a legal-hold routing queue
              are on the roadmap but have no backing model yet — this page will not fabricate them.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total creatives" value={creatives.length} />
          <KpiCard label="Passed scan" value={passCount} deltaTone="positive" />
          <KpiCard
            label="Flagged"
            value={flaggedCount}
            deltaTone={flaggedCount > 0 ? 'negative' : undefined}
          />
          <KpiCard label="Not yet scanned" value={unscannedCount} />
        </div>

        <Section
          title={`Flagged creatives · ${flagged.length}`}
          subtitle="safetyScanResult.status = fail | review"
          paddedBody={false}
        >
          {loading ? (
            <div className="text-center py-12 text-[12.5px] text-muted">Loading…</div>
          ) : creatives.length === 0 ? (
            <BrandSafetyEmpty />
          ) : flagged.length === 0 ? (
            <div className="text-center py-12 text-[12.5px] text-muted flex flex-col items-center gap-2">
              <CheckCircle2 size={18} className="text-success" />
              No flagged creatives right now.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Creative</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((c) => (
                  <tr key={c.id}>
                    <td className="!pr-0 w-[60px]">
                      <div className="w-12 h-12 rounded-md overflow-hidden border border-line2 bg-paper relative">
                        <img
                          src={pickCreativeImage(
                            inferTheme({ headline: headline(c), copy: c.prompt ?? '' }),
                            c.id,
                            { w: 96, h: 96 },
                          )}
                          alt={headline(c)}
                          width={48}
                          height={48}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-warn/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <AlertTriangle size={14} className="text-surface drop-shadow" />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-[12.5px] font-medium text-ink leading-snug line-clamp-2">
                        {headline(c)}
                      </div>
                      <div className="text-[10px] text-muted font-mono">{c.id}</div>
                    </td>
                    <td className="text-[12px] text-ink">{c.account}</td>
                    <td className="text-[12px] text-muted capitalize">{c.type}</td>
                    <td className="text-[11px] text-muted font-mono">{c.model ?? '—'}</td>
                    <td>
                      <StatusPill tone={stateTone(c.state)}>{stateLabel(c.state)}</StatusPill>
                    </td>
                    <td className="text-[11px] text-muted numeric">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {!loading && creatives.length > 0 && (
          <Section title="All creatives · scan status" paddedBody={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Creative</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Approval</th>
                  <th>Scan status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {withState.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="text-[12px] text-ink leading-snug line-clamp-1">
                        {headline(c)}
                      </div>
                      <div className="text-[10px] text-muted font-mono">{c.id}</div>
                    </td>
                    <td className="text-[12px] text-ink">{c.account}</td>
                    <td className="text-[12px] text-muted capitalize">{c.type}</td>
                    <td>
                      {c.approvedAt ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success">
                          <CheckCircle2 size={11} /> approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                          <Clock size={11} /> pending
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusPill tone={stateTone(c.state)}>{stateLabel(c.state)}</StatusPill>
                    </td>
                    <td className="text-[11px] text-muted numeric">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <div className="flex items-start gap-2 text-[11px] text-muted border border-line2 rounded-md p-3">
          <Info size={13} className="text-soft shrink-0 mt-0.5" />
          <span>
            Rule packs (per vertical × jurisdiction), a custom regex/LLM-judge rule engine, and a
            counsel-routed legal-hold queue are described in the master plan but have no Prisma
            model yet. When they ship, this page reads their real tables — it will not show sample
            rule cards or block counts in the meantime.
          </span>
        </div>
      </div>
    </PlatformShell>
  );
}
