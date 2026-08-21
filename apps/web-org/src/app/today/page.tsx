import { Inbox, Trophy, Users } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import {
  apiFetch,
  sumWireCents,
  wireCents,
  type ConversionPublic,
  type LeadPublic,
  type PageResponse,
} from '@/lib/api';

interface Contributor {
  id: string;
  conversions: number;
  revenueCents: bigint;
}

function formatRatioPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00%';
  const basisPoints = (BigInt(numerator) * 10000n) / BigInt(denominator);
  const whole = basisPoints / 100n;
  const fraction = (basisPoints % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}%`;
}

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function topContributors(conversions: readonly ConversionPublic[]): Contributor[] {
  const byUser = new Map<string, Contributor>();
  for (const conversion of conversions) {
    if (!conversion.knockerId) continue;
    const current = byUser.get(conversion.knockerId) ?? {
      id: conversion.knockerId,
      conversions: 0,
      revenueCents: 0n,
    };
    byUser.set(conversion.knockerId, {
      ...current,
      conversions: current.conversions + 1,
      revenueCents: current.revenueCents + wireCents(conversion.amountCents),
    });
  }
  return Array.from(byUser.values())
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);
}

export default async function TodayPage(): Promise<JSX.Element> {
  const [leadPage, conversionPage] = await Promise.all([
    apiFetch<PageResponse<LeadPublic>>('/leads?limit=100'),
    apiFetch<PageResponse<ConversionPublic>>('/conversions?limit=100'),
  ]);
  const leads = leadPage.data;
  const conversions = conversionPage.data;
  const revenueCents = sumWireCents(conversions, (conversion) => conversion.amountCents);
  const contributors = topContributors(conversions);
  const door = conversions.filter((conversion) => conversion.attributionSource === 'door').length;
  const inside = conversions.filter(
    (conversion) => conversion.attributionSource === 'inside_sales',
  ).length;
  const retarget = conversions.filter(
    (conversion) => conversion.attributionSource === 'retargeting',
  ).length;

  return (
    <OrgShell pageTitle="Today">
      <div className="space-y-6 max-w-[1400px]">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Leads loaded"
            value={leads.length.toLocaleString()}
            hint="latest 100"
            animate={false}
          />
          <KpiCard
            label="Conversions loaded"
            value={conversions.length.toLocaleString()}
            hint="latest 100"
            animate={false}
          />
          <KpiCard
            label="Conversion rate"
            value={formatRatioPercent(conversions.length, leads.length)}
            hint="conversions / leads"
            animate={false}
          />
          <KpiCard
            label="Revenue loaded"
            value={<Money cents={revenueCents} region="US" />}
            hint="GMV (donor side)"
            animate={false}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Anomalies (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="h-section">Needs attention</h2>
            <Banner tone="info">
              <span>No live anomalies yet.</span>
            </Banner>
            {leads.length === 0 && (
              <Banner tone="muted">
                <span>No leads yet — they appear as knockers capture them in the field</span>
              </Banner>
            )}
          </div>

          {/* Side rail */}
          <div className="space-y-4">
            <Section title="Live leaderboard" subtitle="Top conversion contributors" paddedBody={false}>
              <div className="divide-y divide-line2">
                {contributors.map((contributor, i) => (
                  <div key={contributor.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className={`w-5 text-[11px] font-semibold ${i === 0 ? 'text-success' : 'text-soft'}`}
                    >
                      {i + 1}
                    </div>
                    <span className="mono">{shortId(contributor.id)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">User {shortId(contributor.id)}</div>
                      <div className="text-[11px] text-muted numeric">
                        {contributor.conversions} conv. ·{' '}
                        <Money cents={contributor.revenueCents} region="US" />
                      </div>
                    </div>
                    {i === 0 && <Trophy size={14} className="text-success" />}
                  </div>
                ))}
                {contributors.length === 0 && (
                  <div className="text-[11px] text-soft text-center py-8">
                    No conversions yet.
                  </div>
                )}
              </div>
            </Section>

            <Section title="Source mix" subtitle="Conversion attribution" paddedBody={false}>
              <div className="divide-y divide-line2">
                {[
                  { label: 'Door', count: door, tone: 'success' as const },
                  { label: 'Inside sales', count: inside, tone: 'info' as const },
                  { label: 'Retargeting', count: retarget, tone: 'warn' as const },
                ].map((source) => (
                  <div key={source.label} className="flex items-center gap-3 px-5 py-3">
                    <Inbox size={14} className="text-soft shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{source.label}</div>
                      <div className="text-[11px] text-muted numeric flex items-center gap-2">
                        <Users size={10} /> {source.count} conversions
                      </div>
                    </div>
                    <StatusPill tone={source.tone}>{source.count}</StatusPill>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </OrgShell>
  );
}
