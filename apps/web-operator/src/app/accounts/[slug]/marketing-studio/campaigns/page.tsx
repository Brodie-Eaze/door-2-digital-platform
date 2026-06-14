'use client';

import { useState } from 'react';
import { Megaphone, Eye, Play, Pause, ExternalLink, Filter, Plus, X, Activity } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingCampaignsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';
import {
  getAccountMarketing,
  CHANNEL_LABEL,
  CHANNEL_BADGE,
  type ScopedCampaign,
} from '@/lib/account-marketing';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

/**
 * Per-account campaigns dashboard — shows only campaigns running on
 * channels this account has enabled. Spend + budget rendered in the
 * account's region currency (USD for US accounts, AUD for AU).
 */

interface PageProps {
  params: { slug: string };
}

function statusTone(s: ScopedCampaign['status']): 'success' | 'muted' | 'warn' | 'info' {
  switch (s) {
    case 'active':
      return 'success';
    case 'ended':
      return 'muted';
    case 'paused':
      return 'warn';
    case 'scheduled':
      return 'info';
  }
}

export default function Page({ params }: PageProps): JSX.Element {
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);
  const [openId, setOpenId] = useState<string | null>(null);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || !data || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Campaigns">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <MarketingCampaignsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const opened = openId ? data.campaigns.find((c) => c.id === openId) : null;
  const totalSpend = data.campaigns.reduce((s, c) => s + c.spendCents, 0);
  const totalBudget = data.campaigns.reduce((s, c) => s + c.budgetCents, 0);
  const totalConv = data.campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalImps = data.campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = data.campaigns.reduce((s, c) => s + c.clicks, 0);
  const ctr = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;
  const active = data.campaigns.filter((c) => c.status === 'active').length;
  const weighted =
    totalSpend > 0 ? data.campaigns.reduce((s, c) => s + c.roas * c.spendCents, 0) / totalSpend : 0;

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Campaigns`}
    >
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="campaigns" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Megaphone size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.scopeLabel}</span> · {data.campaigns.length}{' '}
              campaigns across {data.channels.map((c) => CHANNEL_LABEL[c]).join(' · ')}. ROAS
              attribution flows from conversion webhooks → creative → campaign → spend, scoped to
              this account.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total spend MTD"
            value={<Money cents={BigInt(totalSpend)} region={data.region} />}
            hint={`${active} active · of ${data.campaigns.length}`}
          />
          <KpiCard
            label="Budget allocated"
            value={<Money cents={BigInt(totalBudget)} region={data.region} />}
            hint="MTD ceiling"
          />
          <KpiCard label="Conversions" value={totalConv.toLocaleString()} deltaTone="positive" />
          <KpiCard label="Weighted ROAS" value={`${weighted.toFixed(1)}x`} deltaTone="positive" />
          <KpiCard label="Blended CTR" value={`${ctr.toFixed(2)}%`} />
          <KpiCard
            label="Impressions"
            value={
              totalImps >= 1_000_000
                ? `${(totalImps / 1_000_000).toFixed(2)}M`
                : totalImps.toLocaleString()
            }
            hint="across all channels"
          />
        </div>

        <Section
          title={`Campaigns · ${data.campaigns.length}`}
          subtitle="Row click loads creative previews + delivery log in side panel"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Filter size={13} />}
                onClick={() => toast.info('Campaign filters — wiring lands in Phase 1.2')}
              >
                Filter
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={13} />}
                onClick={() => toast.info('New campaign builder — wiring lands in Phase 1.2')}
              >
                New campaign
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Budget</th>
                <th>Spend</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Conv</th>
                <th>ROAS</th>
                <th>Attribution</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-paper"
                  onClick={() => setOpenId(c.id)}
                >
                  <td>
                    <div className="text-[12.5px] font-medium text-ink leading-snug">{c.name}</div>
                    <div className="text-[10px] text-muted font-mono">
                      {c.id} · started {c.startedAt}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center text-[10px] font-semibold rounded px-2 py-0.5 ${CHANNEL_BADGE[c.channel]}`}
                    >
                      {CHANNEL_LABEL[c.channel]}
                    </span>
                  </td>
                  <td className="text-[12px] text-ink">
                    <Money cents={BigInt(c.budgetCents)} region={data.region} emptyAsDash />
                  </td>
                  <td className="text-[12px] text-ink">
                    <Money cents={BigInt(c.spendCents)} region={data.region} emptyAsDash />
                  </td>
                  <td className="text-[12px] text-ink numeric">{c.impressions.toLocaleString()}</td>
                  <td className="text-[12px] text-ink numeric">{c.clicks.toLocaleString()}</td>
                  <td className="text-[12px] text-ink numeric">{c.ctrPct.toFixed(2)}%</td>
                  <td className="text-[12px] text-ink numeric font-semibold">
                    {c.conversions.toLocaleString()}
                  </td>
                  <td className="text-[12px]">
                    {c.roas === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span
                        className={
                          c.roas >= 5
                            ? 'text-success font-semibold'
                            : c.roas >= 3
                              ? 'text-accent font-semibold'
                              : 'text-warn font-semibold'
                        }
                      >
                        {c.roas.toFixed(1)}x
                      </span>
                    )}
                  </td>
                  <td className="text-[11px] text-muted capitalize">
                    {c.attribution.replace('_', ' ')}
                  </td>
                  <td>
                    <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {c.status === 'active' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info(`Pause "${c.name}" — wiring lands in Phase 1.2`);
                          }}
                          className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                          title="Pause"
                        >
                          <Pause size={12} />
                        </button>
                      ) : c.status === 'paused' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info(`Resume "${c.name}" — wiring lands in Phase 1.2`);
                          }}
                          className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-success"
                          title="Resume"
                        >
                          <Play size={12} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(c.id);
                        }}
                        className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                        title="Inspect"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(
                            `Open in ${CHANNEL_LABEL[c.channel]} — wiring lands in Phase 1.2`,
                          );
                        }}
                        className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                        title="Open in channel dashboard"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section title="Channel mix · MTD spend" subtitle="Where the money went">
            <div className="space-y-2.5">
              {data.channels.map((ch) => {
                const chSpend = data.campaigns
                  .filter((c) => c.channel === ch)
                  .reduce((s, c) => s + c.spendCents, 0);
                const pct = totalSpend > 0 ? (chSpend / totalSpend) * 100 : 0;
                return (
                  <div key={ch}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="font-medium text-ink flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center text-[9px] font-semibold rounded px-1.5 py-0.5 ${CHANNEL_BADGE[ch]}`}
                        >
                          {CHANNEL_LABEL[ch]}
                        </span>
                      </span>
                      <span className="text-ink">
                        <Money cents={BigInt(chSpend)} region={data.region} emptyAsDash /> ·{' '}
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-line2 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="ROAS by attribution path" subtitle="How the conversion was credited">
            <div className="space-y-3">
              {(
                [
                  { src: 'knock', label: 'Knock-led (field)' },
                  { src: 'inside_sales', label: 'Inside sales (call/email)' },
                  { src: 'retargeting', label: 'Retargeting (hashed audience)' },
                  { src: 'cold', label: 'Cold (top-of-funnel)' },
                ] as const
              ).map((a) => {
                const cs = data.campaigns.filter((c) => c.attribution === a.src);
                const sp = cs.reduce((s, c) => s + c.spendCents, 0);
                const conv = cs.reduce((s, c) => s + c.conversions, 0);
                const weightedR =
                  sp > 0 ? cs.reduce((s, c) => s + c.roas * c.spendCents, 0) / sp : 0;
                return (
                  <div key={a.src} className="flex items-center justify-between gap-3">
                    <div className="text-[12.5px] text-ink font-medium">{a.label}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted">
                        spend <Money cents={BigInt(sp)} region={data.region} emptyAsDash />
                      </span>
                      <span className="text-[11px] text-muted">conv {conv.toLocaleString()}</span>
                      <StatusPill
                        tone={weightedR >= 5 ? 'success' : weightedR >= 3 ? 'info' : 'warn'}
                      >
                        {weightedR > 0 ? `${weightedR.toFixed(1)}x` : '—'}
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>

      {opened && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpenId(null)}>
          <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
          <aside
            className="w-[560px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
              <div>
                <div className="text-[13px] font-semibold text-ink">{opened.name}</div>
                <div className="text-[10.5px] text-muted font-mono">
                  {opened.id} · {account.shortName}
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
              <div className="grid grid-cols-4 gap-2">
                <DrawerMetric
                  label="Spend"
                  value={
                    <Money cents={BigInt(opened.spendCents)} region={data.region} emptyAsDash />
                  }
                />
                <DrawerMetric label="Conv" value={opened.conversions.toLocaleString()} />
                <DrawerMetric
                  label="ROAS"
                  value={opened.roas > 0 ? `${opened.roas.toFixed(1)}x` : '—'}
                />
                <DrawerMetric label="CTR" value={`${opened.ctrPct.toFixed(2)}%`} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <Meta label="Channel" value={CHANNEL_LABEL[opened.channel]} />
                <Meta label="Status" value={opened.status} />
                <Meta label="Attribution" value={opened.attribution.replace('_', ' ')} />
                <Meta label="Started" value={opened.startedAt} />
                <Meta
                  label="Budget"
                  value={
                    <Money cents={BigInt(opened.budgetCents)} region={data.region} emptyAsDash />
                  }
                />
                <Meta label="Impressions" value={opened.impressions.toLocaleString()} />
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
                  Delivery log
                </div>
                <ul className="space-y-1.5 text-[11px] text-muted">
                  <li className="flex items-start gap-2">
                    <Activity size={11} className="text-success mt-0.5 shrink-0" />
                    <span>
                      <span className="text-ink font-medium">CAPI webhook ingested</span> · last{' '}
                      {opened.conversions} conversions attributed
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Activity size={11} className="text-accent mt-0.5 shrink-0" />
                    <span>
                      <span className="text-ink font-medium">Spend pacing</span> ·{' '}
                      {opened.budgetCents > 0
                        ? `${((opened.spendCents / opened.budgetCents) * 100).toFixed(0)}% of MTD budget`
                        : '—'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Activity size={11} className="text-accent mt-0.5 shrink-0" />
                    <span>
                      <span className="text-ink font-medium">Audience refreshed</span> · hashed
                      uploads from /retargeting
                    </span>
                  </li>
                </ul>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-line2">
                {opened.status === 'active' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pause size={12} />}
                    onClick={() => toast.info(`Pause "${opened.name}" — wiring lands in Phase 1.2`)}
                  >
                    Pause campaign
                  </Button>
                ) : opened.status === 'paused' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Play size={12} />}
                    onClick={() => toast.info(`Resume "${opened.name}" — wiring lands in Phase 1.2`)}
                  >
                    Resume campaign
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ExternalLink size={12} />}
                  onClick={() =>
                    toast.info(`Open in ${CHANNEL_LABEL[opened.channel]} — wiring lands in Phase 1.2`)
                  }
                >
                  Open in {CHANNEL_LABEL[opened.channel]}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AccountShell>
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

function Meta({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11.5px] font-semibold text-ink capitalize">{value}</div>
    </div>
  );
}
