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
  seedSeed: string;
  audience: string;
  account: string;
  source: string;
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
    seedSeed: 'worldvision-au-winter-4954',
    audience: 'WV AU · NSW SEIFA-9 callbacks (14d)',
    account: 'World Vision (AU)',
    source: '4,812 knocks · CALLBACK + NOT_HOME 14d',
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
    seedSeed: 'hopeforward-tx-meals-4960',
    audience: 'Hope Forward · NOT_HOME 7d · TX zips',
    account: 'Hope Forward (US)',
    source: '8,422 knocks · NOT_HOME 7d',
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
    seedSeed: 'pestmax-tx-roach-4958',
    audience: 'PestMax · REFUSED 30d (re-engage offer)',
    account: 'PestMax (US)',
    source: '1,184 knocks · REFUSED 30d',
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
    seedSeed: 'tampines-fsc-neighbour-4959',
    audience: 'Tampines FSC · NOT_HOME (5-day CPFTA cleared)',
    account: 'Tampines FSC pilot (SG)',
    source: '2,420 knocks · NOT_HOME · CPFTA-cleared',
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
    seedSeed: 'scs-recovery-story-4925',
    audience: 'SCS · Bedok NOT_HOME 14d',
    account: 'SCS pilot (SG)',
    source: '1,820 knocks · Bedok block 412',
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
    seedSeed: 'wv-au-carlton-knock-4916',
    audience: 'World Vision · VIC CALLBACK (won-call air-cover)',
    account: 'World Vision (AU)',
    source: '1,240 knocks · CALLBACK 21d',
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
    seedSeed: 'hf-mothers-day-4906',
    audience: 'Hope Forward · Mothers Day re-engage',
    account: 'Hope Forward (US)',
    source: '12,100 knocks · prior-year sponsors',
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
    seedSeed: 'pestmax-az-termite-4931',
    audience: 'PestMax · TX CALLBACK 21d',
    account: 'PestMax (US)',
    source: '420 knocks · CALLBACK 21d',
    channel: 'Google',
    reach: 4_120,
    servedImpressions: 22_400,
    ctr: 2.6,
    returns: 12,
    conversions: 6,
    revenueCents: 534_00n,
    rakeCents: 27_00n,
    status: 'ended',
  },
  {
    id: 'aud_4413',
    seedSeed: 'goldcoast-oncology-4937',
    audience: 'Gold Coast Hospital · NOT_HOME 14d',
    account: 'Gold Coast Hospital (AU)',
    source: '820 knocks · QLD high-income',
    channel: 'Meta',
    reach: 12_400,
    servedImpressions: 61_200,
    ctr: 2.2,
    returns: 28,
    conversions: 8,
    revenueCents: 4_800_00n,
    rakeCents: 240_00n,
    status: 'active',
  },
  {
    id: 'aud_4412',
    seedSeed: 'sunlinkco-boise-solar-4956',
    audience: 'SunlinkCo · ID + WA REFUSED 30d',
    account: 'SunlinkCo (US)',
    source: '1,640 knocks · re-engage post-summer',
    channel: 'Meta',
    reach: 18_200,
    servedImpressions: 71_400,
    ctr: 1.8,
    returns: 32,
    conversions: 14,
    revenueCents: 2_800_00n,
    rakeCents: 140_00n,
    status: 'active',
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
          title="Channel match-rate · hashed audience push"
          subtitle="SHA-256 deterministic match on phone + email · CAPI server-side"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { ch: 'Meta', rate: 78.4, pushedToday: 4_118, color: 'bg-blue-600' },
              { ch: 'Google', rate: 72.1, pushedToday: 3_812, color: 'bg-amber-600' },
              { ch: 'TikTok', rate: 64.8, pushedToday: 1_184, color: 'bg-rose-600' },
              { ch: 'YouTube', rate: 71.5, pushedToday: 2_410, color: 'bg-red-600' },
            ].map((r) => (
              <div key={r.ch} className="border border-line2 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded ${r.color} text-surface flex items-center justify-center text-[9.5px] font-bold uppercase`}
                    >
                      {r.ch.slice(0, 2)}
                    </span>
                    <span className="text-[12.5px] font-semibold text-ink">{r.ch}</span>
                  </div>
                  <span
                    className={`text-[14px] font-semibold ${r.rate >= 75 ? 'text-success' : r.rate >= 65 ? 'text-accent' : 'text-warn'}`}
                  >
                    {r.rate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-line2 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full ${r.rate >= 75 ? 'bg-success' : r.rate >= 65 ? 'bg-accent' : 'bg-warn'}`}
                    style={{ width: `${r.rate}%` }}
                  />
                </div>
                <div className="text-[10.5px] text-muted">
                  pushed today ·{' '}
                  <span className="text-ink font-semibold numeric">
                    {r.pushedToday.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

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
                <th></th>
                <th>Audience ID</th>
                <th>Cohort</th>
                <th>Account</th>
                <th>Source</th>
                <th>Channel</th>
                <th>Reach</th>
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
                <tr key={c.id} className="cursor-pointer hover:bg-paper">
                  <td className="!pr-0 w-[60px]">
                    <div className="w-12 h-12 rounded-md overflow-hidden border border-line2 bg-paper">
                      <img
                        src={`https://picsum.photos/seed/${c.seedSeed}/96/96`}
                        alt={c.audience}
                        width={48}
                        height={48}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{c.id}</span>
                  </td>
                  <td className="text-[12.5px] text-ink leading-snug">{c.audience}</td>
                  <td className="text-[12px] text-muted">{c.account}</td>
                  <td className="text-[11px] text-muted">{c.source}</td>
                  <td className="text-[12px] text-ink">{c.channel}</td>
                  <td className="text-[12px] text-ink numeric">{c.reach.toLocaleString()}</td>
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
