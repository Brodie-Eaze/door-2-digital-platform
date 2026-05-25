import {
  Target,
  Users,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { getAccount } from '@/lib/accounts';
import { getAccountMarketing } from '@/lib/account-marketing';
import { pickCreativeImage } from '@/lib/creative-images';

/**
 * Per-account retargeting roundtrip — knock-not-converted → hashed audience →
 * ad served → click → returns as Lead → conversion → 5% rake bucket loop,
 * all scoped to this account's cohorts.
 */

interface PageProps {
  params: { slug: string };
}

const STAGES: Array<{
  num: number;
  label: string;
  detail: string;
  icon: typeof Target;
  tone: 'accent' | 'success' | 'warn';
}> = [
  {
    num: 1,
    label: 'Knock · not converted',
    detail: 'Disposition CALLBACK / NOT_HOME / REFUSED · 14d window',
    icon: Target,
    tone: 'warn',
  },
  {
    num: 2,
    label: 'Hashed → audience',
    detail: 'SHA-256 on email + phone · uploaded to enabled channels',
    icon: Users,
    tone: 'accent',
  },
  {
    num: 3,
    label: 'Ad served',
    detail: 'Programmatic across channel · frequency cap 6/wk',
    icon: Sparkles,
    tone: 'accent',
  },
  {
    num: 4,
    label: 'Click-through',
    detail: 'Captured to /returns landing · session-stitched to lead_id',
    icon: ArrowRight,
    tone: 'accent',
  },
  {
    num: 5,
    label: 'Returns as Lead',
    detail: 'attributionSource = retargeting · attached to original knock',
    icon: Activity,
    tone: 'success',
  },
  {
    num: 6,
    label: 'Conversion',
    detail: 'Routed to billing · 5% to marketing-studio bucket',
    icon: CheckCircle2,
    tone: 'success',
  },
];

export default function Page({ params }: PageProps): JSX.Element {
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);

  if (!account || !data) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Retargeting">
        <div className="text-[13px] text-muted">No marketing data wired for this account.</div>
      </AccountShell>
    );
  }

  const totalAud = data.retargetingCohorts.reduce((s, c) => s + c.audienceSize, 0);
  const totalReach = data.retargetingCohorts.reduce((s, c) => s + c.reach, 0);
  const totalConv = data.retargetingCohorts.reduce((s, c) => s + c.attributedConversions, 0);
  const totalRev = data.retargetingCohorts.reduce((s, c) => s + c.revenueCents, 0);
  const totalRake = Math.round(totalRev * 0.05);
  const avgCtr =
    data.retargetingCohorts.length > 0
      ? data.retargetingCohorts.reduce((s, c) => s + c.ctrPct, 0) / data.retargetingCohorts.length
      : 0;

  // Estimate per-stage volumes from cohorts (today snapshot)
  const dailyKnocks = Math.round(totalAud * 0.06);
  const dailyHashed = Math.round(dailyKnocks * 0.86);
  const dailyImpressions = Math.round(totalReach * 0.18);
  const dailyClicks = Math.round((dailyImpressions * avgCtr) / 100);
  const dailyReturns = Math.round(dailyClicks * 0.14);
  const dailyConv = Math.round(dailyReturns * 0.3);

  const stageVolumes: Record<number, string> = {
    1: `${dailyKnocks.toLocaleString()} doors`,
    2: `${dailyHashed.toLocaleString()} hashed`,
    3: `${dailyImpressions.toLocaleString()} imps`,
    4: `${dailyClicks.toLocaleString()} clicks`,
    5: `${dailyReturns.toLocaleString()} leads`,
    6: `${dailyConv.toLocaleString()} conv`,
  };

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Retargeting`}
    >
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="retargeting" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Target size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.scopeLabel}</span> retargeting —
              knock-not-converted → hashed → ad served → click → returns as{' '}
              <span className="font-semibold mono">Lead.attributionSource = retargeting</span> →
              conversion → 5% rake. All cohorts scoped to this account.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Audiences"
            value={data.retargetingCohorts.length}
            hint={`${account.shortName} only`}
            deltaTone="positive"
          />
          <KpiCard
            label="Audience size"
            value={totalAud.toLocaleString()}
            hint="unique people in cohorts"
          />
          <KpiCard
            label="Total reach"
            value={totalReach.toLocaleString()}
            hint="impressions served"
          />
          <KpiCard label="Avg CTR" value={`${avgCtr.toFixed(2)}%`} deltaTone="positive" />
          <KpiCard label="Conversions" value={totalConv.toLocaleString()} deltaTone="positive" />
          <KpiCard
            label="5% rake · MTD"
            value={<Money cents={BigInt(totalRake)} region={data.region} />}
            hint={`of ${'$' + (totalRev / 100).toFixed(0)} retargeted`}
            deltaTone="positive"
          />
        </div>

        <Section
          title="The roundtrip · today"
          subtitle="One-day snapshot of the 6-stage retargeting loop for this account"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              return (
                <div key={stage.num} className="card card-pad relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-6 h-6 rounded ${
                        stage.tone === 'success'
                          ? 'bg-successSoft text-success'
                          : stage.tone === 'warn'
                            ? 'bg-warnSoft text-warn'
                            : 'bg-accentSoft text-accent'
                      } flex items-center justify-center`}
                    >
                      <Icon size={13} />
                    </span>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                        Stage {stage.num}
                      </div>
                      <div className="text-[12px] font-semibold text-ink leading-tight">
                        {stage.label}
                      </div>
                    </div>
                  </div>
                  <div className="text-[17px] font-semibold text-ink tracking-tight numeric">
                    {stageVolumes[stage.num]}
                  </div>
                  <div className="text-[10.5px] text-muted mt-0.5 leading-snug">{stage.detail}</div>
                  {idx < STAGES.length - 1 && (
                    <div className="hidden md:block absolute right-[-9px] top-1/2 -translate-y-1/2 text-soft text-[14px] z-10">
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title={`Active cohorts · ${data.retargetingCohorts.length}`}
          subtitle={`Per-account audience pipeline · 5% rake auto-routed at conversion · ${data.currency}`}
          paddedBody={false}
        >
          {data.retargetingCohorts.length === 0 ? (
            <div className="text-center py-8 text-[12.5px] text-muted">
              No retargeting cohorts wired for this account yet.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Audience ID</th>
                  <th>Cohort</th>
                  <th>Source</th>
                  <th>Audience size</th>
                  <th>Reach</th>
                  <th>CTR</th>
                  <th>Conv</th>
                  <th>Revenue</th>
                  <th>5% rake</th>
                </tr>
              </thead>
              <tbody>
                {data.retargetingCohorts.map((c, i) => {
                  // Pick a theme from this account's themes for the thumbnail
                  const theme = data.themes[i % data.themes.length]!;
                  const rake = Math.round(c.revenueCents * 0.05);
                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-paper">
                      <td className="!pr-0 w-[60px]">
                        <div className="w-12 h-12 rounded-md overflow-hidden border border-line2 bg-paper">
                          <img
                            src={pickCreativeImage(theme, c.id)}
                            alt={c.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td>
                        <span className="mono text-[10px] !w-auto !px-2">{c.id}</span>
                      </td>
                      <td className="text-[12.5px] text-ink leading-snug">{c.name}</td>
                      <td className="text-[11px] text-muted">{c.source}</td>
                      <td className="text-[12px] text-ink numeric">
                        {c.audienceSize.toLocaleString()}
                      </td>
                      <td className="text-[12px] text-ink numeric">{c.reach.toLocaleString()}</td>
                      <td className="text-[12px] text-ink numeric">{c.ctrPct.toFixed(2)}%</td>
                      <td className="text-[12px] text-ink numeric font-semibold">
                        {c.attributedConversions.toLocaleString()}
                      </td>
                      <td className="text-[12px] text-ink">
                        <Money cents={BigInt(c.revenueCents)} region={data.region} emptyAsDash />
                      </td>
                      <td className="text-[12px] text-success font-semibold">
                        <Money cents={BigInt(rake)} region={data.region} emptyAsDash />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section
            title="5% rake bucket · MTD"
            subtitle={`Marketing-studio revenue from ${account.shortName} retargeting`}
          >
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3 pb-3 border-b border-line2">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium">
                    MTD bucket
                  </div>
                  <div className="text-[26px] font-semibold text-ink tracking-tight numeric">
                    <Money cents={BigInt(totalRake)} region={data.region} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium">
                    of retargeted revenue
                  </div>
                  <div className="text-[14px] font-semibold text-ink numeric">
                    <Money cents={BigInt(totalRev)} region={data.region} />
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-[12px]">
                <RakeRow
                  icon={<TrendingUp size={11} className="text-success" />}
                  label="Avg conversion lift"
                  value={data.vertical === 'commercial' ? '+18%' : '+22%'}
                />
                <RakeRow
                  icon={<DollarSign size={11} className="text-accent" />}
                  label="Avg gift / sale"
                  value={totalConv > 0 ? `$${(totalRev / totalConv / 100).toFixed(2)}` : '—'}
                />
                <RakeRow
                  icon={<Activity size={11} className="text-accent" />}
                  label="Time knock → return"
                  value="3.8 days median"
                />
                <RakeRow
                  icon={<Sparkles size={11} className="text-accent" />}
                  label="Provenance"
                  value="100% retarget-tagged"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Channel match-rate"
            subtitle={`SHA-256 deterministic match · ${data.channels.join(' · ')}`}
          >
            <div className="space-y-3">
              {data.channels
                .filter((ch) => ch !== 'email' && ch !== 'sms')
                .map((ch) => {
                  const rateByCh: Record<string, number> = {
                    meta: 78.4,
                    google: 72.1,
                    tiktok: 64.8,
                    youtube: 71.5,
                  };
                  const r = rateByCh[ch] ?? 70;
                  return (
                    <div key={ch}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="font-medium text-ink capitalize">{ch}</span>
                        <span className="text-ink">{r.toFixed(1)}% match</span>
                      </div>
                      <div className="w-full h-1.5 bg-line2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            r >= 75 ? 'bg-success' : r >= 65 ? 'bg-accent' : 'bg-warn'
                          }`}
                          style={{ width: `${r}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-3 pt-3 border-t border-line2 text-[11px] text-muted">
              Hashes sent server-side via CAPI / Conversions API · no third-party cookies. PII never
              leaves D2D servers unhashed.
            </div>
          </Section>
        </div>

        <Section
          title="Provenance & consent"
          subtitle="Every retargeted impression has a recorded basis"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ProvTile
              icon={<CheckCircle2 size={13} className="text-success" />}
              label="Consent type"
              value={data.region === 'AU' ? 'ACMA-compliant opt-in' : 'Knock-based legit interest'}
              hint="14-day window · then expires"
            />
            <ProvTile
              icon={<Target size={13} className="text-accent" />}
              label="Match basis"
              value="Hashed phone + email"
              hint="SHA-256 server-side via CAPI"
            />
            <ProvTile
              icon={<Users size={13} className="text-accent" />}
              label="Org opt-out flag"
              value="0 contacts opted out"
              hint="account-scope flag"
            />
            <ProvTile
              icon={<Sparkles size={13} className="text-accent" />}
              label="DNC washed"
              value="100%"
              hint={data.region === 'AU' ? 'DNCR before every push' : 'DNC before every push'}
            />
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

function RakeRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-ink font-semibold numeric">{value}</span>
    </div>
  );
}

function ProvTile({
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
      <div className="mt-1.5 text-[13.5px] font-semibold text-ink leading-tight">{value}</div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}
