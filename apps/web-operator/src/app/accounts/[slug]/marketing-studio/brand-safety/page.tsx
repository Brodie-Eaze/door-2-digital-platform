'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  Edit3,
} from 'lucide-react';
import { Banner, Button, EmptyState, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';
import {
  getAccountMarketing,
  type ScopedBrandRule,
  type ScopedBlock,
} from '@/lib/account-marketing';
import { pickCreativeImage } from '@/lib/creative-images';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

/**
 * Per-account brand-safety control room — rule pack and recent blocks
 * scoped to this account's vertical + regulatory jurisdiction. Rules are
 * grouped by category (charity, pest, healthcare, etc.) so Brodie can
 * audit the right pack without hunting through every rule in the system.
 */

interface PageProps {
  params: { slug: string };
}

function severityTone(s: ScopedBrandRule['severity']): 'danger' | 'warn' | 'info' {
  switch (s) {
    case 'critical':
      return 'danger';
    case 'warn':
      return 'warn';
    case 'info':
      return 'info';
  }
}

function blockStatusTone(s: ScopedBlock['status']): 'success' | 'warn' | 'info' {
  switch (s) {
    case 'released':
      return 'success';
    case 'rewritten':
      return 'info';
    case 'pending':
      return 'warn';
  }
}

export default function Page({ params }: PageProps): JSX.Element {
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);

  const [blockOverrides, setBlockOverrides] = useState<Record<string, ScopedBlock['status']>>({});
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || !data || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Brand safety">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <EmptyState
            icon={ShieldCheck}
            title="Brand safety rules pending."
            description="Once you've connected ad providers and generated your first creatives, brand-safety rules + blocklist evidence start populating here. Rules also surface in Studio at generate time."
            primaryAction={{
              label: 'Open settings',
              href: `/accounts/${params.slug}/settings`,
            }}
            secondaryAction={{
              label: 'See an example',
              href: '/accounts/hope-forward/marketing-studio/brand-safety',
            }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }

  const criticalCount = data.brandRules.filter((r) => r.severity === 'critical').length;
  const warnCount = data.brandRules.filter((r) => r.severity === 'warn').length;
  const pendingBlocks = data.recentBlocks.filter((b) => b.status === 'pending').length;
  const resolvedBlocks = data.recentBlocks.filter(
    (b) => b.status === 'released' || b.status === 'rewritten',
  ).length;

  // Group rules by category
  const rulesByCategory = data.brandRules.reduce<Record<string, ScopedBrandRule[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category]!.push(r);
    return acc;
  }, {});

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Brand safety`}
    >
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="brand-safety" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.scopeLabel}</span> rule pack ·{' '}
              <span className="font-semibold">{data.brandRules.length} rules</span> calibrated for{' '}
              {data.vertical} in {data.region}. Every creative is moderation-scanned and
              rule-checked before publish; blocks land here for human review.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Active rules" value={data.brandRules.length} hint="account scope" />
          <KpiCard label="Critical" value={criticalCount} deltaTone="negative" />
          <KpiCard label="Warn" value={warnCount} />
          <KpiCard
            label="Safety pass rate"
            value={`${data.kpis.safetyPassPct.toFixed(1)}%`}
            deltaTone={data.kpis.safetyPassPct > 95 ? 'positive' : 'negative'}
          />
          <KpiCard label="Pending blocks" value={pendingBlocks} deltaTone="negative" />
          <KpiCard label="Resolved (recent)" value={resolvedBlocks} deltaTone="positive" />
        </div>

        <Section
          title={`Rule packs · ${Object.keys(rulesByCategory).length} categories`}
          subtitle={`Per-vertical + ${data.region} jurisdiction rules · edit individual rules in the Custom rules table below`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(rulesByCategory).map(([cat, rules]) => (
              <div key={cat} className="card card-pad">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-[13px] font-semibold text-ink capitalize">{cat}</div>
                    <div className="text-[10.5px] text-muted">
                      {data.region} · {rules.length} rules
                    </div>
                  </div>
                  <StatusPill tone="success">{rules.length} active</StatusPill>
                </div>
                <ul className="space-y-1 mb-2.5">
                  {rules.map((r) => (
                    <li
                      key={r.id}
                      className="text-[11.5px] text-muted leading-snug flex items-start gap-1.5"
                    >
                      {r.severity === 'critical' ? (
                        <AlertTriangle size={10} className="text-danger mt-0.5 shrink-0" />
                      ) : r.severity === 'warn' ? (
                        <AlertTriangle size={10} className="text-warn mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 size={10} className="text-success mt-0.5 shrink-0" />
                      )}
                      <span>{r.rule}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 border-t border-line2 text-[10px] text-muted flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} /> scope
                  </span>
                  <span className="font-mono">{rules[0]?.scope ?? data.region}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title={`Recent safety blocks · ${data.recentBlocks.length}`}
          subtitle="Scoped to this account · sorted by recency · use the row actions to override, discard, or inspect"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Filter size={13} />}
                onClick={() => toast.info('Block filters — wiring lands in Phase 1.2')}
              >
                Filter
              </Button>
            </div>
          }
        >
          {data.recentBlocks.length === 0 ? (
            <div className="text-center py-8 text-[12.5px] text-muted">
              No safety blocks for this account.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Block ID</th>
                  <th>Creative</th>
                  <th>Rule violated</th>
                  <th>Severity</th>
                  <th>Reviewer</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.recentBlocks
                  .filter((b) => !discardedIds.has(b.id))
                  .map((b) => {
                  const creative = data.creatives.find((c) => c.id === b.creativeId);
                  const effectiveStatus = blockOverrides[b.id] ?? b.status;
                  return (
                    <tr key={b.id} className="hover:bg-paper">
                      <td className="!pr-0 w-[60px]">
                        <div className="w-12 h-12 rounded-md overflow-hidden border border-line2 bg-paper relative">
                          {creative && (
                            <img
                              src={pickCreativeImage(creative.theme, creative.id)}
                              alt={b.creativeHeadline}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-danger/30" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <AlertTriangle size={14} className="text-surface drop-shadow" />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="mono text-[10px] !w-auto !px-2">{b.id}</span>
                      </td>
                      <td>
                        <div className="text-[12.5px] font-medium text-ink leading-snug">
                          &ldquo;{b.creativeHeadline}&rdquo;
                        </div>
                        <div className="text-[10px] text-muted font-mono">{b.creativeId}</div>
                      </td>
                      <td className="text-[12px] text-muted">{b.ruleViolated}</td>
                      <td>
                        <StatusPill tone={severityTone(b.severity)}>{b.severity}</StatusPill>
                      </td>
                      <td className="text-[12px] text-ink">{b.reviewer}</td>
                      <td>
                        <StatusPill tone={blockStatusTone(effectiveStatus)}>
                          {effectiveStatus}
                        </StatusPill>
                      </td>
                      <td className="text-[11px] text-muted numeric">{b.blockedAt}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setBlockOverrides((prev) => ({ ...prev, [b.id]: 'released' }));
                              toast.success(
                                `Block ${b.id} overridden → released locally (audit wiring: Phase 1.2)`,
                              );
                            }}
                            className="text-[10.5px] font-medium px-2 py-1 rounded border border-line2 text-muted hover:text-ink hover:bg-paper"
                            title="Override block"
                          >
                            Override
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscardedIds((prev) => new Set(prev).add(b.id));
                              toast.success(
                                `Block ${b.id} discarded locally (audit wiring: Phase 1.2)`,
                              );
                            }}
                            className="text-[10.5px] font-medium px-2 py-1 rounded border border-line2 text-muted hover:text-danger hover:bg-paper"
                            title="Discard"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toast.info(`Inspect block ${b.id} — wiring lands in Phase 1.2`)
                            }
                            className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                            title="Inspect"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Custom rules"
          subtitle="Editable rule library specific to this account · regex + LLM-as-judge"
          paddedBody={false}
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Edit3 size={13} />}
              onClick={() => toast.info('Add custom rule — wiring lands in Phase 1.2')}
            >
              Add rule
            </Button>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Description</th>
                <th>Category</th>
                <th>Scope</th>
                <th>Severity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.brandRules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{r.id}</span>
                  </td>
                  <td className="text-[12.5px] text-ink">{r.rule}</td>
                  <td className="text-[12px] text-muted capitalize">{r.category}</td>
                  <td className="text-[11.5px] text-muted">{r.scope}</td>
                  <td>
                    <StatusPill tone={severityTone(r.severity)}>{r.severity}</StatusPill>
                  </td>
                  <td>
                    <StatusPill tone="success">Enabled</StatusPill>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toast.info(`Edit rule ${r.id} — wiring lands in Phase 1.2`)}
                      className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                      title="Edit"
                    >
                      <Edit3 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            icon={<XCircle size={14} className="text-danger" />}
            label="Critical blocks"
            value={data.recentBlocks.filter((b) => b.severity === 'critical').length.toString()}
            hint="recent · this account"
          />
          <StatTile
            icon={<AlertTriangle size={14} className="text-warn" />}
            label="Warn blocks"
            value={data.recentBlocks.filter((b) => b.severity === 'warn').length.toString()}
            hint="recent · this account"
          />
          <StatTile
            icon={<CheckCircle2 size={14} className="text-success" />}
            label="Auto-resolved"
            value={data.recentBlocks
              .filter((b) => b.reviewer === 'Auto-resolved')
              .length.toString()}
            hint="LLM + regex pass"
          />
          <StatTile
            icon={<ShieldCheck size={14} className="text-accent" />}
            label="Safety pass rate"
            value={`${data.kpis.safetyPassPct.toFixed(1)}%`}
            hint="recent creatives"
          />
        </div>
      </div>
    </AccountShell>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-semibold text-ink tracking-tight numeric">
        {value}
      </div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}
