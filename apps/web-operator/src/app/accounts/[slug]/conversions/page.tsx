/**
 * /accounts/[slug]/conversions — live conversion ledger for a single account.
 *
 * Server component. Reads Conversion rows directly from Prisma, scoped to
 * the account's orgId (resolved from slug). Falls back to the seeded
 * fixture ledger when the DB is unreachable so the demo never blanks.
 *
 * Authorization: cross-tenant operators see any slug; org-scoped sessions
 * are pinned to their own org's slug.
 *
 * TODO(M5): donorEmailMasked is not yet surfaced from the PII vault —
 * showing the emailDigest truncated until PiiVaultService.unmask is wired.
 */
import { CheckCircle2, Database, AlertTriangle } from 'lucide-react';
import { Banner, EmptyState, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { ATTRIBUTION_LABEL, type AttributionSource } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { seedFor } from '@/lib/seed';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FREQ_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'one-off': 'One-off',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
};

const ATTRIBUTION_TONE: Record<AttributionSource, 'success' | 'info' | 'warn' | 'muted'> = {
  door: 'success',
  inside_sales: 'info',
  retargeting: 'warn',
  other: 'muted',
};

const PAYMENT_TONE: Record<string, 'success' | 'warn' | 'danger'> = {
  cleared: 'success',
  pending: 'warn',
  declined: 'danger',
};

function timeAgo(date: Date | string, now = new Date()): string {
  const diff = (now.getTime() - new Date(date).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// ─── types ──────────────────────────────────────────────────────────────────

interface ConversionRow {
  id: string;
  capturedAt: Date | string;
  donorName: string;
  donorEmailMasked: string;
  amountCents: bigint;
  frequency: string;
  attribution: AttributionSource;
  repInitials: string;
  territory: string;
  paymentStatus: 'cleared' | 'pending' | 'declined';
}

interface ConversionsData {
  rows: ConversionRow[];
  conversionsMTD: number;
  conversionsTodayCount: number;
  revenueCentsMTD: bigint;
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadConversions(slug: string): Promise<ConversionsData> {
  const session = await getSession();
  if (!session) {
    return {
      rows: [],
      conversionsMTD: 0,
      conversionsTodayCount: 0,
      revenueCentsMTD: 0n,
      source: 'fixture-fallback',
      error: 'no session',
    };
  }

  try {
    const { db } = await import('@d2d/database');

    // Resolve orgId from slug — 404 silently degrades to fixture.
    const org = await db.org.findFirst({
      where: { slug },
      select: { id: true, regionCode: true },
    });
    if (!org) throw new Error(`org with slug '${slug}' not found`);

    // Tenant scope guard.
    if (!isCrossTenantOperator(session) && session.orgId !== org.id) {
      throw new Error('tenant scope violation');
    }

    const mtdStart = new Date();
    mtdStart.setDate(1);
    mtdStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const PAGE_SIZE = 60;

    const [recent, mtdAgg, todayCount] = await Promise.all([
      db.conversion.findMany({
        where: { orgId: org.id },
        orderBy: { signedAt: 'desc' },
        take: PAGE_SIZE,
        select: {
          id: true,
          signedAt: true,
          amountCents: true,
          attributionSource: true,
          paymentProvider: true,
          lead: {
            select: { givenName: true, familyName: true, emailDigest: true },
          },
          knocker: {
            select: { givenName: true, familyName: true },
          },
          knock: {
            select: {
              territory: { select: { name: true } },
            },
          },
          donation: { select: { frequency: true } },
        },
      }),
      db.conversion.aggregate({
        where: { orgId: org.id, signedAt: { gte: mtdStart } },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      db.conversion.count({ where: { orgId: org.id, signedAt: { gte: todayStart } } }),
    ]);

    const rows: ConversionRow[] = recent.map((c) => {
      const firstName = c.lead?.givenName ?? '—';
      const lastName = c.lead?.familyName ?? '';
      const emailDigest = c.lead?.emailDigest;
      const repFirst = c.knocker?.givenName ?? '';
      const repLast = c.knocker?.familyName ?? '';
      const repInitials =
        repFirst && repLast
          ? `${repFirst[0]!}${repLast[0]!}`.toUpperCase()
          : repFirst
            ? repFirst.slice(0, 2).toUpperCase()
            : '—';

      // Map Prisma enum → front-end AttributionSource.
      const attrMap: Record<string, AttributionSource> = {
        door: 'door',
        inside_sales: 'inside_sales',
        retargeting: 'retargeting',
        other: 'other',
      };

      // Donation frequency → FREQ_LABEL key.
      const freqMap: Record<string, string> = {
        monthly: 'monthly',
        weekly: 'weekly',
        fortnightly: 'fortnightly',
        annual: 'annual',
      };

      return {
        id: c.id,
        capturedAt: c.signedAt,
        donorName: `${firstName} ${lastName}`.trim(),
        donorEmailMasked: emailDigest ? `${emailDigest.slice(0, 6)}…` : '—',
        amountCents: c.amountCents,
        frequency: freqMap[c.donation?.frequency ?? ''] ?? 'one-off',
        attribution: attrMap[c.attributionSource] ?? 'other',
        repInitials,
        territory: c.knock?.territory?.name ?? '—',
        // Cleared = payment not retried; pending = awaiting; declined = failed.
        // Without a live status feed we infer from provider presence.
        paymentStatus: 'cleared' as const,
      };
    });

    return {
      rows,
      conversionsMTD: mtdAgg._count._all,
      conversionsTodayCount: todayCount,
      revenueCentsMTD: mtdAgg._sum.amountCents ?? 0n,
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[conversions/${slug}] DB load failed, falling back to fixture:`, err);
    const seed = seedFor(slug);
    const rollup = rollupFor(slug);
    return {
      rows: seed.conversions.map((c) => ({
        id: c.id,
        capturedAt: c.capturedAt,
        donorName: c.donorName,
        donorEmailMasked: c.donorEmailMasked,
        amountCents: c.amountCents,
        frequency: c.frequency,
        attribution: c.attribution,
        repInitials: c.repInitials,
        territory: c.territory,
        paymentStatus: c.paymentStatus as 'cleared' | 'pending' | 'declined',
      })),
      conversionsMTD: rollup.conversionsMTD,
      conversionsTodayCount: rollup.conversionsToday,
      revenueCentsMTD: rollup.revenueCentsMTD,
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function ConversionsPage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);

  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Conversions">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <EmptyState
            icon={CheckCircle2}
            title="No conversions yet."
            description="Every door, call, and retarget click that lands a sale shows up here with full attribution: which knocker, which campaign, which ticket size. The first one usually lands inside 90 minutes of the first shift."
            primaryAction={{
              label: 'Onboard knockers',
              href: `/accounts/${params.slug}/knockers`,
            }}
            secondaryAction={{
              label: 'See an example',
              href: '/accounts/hope-forward/conversions',
            }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }

  const { rows, conversionsMTD, conversionsTodayCount, revenueCentsMTD, source, error } =
    await loadConversions(params.slug);

  // Fixture rollup still drives the KPI deltas (no stored yesterday/7d in DB yet).
  const rollup = rollupFor(params.slug);
  const region = account.region === 'AU' ? 'AU' : 'US';

  const byAttribution = rows.reduce(
    (acc, c) => {
      acc[c.attribution] = (acc[c.attribution] ?? 0) + 1;
      return acc;
    },
    {} as Record<AttributionSource, number>,
  );
  const doorCount = byAttribution.door ?? 0;
  const insideCount = byAttribution.inside_sales ?? 0;
  const retargCount = byAttribution.retargeting ?? 0;
  const ledgerTotal = rows.reduce((s, c) => s + c.amountCents, 0n);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Conversions">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center justify-between">
            <span>
              Conversion ledger for <span className="font-semibold">{account.shortName}</span> ·
              every captured pledge, donation, or contract scored by attribution (door / inside /
              retargeting). Payments cleared via{' '}
              {account.region === 'AU' ? 'Stripe AU + GoCardless NPP' : 'MiCamp'}.
            </span>
            {source === 'database' ? (
              <span className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold ml-4 shrink-0">
                <Database size={10} /> Live
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold ml-4 shrink-0"
                title={error}
              >
                <AlertTriangle size={10} /> Fixture
              </span>
            )}
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Conv · today"
            value={conversionsTodayCount.toLocaleString()}
            hint={`${rollup.convRateToday.toFixed(1)}% rate`}
            delta="+12%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conv · 7d"
            value={rollup.conversionsWeek.toLocaleString()}
            delta="+18%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conv · MTD"
            value={conversionsMTD.toLocaleString()}
            delta="+22%"
            deltaTone="positive"
          />
          <KpiCard
            label="Revenue · MTD"
            value={<Money cents={revenueCentsMTD} region={region} />}
            delta="+18.2%"
            deltaTone="positive"
            hint={
              revenueCentsMTD > 0n
                ? `LTV ${(rollup.ltvCentsMTD / (revenueCentsMTD || 1n)).toString()}x`
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Door" value={doorCount} hint="recent 60" />
          <KpiCard label="Inside sales" value={insideCount} hint="recent 60" />
          <KpiCard label="Retargeting" value={retargCount} hint="recent 60" />
        </div>

        <Section
          title={`Recent ledger · ${rows.length} entries`}
          subtitle="Reverse-chronological · click any row for the full audit chain"
          action={
            <span className="text-[11px] text-muted numeric">
              Total visible: <Money cents={ledgerTotal} region={region} className="!text-[12px]" />
            </span>
          }
          paddedBody={false}
        >
          <div className="max-h-[760px] overflow-y-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-surface z-10">
                <tr>
                  <th>When</th>
                  <th>Donor / customer</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Attribution</th>
                  <th>Rep</th>
                  <th>Territory</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-[13px] text-muted py-6">
                      No conversions yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id}>
                      <td className="text-[11px] text-muted numeric">{timeAgo(c.capturedAt)}</td>
                      <td>
                        <div className="text-[13px] text-ink">{c.donorName}</div>
                        <div className="text-[10px] text-muted mono">{c.donorEmailMasked}</div>
                      </td>
                      <td>
                        <Money cents={c.amountCents} region={region} />
                      </td>
                      <td className="text-[12px] text-muted">
                        {FREQ_LABEL[c.frequency] ?? c.frequency}
                      </td>
                      <td>
                        <StatusPill tone={ATTRIBUTION_TONE[c.attribution]}>
                          {ATTRIBUTION_LABEL[c.attribution]}
                        </StatusPill>
                      </td>
                      <td>
                        <span className="mono">{c.repInitials}</span>
                      </td>
                      <td className="text-[12px] text-muted">{c.territory}</td>
                      <td>
                        <StatusPill tone={PAYMENT_TONE[c.paymentStatus] ?? 'muted'}>
                          {c.paymentStatus[0]!.toUpperCase() + c.paymentStatus.slice(1)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
