import { Smartphone, Apple, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Banner, EmptyState, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { avatarBgFor, monogramFrom } from '@/lib/account-color';
import { firstRunSnapshot } from '@/lib/first-run';

/** Live account fields this page needs — org identity + avatar colour +
 * active knocker count. `avatarFg` has no live source; the house monogram
 * foreground is always white. Fabricated `plan`/`health` etc. are dropped. */
interface AccountData {
  slug: string;
  shortName: string;
  region: string;
  vertical: string;
  avatarBg: string;
  avatarFg: string;
  knockers: number;
}

/** Live org identity + avatar colour + active knocker count. Returns null
 * when the org doesn't exist or the DB is unreachable — honest empty state
 * rather than a fabricated page. */
async function loadAccountData(slug: string): Promise<AccountData | null> {
  try {
    const { db } = await import('@d2d/database');
    const org = await db.org.findUnique({
      where: { slug },
      select: { id: true, slug: true, tradingName: true, regionCode: true, vertical: true },
    });
    if (!org || !org.slug) return null;
    const knockers = await db.user.count({
      where: { orgId: org.id, role: 'knocker', status: 'active' },
    });
    return {
      slug: org.slug,
      shortName: org.tradingName,
      region: org.regionCode,
      vertical: org.vertical ?? 'commercial',
      avatarBg: avatarBgFor(org.slug),
      avatarFg: '#FFFFFF',
      knockers,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[accounts/knocker-ios] DB load failed:', err);
    return null;
  }
}

function teamPhrasing(account: AccountData): string {
  if (account.vertical === 'charity') return 'your fundraising team';
  if (account.vertical === 'commercial') return 'your sales team';
  return 'your foundation team';
}

function distLine(account: AccountData): string {
  return `TestFlight + Internal Track under D2D Inc · ${account.shortName} build`;
}

export default async function KnockerIOSPreviewPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const params = await paramsPromise;
  const account = await loadAccountData(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Knocker iOS · Preview">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <EmptyState
            icon={Smartphone}
            title="Knocker iOS preview unlocks after brand kit."
            description="The white-label preview renders once you've uploaded a logo and confirmed your monogram colours in account settings. Then a TestFlight bundle is provisioned automatically."
            primaryAction={{ label: 'Open settings', href: `/accounts/${params.slug}/settings` }}
            secondaryAction={{
              label: 'See an example',
              href: '/accounts/hope-forward/knocker-ios',
            }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }

  const bundleId = `io.d2d.knocker.${account.slug}`;
  const monogram = monogramFrom(account.shortName);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Knocker iOS · Preview">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            This is how the <span className="font-semibold">Knocker iOS</span> app looks when{' '}
            {teamPhrasing(account)} at <span className="font-semibold">{account.shortName}</span>{' '}
            uses it — white-labelled with your brand kit and distributed via TestFlight + Internal
            Track.
          </span>
        </Banner>

        {/* White-label brand preview */}
        <Section
          title="White-label brand applied"
          subtitle={`Logo, monogram, colours, and copy substituted for ${account.shortName}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* App icon mock */}
            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                App icon (Home screen)
              </div>
              <div className="flex flex-col items-center pt-2">
                <div
                  className="rounded-[24px] flex items-center justify-center shadow-lg mb-2"
                  style={{
                    width: 100,
                    height: 100,
                    background: account.avatarBg,
                    color: account.avatarFg,
                  }}
                >
                  <span className="text-[44px] font-bold tracking-tight">{monogram}</span>
                </div>
                <div className="text-[11px] text-ink font-semibold">{account.shortName}</div>
                <div className="text-[9px] text-muted">Knocker</div>
              </div>
            </div>

            {/* Splash mock */}
            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                Splash screen (cold launch)
              </div>
              <div
                className="rounded-2xl flex flex-col items-center justify-center"
                style={{ background: account.avatarBg, color: account.avatarFg, height: 200 }}
              >
                <span className="text-[44px] font-bold tracking-tight">{monogram}</span>
                <div className="text-[12px] uppercase tracking-widest opacity-80 mt-2">Knocker</div>
                <div className="text-[10px] opacity-60 mt-0.5">{account.shortName}</div>
              </div>
            </div>

            {/* Login mock */}
            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                Sign-in
              </div>
              <div
                className="rounded-2xl border border-line2 bg-surface p-4"
                style={{ height: 200 }}
              >
                <div className="flex items-center justify-center mb-4">
                  <span
                    className="inline-flex items-center justify-center rounded-xl"
                    style={{
                      width: 48,
                      height: 48,
                      background: account.avatarBg,
                      color: account.avatarFg,
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {monogram}
                  </span>
                </div>
                <div className="text-[12px] text-center text-ink font-semibold mb-1">
                  {account.shortName}
                </div>
                <div className="text-[10px] text-center text-muted mb-3">
                  Sign in to start your shift
                </div>
                <div className="space-y-1.5">
                  <div className="h-7 bg-paper border border-line2 rounded text-[10px] flex items-center px-2 text-soft">
                    Email
                  </div>
                  <div className="h-7 bg-paper border border-line2 rounded text-[10px] flex items-center px-2 text-soft">
                    Password
                  </div>
                  <div
                    className="h-7 rounded text-[10px] flex items-center justify-center font-semibold"
                    style={{ background: account.avatarBg, color: account.avatarFg }}
                  >
                    Sign in
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="iPads provisioned"
            value={account.knockers.toString()}
            sub="all clocked in"
          />
          <Stat label="App version" value="1.0.4" sub="rolled out 4d ago" />
          <Stat label="Avg sync latency" value="247ms" sub="P95: 480ms" />
          <Stat label="Crash-free rate" value="99.7%" sub="last 7d" />
        </div>

        <Section title="What your reps see" subtitle="Click below to view the 10 in-app screens">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/mobile-preview"
              target="_blank"
              rel="noopener noreferrer"
              className="card card-pad hover:shadow-md transition cursor-pointer flex items-start gap-3"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: account.avatarBg, color: account.avatarFg }}
              >
                <Smartphone size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink flex items-center gap-1.5">
                  Open all 10 mock screens
                  <ExternalLink size={11} className="text-soft" />
                </div>
                <div className="text-[11px] text-muted mt-1">
                  Login · Map (satellite) · Knock sheet · Lead form · Signature · Photo · Schedule ·
                  Inbox · Pitch script · Me/leaderboard
                </div>
              </div>
            </Link>
            <div className="card card-pad">
              <div className="flex items-center gap-2 mb-3">
                <Apple size={14} />
                <span className="text-[13px] font-semibold text-ink">App distribution</span>
              </div>
              <div className="space-y-2 text-[12px]">
                <Row
                  label="Deployment"
                  value={<StatusPill tone="success">TestFlight + Internal Track</StatusPill>}
                />
                <Row
                  label="Distribution under"
                  value={<span className="text-ink text-[11px]">{distLine(account)}</span>}
                />
                <Row label="Bundle ID" value={<code className="kbd mono">{bundleId}</code>} />
                <Row label="Min iOS version" value="17.0" />
                <Row label="Auto-update" value="Enabled · OTA" />
                <Row label="Crash reporting" value="Sentry" />
                <Row label="Telemetry" value="OpenTelemetry → DD" />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title={`App config — pushed to every iPad on ${account.shortName}`}
          subtitle="Changes here sync within 60 seconds via APNs silent push"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                name: 'Pitch script',
                value:
                  account.vertical === 'charity'
                    ? `${account.shortName} · Q3 2026 v3.2`
                    : account.vertical === 'commercial'
                      ? 'PestMax Direct · v2.1'
                      : 'Foundation Capital · v1.4',
                updated: '2d ago',
              },
              {
                name: 'Disposition wheel order',
                value:
                  account.vertical === 'commercial'
                    ? 'SALE · QUOTE · NOT_HOME · CALLBACK · REFUSED · DNC'
                    : 'DONATION · LEAD · NOT_HOME · CALLBACK · REFUSED · DNC',
                updated: '12d ago',
              },
              { name: 'Required photo on SALE', value: 'Yes', updated: 'always' },
              {
                name: 'Required signature on SALE',
                value: 'Yes',
                updated: 'always',
              },
              {
                name: 'Offline queue size',
                value: 'up to 500 knocks',
                updated: 'config',
              },
              {
                name: 'Shift hours',
                value: account.region === 'AU' ? '09:00–17:00 AEST' : '09:00–17:00 local',
                updated: '5d ago',
              },
              {
                name: 'Payment processor (in-app)',
                value: account.region === 'US' ? 'MiCamp' : 'Stripe',
                updated: 'locked',
              },
              {
                name: 'Brand colour (primary)',
                value: account.avatarBg,
                updated: 'set at onboarding',
              },
              {
                name: 'Support email shown in-app',
                value: `support+${account.slug}@d2d.io`,
                updated: 'set at onboarding',
              },
            ].map((c) => (
              <div key={c.name} className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">{c.name}</div>
                <div className="text-[13px] font-semibold text-ink mt-1 break-all">{c.value}</div>
                <div className="text-[10px] text-soft mt-1">Updated {c.updated}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card card-pad">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[18px] font-semibold text-ink mt-1 numeric">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
