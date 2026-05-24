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
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Retargeting roundtrip dashboard.
 *
 * Visualises the knock-not-converted → hashed audience → ad served →
 * click-through → returns as Lead{attributionSource=retargeting} →
 * conversion → 5% rake bucket loop.
 *
 * The 5% bucket is the marketing-studio rake on retargeted revenue
 * (per master plan §10 cost-controls + §13 revenue model).
 */

interface Stage {
  num: number;
  label: string;
  detail: string;
  todayVolume: string;
  icon: typeof Target;
  tone: 'accent' | 'success' | 'warn';
}

const FUNNEL: Stage[] = [
  {
    num: 1,
    label: 'Knock · not converted',
    detail: 'Disposition CALLBACK / NOT_HOME / REFUSED · 14d window',
    todayVolume: '4,812 doors',
    icon: Target,
    tone: 'warn',
  },
  {
    num: 2,
    label: 'Hashed → audience',
    detail: 'SHA-256 on email + phone · uploaded to Meta + Google + TikTok',
    todayVolume: '4,118 hashed',
    icon: Users,
    tone: 'accent',
  },
  {
    num: 3,
    label: 'Ad served',
    detail: 'Programmatic across channel · frequency cap 6/wk',
    todayVolume: '184,210 impressions',
    icon: Sparkles,
    tone: 'accent',
  },
  {
    num: 4,
    label: 'Click-through',
    detail: 'Captured to /returns landing · session-stitched to lead_id',
    todayVolume: '3,142 clicks',
    icon: ArrowRight,
    tone: 'accent',
  },
  {
    num: 5,
    label: 'Returns as Lead',
    detail: 'attributionSource = retargeting · attached to original knock',
    todayVolume: '418 leads',
    icon: Activity,
    tone: 'success',
  },
  {
    num: 6,
    label: 'Conversion',
    detail: 'Routed to billing · 5% to marketing-studio bucket',
    todayVolume: '124 conv',
    icon: CheckCircle2,
    tone: 'success',
  },
];

interface Cohort {
  id: string;
  audience: string;
  account: string;
  channel: 'Meta' | 'Google' | 'TikTok' | 'YouTube';
  reach: number;
  servedImpressions: number;
  ctr: number;
  returns: number;
  conversions: number;
  revenueCents: bigint;
  rakeCents: bigint;
  status: 'active' | 'cooling' | 'ended';
}

const COHORTS: Cohort[] = [
  {
    id: 'aud_4421',
    audience: 'WV AU · NSW SEIFA-9 callbacks (14d)',
    account: 'World Vision (AU)',
    channel: 'Meta',
    reach: 84_210,
    servedImpressions: 412_300,
    ctr: 2.4,
    returns: 184,
    conversions: 64,
    revenueCents: 5_760_00n,
    rakeCents: 288_00n,
    status: 'active',
  },
  {
    id: 'aud_4420',
    audience: 'Hope Forward · NOT_HOME 7d · TX zips',
    account: 'Hope Forward (US)',
    channel: 'Meta',
    reach: 142_300,
    servedImpressions: 612_800,
    ctr: 2.1,
    returns: 218,
    conversions: 88,
    revenueCents: 7_920_00n,
    rakeCents: 396_00n,
    status: 'active',
  },
  {
    id: 'aud_4419',
    audience: 'PestMax · REFUSED 30d (re-engage offer)',
    account: 'PestMax (US)',
    channel: 'TikTok',
    reach: 14_210,
    servedImpressions: 84_100,
    ctr: 2.8,
    returns: 38,
    conversions: 11,
    revenueCents: 982_00n,
    rakeCents: 49_00n,
    status: 'active',
  },
  {
    id: 'aud_4418',
    audience: 'Tampines FSC · NOT_HOME (5-day CPFTA cleared)',
    account: 'Tampines FSC pilot (SG)',
    channel: 'Meta',
    reach: 28_400,
    servedImpressions: 142_300,
    ctr: 1.9,
    returns: 64,
    conversions: 28,
    revenueCents: 1_260_00n,
    rakeCents: 63_00n,
    status: 'active',
  },
  {
    id: 'aud_4417',
    audience: 'SCS · Bedok NOT_HOME 14d',
    account: 'SCS pilot (SG)',
    channel: 'Meta',
    reach: 18_400,
    servedImpressions: 91_400,
    ctr: 2.0,
    returns: 41,
    conversions: 18,
    revenueCents: 810_00n,
    rakeCents: 40_00n,
    status: 'active',
  },
  {
    id: 'aud_4416',
    audience: 'World Vision · VIC CALLBACK (won-call air-cover)',
    account: 'World Vision (AU)',
    channel: 'Google',
    reach: 24_310,
    servedImpressions: 84_120,
    ctr: 2.3,
    returns: 42,
    conversions: 18,
    revenueCents: 1_620_00n,
    rakeCents: 81_00n,
    status: 'cooling',
  },
  {
    id: 'aud_4415',
    audience: 'Hope Forward · Mothers Day re-engage',
    account: 'Hope Forward (US)',
    channel: 'YouTube',
    reach: 312_100,
    servedImpressions: 412_800,
    ctr: 1.4,
    returns: 71,
    conversions: 28,
    revenueCents: 2_520_00n,
    rakeCents: 126_00n,
    status: 'cooling',
  },
  {
    id: 'aud_4414',
    audience: 'PestMax · TX CALLBACK 21d',
    account: 'PestMax (US)',
    channel: 'Google',
    reach: 4_120,
    servedImpressions: 22_400,
    ctr: 2.6,
    returns: 12,
    conversions: 6,
    revenueCents: 534_00n,
    rakeCents: 26_70n,
    status: 'ended',
  },
];

function cohortStatusTone(s: Cohort['status']): 'success' | 'warn' | 'muted' {
  return s === 'active' ? 'success' : s === 'cooling' ? 'warn' : 'muted';
}

export default function RetargetingPage(): JSX.Element {
  const totalReach = COHORTS.reduce((s, c) => s + c.reach, 0);
  const totalReturns = COHORTS.reduce((s, c) => s + c.returns, 0);
  const totalConversions = COHORTS.reduce((s, c) => s + c.conversions, 0);
  const totalRevenue = COHORTS.reduce((s, c) => s + c.revenueCents, 0n);
  const totalRake = COHORTS.reduce((s, c) => s + c.rakeCents, 0n);
  const avgCtr = COHORTS.reduce((s, c) => s + c.ctr, 0) / COHORTS.length;
  const active = COHORTS.filter((c) => c.status === 'active').length;

  return (
    <PlatformShell pageTitle="Retargeting roundtrip">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Target size={14} className="text-accent" />
            <span>
              Knock-not-converted → hashed audience → ad served → click → returns as{' '}
              <span className="font-semibold mono">Lead.attributionSource = retargeting</span> →
              conversion → 5% rake to the marketing-studio bucket. Every loop is provenance-stamped
              and 14-day attribution-window enforced.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Audiences active"
            value={active}
            hint={`of ${COHORTS.length} tracked`}
            deltaTone="positive"
          />
          <KpiCard
            label="Reach (unique people)"
            value={totalReach.toLocaleString()}
            hint="across all cohorts"
          />
          <KpiCard label="Avg CTR" value={`${avgCtr.toFixed(2)}%`} deltaTone="positive" />
          <KpiCard
            label="Returns as Leads"
            value={totalReturns.toLocaleString()}
            hint="click → lead_id rebound"
          />
          <KpiCard
            label="Conversions"
            value={totalConversions.toLocaleString()}
            delta="+18.1%"
            deltaTone="positive"
          />
          <KpiCard
            label="5% bucket revenue"
            value={<Money cents={totalRake} region="US" />}
            hint={`of ${'$' + (Number(totalRevenue) / 100).toFixed(0)} retargeted rev`}
            deltaTone="positive"
          />
        </div>

        <Section
          title="The roundtrip · today"
          subtitle="One-day snapshot of the 6-stage retargeting loop"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative">
            {FUNNEL.map((stage, idx) => {
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
                    {stage.todayVolume}
                  </div>
                  <div className="text-[10.5px] text-muted mt-0.5 leading-snug">{stage.detail}</div>
                  {idx < FUNNEL.length - 1 && (
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
          title={`Active retargeting cohorts · ${COHORTS.length}`}
          subtitle="Per-account audience pipeline · 5% rake auto-routed at conversion"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Audience ID</th>
                <th>Cohort</th>
                <th>Account</th>
                <th>Channel</th>
                <th>Reach</th>
                <th>Impressions</th>
                <th>CTR</th>
                <th>Returns</th>
                <th>Conv</th>
                <th>Revenue</th>
                <th>5% rake</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {COHORTS.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{c.id}</span>
                  </td>
                  <td className="text-[12.5px] text-ink">{c.audience}</td>
                  <td className="text-[12px] text-muted">{c.account}</td>
                  <td className="text-[12px] text-ink">{c.channel}</td>
                  <td className="text-[12px] text-ink numeric">{c.reach.toLocaleString()}</td>
                  <td className="text-[12px] text-muted numeric">
                    {c.servedImpressions.toLocaleString()}
                  </td>
                  <td className="text-[12px] text-ink numeric">{c.ctr.toFixed(2)}%</td>
                  <td className="text-[12px] text-ink numeric">{c.returns.toLocaleString()}</td>
                  <td className="text-[12px] text-ink numeric font-semibold">
                    {c.conversions.toLocaleString()}
                  </td>
                  <td className="text-[12px] text-ink">
                    <Money cents={c.revenueCents} region="US" emptyAsDash />
                  </td>
                  <td className="text-[12px] text-success font-semibold">
                    <Money cents={c.rakeCents} region="US" emptyAsDash />
                  </td>
                  <td>
                    <StatusPill tone={cohortStatusTone(c.status)}>{c.status}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section
            title="5% rake bucket · MTD"
            subtitle="Marketing-studio revenue routed back into Brodie's portfolio"
          >
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3 pb-3 border-b border-line2">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium">
                    MTD bucket
                  </div>
                  <div className="text-[26px] font-semibold text-ink tracking-tight numeric">
                    <Money cents={totalRake} region="US" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium">
                    of retargeted revenue
                  </div>
                  <div className="text-[14px] font-semibold text-ink numeric">
                    <Money cents={totalRevenue} region="US" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-[12px]">
                <RakeRow
                  icon={<TrendingUp size={11} className="text-success" />}
                  label="Sustainer LTV uplift"
                  value="+22%"
                />
                <RakeRow
                  icon={<DollarSign size={11} className="text-accent" />}
                  label="Avg gift size · retargeted"
                  value="$45.20"
                />
                <RakeRow
                  icon={<Activity size={11} className="text-accent" />}
                  label="Time knock → return"
                  value="3.8 days median"
                />
                <RakeRow
                  icon={<Sparkles size={11} className="text-accent" />}
                  label="Provenance: every return tagged"
                  value="100%"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Audience hash health"
            subtitle="SHA-256 deterministic match-rate by channel"
          >
            <div className="space-y-3">
              {[
                { ch: 'Meta', rate: 78.4 },
                { ch: 'Google', rate: 72.1 },
                { ch: 'TikTok', rate: 64.8 },
                { ch: 'YouTube', rate: 71.5 },
              ].map((r) => (
                <div key={r.ch}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-medium text-ink">{r.ch}</span>
                    <span className="text-ink">{r.rate.toFixed(1)}% match</span>
                  </div>
                  <div className="w-full h-1.5 bg-line2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        r.rate >= 75 ? 'bg-success' : r.rate >= 65 ? 'bg-accent' : 'bg-warn'
                      }`}
                      style={{ width: `${r.rate}%` }}
                    />
                  </div>
                </div>
              ))}
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
              value="Knock-based legitimate interest"
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
              value="0 orgs opted out"
              hint="Org.aiRetargetingOptOut"
            />
            <ProvTile
              icon={<Sparkles size={13} className="text-accent" />}
              label="DNC washed"
              value="100%"
              hint="DNC / DNCR / PDPC before every push"
            />
          </div>
        </Section>
      </div>
    </PlatformShell>
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
