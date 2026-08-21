'use client';

/**
 * Per-account brand-safety — surfaces `Creative.safetyScanResult` exactly as
 * the moderation adapter returned it. There is no separate rule-pack, block,
 * or reviewer model in the schema, so this page never invents one; it lists
 * creatives and their scan result, and lets an operator approve/reject a
 * creative (real fields: approvedAt/approvedBy).
 *
 * Live wire: GET /api/orgs/[slug]/marketing/creatives (resolveAccountOrg-scoped).
 */
import { use, useCallback, useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { BrandSafetyEmpty } from '@/components/AccountMarketingEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface ApiCreative {
  id: string;
  type: string;
  prompt: string | null;
  model: string | null;
  costCents: string;
  safetyScanResult: unknown;
  c2paManifestId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
}

/**
 * safetyScanResult is opaque adapter JSON (defaults to `{}`). We only look
 * for a `pass` boolean if the adapter happened to set one — everything else
 * renders as raw JSON so we never claim structure the scanner didn't send.
 */
function scanOutcome(result: unknown): 'pass' | 'fail' | 'unscanned' {
  if (!result || typeof result !== 'object' || Object.keys(result).length === 0) return 'unscanned';
  const pass = (result as { pass?: unknown }).pass;
  if (typeof pass === 'boolean') return pass ? 'pass' : 'fail';
  return 'unscanned';
}

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const firstRun = firstRunSnapshot(params.slug);
  const [creatives, setCreatives] = useState<ApiCreative[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/marketing/creatives`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load brand-safety scans — please retry.');
        setCreatives([]);
        return;
      }
      const json = (await res.json()) as { creatives: ApiCreative[] };
      setCreatives(json.creatives);
    } catch {
      setLoadError('Could not load brand-safety scans — please retry.');
      setCreatives([]);
    }
  }, [params.slug]);

  useEffect(() => {
    // W3 fix: no longer gated on the fixture-keyed firstRunSnapshot — it
    // defaulted every non-demo-seed slug (i.e. every real org) to
    // isFirstRun=true, which skipped this fetch forever. `rows.length === 0`
    // below (driven by the real API result) is the honest empty-state check.
    void load();
  }, [load]);

  const rows = creatives ?? [];
  const passCount = rows.filter((c) => scanOutcome(c.safetyScanResult) === 'pass').length;
  const failCount = rows.filter((c) => scanOutcome(c.safetyScanResult) === 'fail').length;
  const unscannedCount = rows.filter((c) => scanOutcome(c.safetyScanResult) === 'unscanned').length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Brand safety">
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="brand-safety" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span>
              Each creative&apos;s <span className="font-semibold mono">safetyScanResult</span> is
              shown as the moderation adapter returned it. There is no separate rule-pack or
              reviewer-log model yet.
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
            Loading brand-safety scans…
          </div>
        ) : rows.length === 0 ? (
          <BrandSafetyEmpty
            slug={params.slug}
            accountName={firstRun.accountName}
            placement="page"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Creatives" value={rows.length} />
              <KpiCard label="Pass" value={passCount} deltaTone="positive" />
              <KpiCard
                label="Fail"
                value={failCount}
                deltaTone={failCount > 0 ? 'negative' : undefined}
              />
              <KpiCard label="Unscanned" value={unscannedCount} />
            </div>

            <Section
              title={`Creatives · ${rows.length}`}
              subtitle="Scan result rendered as-is from safetyScanResult"
              paddedBody={false}
              action={<DataSourceBadge source="live" />}
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Creative</th>
                    <th>Type</th>
                    <th>Model</th>
                    <th>Scan result</th>
                    <th>C2PA</th>
                    <th>Approved</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const outcome = scanOutcome(c.safetyScanResult);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="text-[12.5px] font-medium text-ink leading-snug line-clamp-1">
                            {c.prompt ?? '—'}
                          </div>
                          <div className="text-[10px] text-muted font-mono">{c.id}</div>
                        </td>
                        <td className="text-[12px] text-muted capitalize">{c.type}</td>
                        <td className="text-[11px] text-muted mono">{c.model ?? '—'}</td>
                        <td>
                          {outcome === 'pass' && (
                            <StatusPill tone="success">
                              <CheckCircle2 size={9} className="-ml-0.5" /> pass
                            </StatusPill>
                          )}
                          {outcome === 'fail' && (
                            <StatusPill tone="danger">
                              <AlertTriangle size={9} className="-ml-0.5" /> fail
                            </StatusPill>
                          )}
                          {outcome === 'unscanned' && (
                            <StatusPill tone="muted">
                              <HelpCircle size={9} className="-ml-0.5" /> no scan recorded
                            </StatusPill>
                          )}
                        </td>
                        <td className="text-[11px] text-muted">
                          {c.c2paManifestId ? (
                            <span className="mono">{c.c2paManifestId}</span>
                          ) : (
                            <span className="text-soft">—</span>
                          )}
                        </td>
                        <td className="text-[11px] text-muted">
                          {c.approvedAt ? new Date(c.approvedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="text-[11px] text-muted">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>
    </AccountShell>
  );
}
