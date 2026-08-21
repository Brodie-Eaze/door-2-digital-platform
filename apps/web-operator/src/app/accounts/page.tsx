/**
 * /accounts — the operator's portfolio of sub-accounts.
 *
 * Server component. Reads directly from the shared Prisma client (no
 * round-trip through /api/orgs) so the first paint already has data,
 * cookies pass through implicitly via getSession(). If the DB is
 * unreachable (e.g. Railway env var missing) we degrade gracefully to
 * the static ACCOUNTS fixture so the demo doesn't blank.
 *
 * Authorization:
 *   - super_admin: all non-archived orgs
 *   - everyone else: scoped to their own orgId
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Plus, UserPlus, Database, AlertTriangle } from 'lucide-react';
import {
  Banner,
  Button,
  KpiCard,
  Money,
  RegionBadge,
  Reveal,
  Section,
  StatusPill,
} from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { AccountAvatar } from '@/components/AccountAvatar';
import { AccountsEmpty } from '@/components/AccountEmptyStates';
import { ACCOUNTS, type Account } from '@/lib/accounts';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PortfolioEntry {
  account: Account;
  fromDb: boolean;
  leadsToday: number;
}

interface PortfolioData {
  entries: PortfolioEntry[];
  source: 'database' | 'fixture-fallback';
  error?: string;
}

async function loadPortfolio(): Promise<PortfolioData> {
  const session = await getSession();
  if (!session) {
    // Middleware should redirect; defensive guard for direct API misuse.
    return { entries: [], source: 'fixture-fallback', error: 'no session' };
  }

  try {
    // Dynamic import keeps Prisma off the Edge/middleware bundle.
    const { db } = await import('@d2d/database');
    // Tenant scope over a cryptographically verified session: only a genuine
    // cross-tenant operator sees every org; everyone else is pinned to their
    // own session.orgId (default-deny via the centralised helper).
    const where = isCrossTenantOperator(session)
      ? { status: { not: 'archived' as const }, slug: { not: null } }
      : session.orgId
        ? { id: session.orgId, status: { not: 'archived' as const }, slug: { not: null } }
        : { id: '__no_org__' };

    const orgs = await db.org.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { billing: { select: { currency: true } } },
    });

    // Lead counts per org (today) — single grouped query, no N+1.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const leadCounts = await db.lead.groupBy({
      by: ['orgId'],
      where: {
        orgId: { in: orgs.map((o) => o.id) },
        createdAt: { gte: todayStart },
      },
      _count: { _all: true },
    });
    const leadCountByOrg = new Map(leadCounts.map((r) => [r.orgId, r._count._all]));

    const entries: PortfolioEntry[] = orgs.map((o) => {
      // Reuse the fixture for cosmetic colours/notes when the slug matches;
      // otherwise synthesize from DB columns. The DB is the source of truth
      // for legalName / regionCode / status; the fixture only loans the
      // avatar palette + the legacy narrative for known demo orgs.
      const fixture = o.slug ? ACCOUNTS.find((a) => a.slug === o.slug) : undefined;
      const account: Account = {
        slug: o.slug ?? o.id,
        name: o.legalName,
        shortName: o.tradingName,
        vertical: (o.vertical === 'commercial' ? 'commercial' : 'charity') as Account['vertical'],
        region: (o.regionCode === 'AU'
          ? 'AU'
          : o.regionCode === 'SG'
            ? 'SG'
            : 'US') as Account['region'],
        avatarBg: fixture?.avatarBg ?? '#0F172A',
        avatarFg: fixture?.avatarFg ?? '#FFFFFF',
        plan: fixture?.plan ?? 'Growth',
        health: fixture?.health ?? 'healthy',
        knockers: fixture?.knockers ?? 0,
        insideSalesReps: fixture?.insideSalesReps ?? 0,
        territoriesActive: fixture?.territoriesActive ?? 0,
        leadsInboxToday: leadCountByOrg.get(o.id) ?? 0,
        conversionsMTD: fixture?.conversionsMTD ?? 0,
        revenueCentsMTD: fixture?.revenueCentsMTD ?? 0n,
        ltvCentsMTD: fixture?.ltvCentsMTD ?? 0n,
        contractedAt: o.createdAt.toISOString().slice(0, 10),
        notes: fixture?.notes ?? `${o.tradingName} sub-account.`,
      };
      return { account, fromDb: true, leadsToday: leadCountByOrg.get(o.id) ?? 0 };
    });

    return { entries, source: 'database' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[accounts] DB load failed, falling back to fixture:', err);
    return {
      entries: ACCOUNTS.map((a) => ({ account: a, fromDb: false, leadsToday: a.leadsInboxToday })),
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ just_onboarded?: string }>;
}): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/accounts');

  const { entries, source, error } = await loadPortfolio();
  const accounts = entries.map((e) => e.account);
  const resolvedSearchParams = await searchParams;
  const justOnboardedSlug = resolvedSearchParams?.just_onboarded;
  const justOnboarded = justOnboardedSlug
    ? accounts.find((a) => a.slug === justOnboardedSlug)
    : undefined;
  const totalKnockers = accounts.reduce((s, a) => s + a.knockers, 0);
  const totalLeadsToday = entries.reduce((s, e) => s + e.leadsToday, 0);
  const totalRevenue = accounts.reduce((s, a) => s + a.revenueCentsMTD, 0n);

  if (accounts.length === 0) {
    return (
      <PlatformShell pageTitle="Accounts">
        <div className="space-y-5 max-w-[1400px]">
          <AccountsEmpty />
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell pageTitle="Accounts">
      <div className="space-y-6 max-w-[1400px]">
        {/* Header bar with primary CTA */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[19px] font-semibold text-ink tracking-tight">
              All sub-accounts
            </div>
            <div className="text-[12px] text-muted flex items-center gap-2">
              <span>
                {accounts.length} businesses live · {totalKnockers} knockers active across portfolio
              </span>
              {source === 'database' ? (
                <span
                  className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold"
                  title="Loaded from Postgres"
                >
                  <Database size={10} /> Live
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold"
                  title={error ? `DB error: ${error}` : 'Showing fixture data'}
                >
                  <AlertTriangle size={10} /> Fixture
                </span>
              )}
            </div>
          </div>
          <Link href="/onboard-account">
            <Button variant="primary" leftIcon={<UserPlus size={14} />}>
              Onboard new business
            </Button>
          </Link>
        </div>

        {justOnboarded && (
          <Banner tone="success">
            <span className="text-[13px]">
              <span className="font-semibold">{justOnboarded.name} is live.</span> Org + BrandKit +
              Billing committed to Postgres; audit row written. The {justOnboarded.region} workspace
              is provisioned and accessible below.
            </span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">Door 2 Digital Command Centre</span> — your team&apos;s
            home. Click any account to drop into its full CRM workspace (territories, Knockers,
            leads, pipeline, campaigns, sequences). Each account is a tiny operating system inside
            the one.
          </span>
        </Banner>

        <Reveal delay={0} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Accounts" value={accounts.length} hint="charity + commercial" />
          <KpiCard
            label="Knockers active"
            value={totalKnockers}
            delta="+18 vs yest."
            deltaTone="positive"
          />
          <KpiCard
            label="Leads today (all accts)"
            value={totalLeadsToday}
            delta="real-time"
            deltaTone="positive"
          />
          <KpiCard
            label="MTD revenue"
            value={<Money cents={totalRevenue} region="US" />}
            delta="+18.4%"
            deltaTone="positive"
          />
        </Reveal>

        <Reveal delay={80}>
          <Section
            title="Sub-accounts"
            subtitle="Each account is fully isolated — own territories, Knockers, leads, pipeline, compliance"
            action={
              <Link href="/onboard-account">
                <Button leftIcon={<Plus size={14} />} variant="primary" size="sm">
                  New account
                </Button>
              </Link>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((a) => (
                <Link
                  key={a.slug}
                  href={`/accounts/${a.slug}/today`}
                  className="card card-pad hover:shadow-md transition group cursor-pointer block"
                >
                  <div className="flex items-start gap-4">
                    <AccountAvatar account={a} size={56} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-ink truncate group-hover:text-accent transition">
                            {a.name}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">{a.notes}</div>
                        </div>
                        <ArrowRight
                          size={16}
                          className="text-soft group-hover:text-accent transition shrink-0 mt-1"
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <RegionBadge region={a.region} />
                        <span className="tag capitalize">{a.vertical}</span>
                        <span
                          className={`pill ${
                            a.health === 'healthy'
                              ? 'pill-success'
                              : a.health === 'attention'
                                ? 'pill-warn'
                                : 'pill-danger'
                          }`}
                        >
                          {a.plan}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 pt-4 border-t border-line2">
                    <Stat label="Knockers" value={a.knockers.toString()} />
                    <Stat label="Leads today" value={a.leadsInboxToday.toString()} />
                    <Stat label="Conv. MTD" value={a.conversionsMTD.toLocaleString()} />
                    <Stat
                      label="Revenue"
                      value={
                        <Money cents={a.revenueCentsMTD} region={a.region === 'AU' ? 'AU' : 'US'} />
                      }
                    />
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </Reveal>

        <Reveal delay={160}>
          <Section title="Account roll-up" subtitle="Cross-account KPIs (Brodie's view)">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Vertical</th>
                  <th>Region</th>
                  <th>Knockers</th>
                  <th>MTD Conv.</th>
                  <th>MTD Revenue</th>
                  <th>Projected LTV</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.slug}>
                    <td>
                      <Link
                        href={`/accounts/${a.slug}/today`}
                        className="text-[13px] text-ink hover:text-accent font-medium inline-flex items-center gap-2"
                      >
                        <AccountAvatar account={a} size={24} />
                        {a.name}
                      </Link>
                    </td>
                    <td className="text-[12px] text-muted capitalize">{a.vertical}</td>
                    <td>
                      <RegionBadge region={a.region} />
                    </td>
                    <td className="numeric text-[13px]">{a.knockers}</td>
                    <td className="numeric text-[13px]">{a.conversionsMTD.toLocaleString()}</td>
                    <td>
                      <Money cents={a.revenueCentsMTD} region={a.region === 'AU' ? 'AU' : 'US'} />
                    </td>
                    <td>
                      <Money cents={a.ltvCentsMTD} region={a.region === 'AU' ? 'AU' : 'US'} />
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          a.health === 'healthy'
                            ? 'success'
                            : a.health === 'attention'
                              ? 'warn'
                              : 'danger'
                        }
                      >
                        {a.health}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </Reveal>
      </div>
    </PlatformShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">{value}</div>
    </div>
  );
}
