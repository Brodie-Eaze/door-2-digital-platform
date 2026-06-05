/**
 * /accounts/[slug]/knockers — live knocker roster for a single account.
 *
 * Server component. Reads User rows (role='knocker') from Prisma, scoped
 * to the account's orgId. Falls back to the account-fixtures roster when
 * the DB is unreachable.
 *
 * Authorization: cross-tenant operators see any slug; org-scoped sessions
 * are pinned to their own org's slug.
 *
 * TODO(M5): KnockSession real-time status (active/break/idle/offline) and
 * per-rep today's knock/conversion counts need a live-session feed or
 * aggregation view — no KnockSession status field in the schema yet; the
 * live-status column shows 'unknown' from DB until that's wired.
 */
import { Database, AlertTriangle } from 'lucide-react';
import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { REP_STATUS_LABEL, REP_STATUS_TONE } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { KnockersEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { accountData } from '@/lib/account-fixtures';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface KnockerRow {
  id: string;
  name: string;
  initials: string;
  status: 'active' | 'break' | 'idle' | 'offline' | 'training';
  territory: string;
  tenureDays: number;
  knocks: number;
  conversions: number;
  convRate: number;
  revenueCents: bigint;
}

interface KnockersData {
  knockers: KnockerRow[];
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadKnockers(slug: string): Promise<KnockersData> {
  const session = await getSession();
  if (!session) {
    return { knockers: [], source: 'fixture-fallback', error: 'no session' };
  }

  try {
    const { db } = await import('@d2d/database');

    const org = await db.org.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!org) throw new Error(`org with slug '${slug}' not found`);

    if (!isCrossTenantOperator(session) && session.orgId !== org.id) {
      throw new Error('tenant scope violation');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const users = await db.user.findMany({
      where: { orgId: org.id, role: 'knocker', status: { not: 'archived' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        givenName: true,
        familyName: true,
        status: true,
        createdAt: true,
      },
    });

    // Today's knocks per user — single grouped query.
    const knockCounts = await db.knock.groupBy({
      by: ['userId'],
      where: {
        orgId: org.id,
        userId: { in: users.map((u) => u.id) },
        capturedAt: { gte: todayStart },
      },
      _count: { _all: true },
    });
    const knockByUser = new Map(knockCounts.map((r) => [r.userId, r._count._all]));

    // Today's conversion counts per knocker.
    const convCounts = await db.conversion.groupBy({
      by: ['knockerId'],
      where: {
        orgId: org.id,
        knockerId: { in: users.map((u) => u.id) },
        signedAt: { gte: todayStart },
      },
      _count: { _all: true },
      _sum: { amountCents: true },
    });
    const convByUser = new Map(
      convCounts.map((r) => [
        r.knockerId!,
        { count: r._count._all, revenueCents: r._sum.amountCents ?? 0n },
      ]),
    );

    // Lifetime conversion rate — all-time knocks vs conversions.
    const lifetimeKnocks = await db.knock.groupBy({
      by: ['userId'],
      where: { orgId: org.id, userId: { in: users.map((u) => u.id) } },
      _count: { _all: true },
    });
    const lifetimeKnockByUser = new Map(lifetimeKnocks.map((r) => [r.userId, r._count._all]));

    const lifetimeConvs = await db.conversion.groupBy({
      by: ['knockerId'],
      where: { orgId: org.id, knockerId: { in: users.map((u) => u.id) } },
      _count: { _all: true },
    });
    const lifetimeConvByUser = new Map(lifetimeConvs.map((r) => [r.knockerId!, r._count._all]));

    const now = new Date();
    const knockers: KnockerRow[] = users.map((u) => {
      const firstName = u.givenName;
      const lastName = u.familyName;
      const name = `${firstName} ${lastName}`.trim();
      const initials =
        firstName && lastName
          ? `${firstName[0]!}${lastName[0]!}`.toUpperCase()
          : firstName
            ? firstName.slice(0, 2).toUpperCase()
            : '??';

      const tenureDays = Math.floor((now.getTime() - u.createdAt.getTime()) / 86_400_000);
      const knocks = knockByUser.get(u.id) ?? 0;
      const conv = convByUser.get(u.id) ?? { count: 0, revenueCents: 0n };
      const ltKnocks = lifetimeKnockByUser.get(u.id) ?? 0;
      const ltConvs = lifetimeConvByUser.get(u.id) ?? 0;
      const convRate = ltKnocks > 0 ? (ltConvs / ltKnocks) * 100 : 0;

      // Live status: DB User.status is active|archived but not the real-time
      // field-status — we map 'active' DB status to 'active' display; all
      // others fall through to 'offline'.
      // TODO(M5): real-time active/break/idle status needs KnockSession feed.
      const displayStatus: KnockerRow['status'] = u.status === 'active' ? 'active' : 'offline';

      return {
        id: u.id,
        name,
        initials,
        status: displayStatus,
        territory: '—',
        tenureDays,
        knocks,
        conversions: conv.count,
        convRate,
        revenueCents: conv.revenueCents,
      };
    });

    return { knockers, source: 'database' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[knockers/${slug}] DB load failed, falling back to fixture:`, err);
    const { account, knockers: fixtureKnockers } = accountData(slug);
    return {
      knockers: fixtureKnockers.map((n) => ({
        id: n.initials + n.name,
        name: n.name,
        initials: n.initials,
        status: n.status as KnockerRow['status'],
        territory: n.territory,
        tenureDays: n.tenureDays,
        knocks: n.knocks,
        conversions: n.conversions,
        convRate: n.convRate,
        revenueCents: n.revenueCents,
      })),
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function tenureLabel(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function KnockersPage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Knockers">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <KnockersEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const { knockers, source, error } = await loadKnockers(params.slug);
  const rollup = rollupFor(params.slug);
  const { account } = accountData(params.slug);

  if (!account || knockers.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Knockers">
        <div className="space-y-5 max-w-[1400px]">
          <KnockersEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const active = knockers.filter((n) => n.status === 'active');
  const onBreak = knockers.filter((n) => n.status === 'break');
  const idle = knockers.filter((n) => n.status === 'idle');
  const offline = knockers.filter((n) => n.status === 'offline');
  const totalRev = knockers.reduce((s, n) => s + n.revenueCents, 0n);
  const totalKnocks = knockers.reduce((s, n) => s + n.knocks, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Knockers">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Roster"
            value={rollup.rosterSize.toLocaleString()}
            hint={`${active.length} active now`}
          />
          <KpiCard
            label="On shift"
            value={(active.length + onBreak.length).toLocaleString()}
            hint={`${onBreak.length} on break`}
          />
          <KpiCard
            label="Idle / Offline"
            value={(idle.length + offline.length).toLocaleString()}
            hint={idle.length > 0 ? `${idle.length} idle · auto-SMS` : 'roster clean'}
          />
          <KpiCard
            label="Knocks today"
            value={totalKnocks.toLocaleString()}
            delta="+8.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Revenue today"
            value={<Money cents={totalRev} region={account.region === 'AU' ? 'AU' : 'US'} />}
            delta="+18.2%"
            deltaTone="positive"
          />
        </div>

        <Section
          title={`Today's roster · ${knockers.length} of ${rollup.rosterSize} shown`}
          subtitle="Sorted by conversions · varied tenure · conv rate spread 3-38%"
          paddedBody={false}
          action={
            source === 'database' ? (
              <span className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold">
                <Database size={10} /> Live
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold"
                title={error}
              >
                <AlertTriangle size={10} /> Fixture
              </span>
            )
          }
        >
          <div className="max-h-[800px] overflow-y-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-surface z-10">
                <tr>
                  <th>Knocker</th>
                  <th>Tenure</th>
                  <th>Territory</th>
                  <th>Status</th>
                  <th>Knocks</th>
                  <th>Conv.</th>
                  <th>Today rate</th>
                  <th>Lifetime rate</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...knockers]
                  .sort((a, b) => b.conversions - a.conversions)
                  .map((n) => {
                    const todayRate = n.knocks > 0 ? (n.conversions / n.knocks) * 100 : 0;
                    return (
                      <tr key={n.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="mono">{n.initials}</span>
                            <span className="text-[13px] text-ink">{n.name}</span>
                          </div>
                        </td>
                        <td className="text-[12px] text-muted numeric">
                          {tenureLabel(n.tenureDays)}
                        </td>
                        <td className="text-[12px] text-muted">{n.territory}</td>
                        <td>
                          <StatusPill
                            tone={REP_STATUS_TONE[n.status === 'training' ? 'idle' : n.status]}
                          >
                            {REP_STATUS_LABEL[n.status === 'training' ? 'idle' : n.status]}
                          </StatusPill>
                        </td>
                        <td className="numeric text-[13px]">{n.knocks}</td>
                        <td className="numeric text-[13px]">{n.conversions}</td>
                        <td className="numeric text-[13px]">
                          {n.knocks > 0 ? (
                            `${todayRate.toFixed(1)}%`
                          ) : (
                            <span className="text-soft">—</span>
                          )}
                        </td>
                        <td className="numeric text-[12px] text-muted">{n.convRate.toFixed(1)}%</td>
                        <td>
                          <Money
                            cents={n.revenueCents}
                            region={account.region === 'AU' ? 'AU' : 'US'}
                            emptyAsDash
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
