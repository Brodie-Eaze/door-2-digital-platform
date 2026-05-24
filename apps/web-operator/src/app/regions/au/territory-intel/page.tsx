import { Sparkles, MapPin, Eye, Plus, Filter, Database } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

interface AuZone {
  name: string;
  state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT';
  postcode: string;
  seifaDecile: number; // 1 (most disadvantaged) — 10 (least)
  density: 'High' | 'Medium' | 'Low';
  propensity: number;
  saturation: number;
  knockable: number;
  status: 'AI suggested' | 'Active' | 'Low-yield' | 'Blocked (WA reg pending)';
  tone: 'success' | 'info' | 'muted' | 'danger';
}

const ZONES: AuZone[] = [
  {
    name: 'Sydney North · Chatswood',
    state: 'NSW',
    postcode: '2067',
    seifaDecile: 9,
    density: 'High',
    propensity: 0.79,
    saturation: 0,
    knockable: 4_120,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Melbourne Inner · Carlton',
    state: 'VIC',
    postcode: '3053',
    seifaDecile: 8,
    density: 'High',
    propensity: 0.76,
    saturation: 0,
    knockable: 3_840,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Brisbane West · Toowong',
    state: 'QLD',
    postcode: '4066',
    seifaDecile: 9,
    density: 'Medium',
    propensity: 0.73,
    saturation: 12,
    knockable: 2_910,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Perth South · Applecross',
    state: 'WA',
    postcode: '6153',
    seifaDecile: 10,
    density: 'Low',
    propensity: 0.71,
    saturation: 0,
    knockable: 1_840,
    status: 'Blocked (WA reg pending)',
    tone: 'danger',
  },
  {
    name: 'Adelaide Hills · Mitcham',
    state: 'SA',
    postcode: '5062',
    seifaDecile: 9,
    density: 'Medium',
    propensity: 0.69,
    saturation: 18,
    knockable: 2_350,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Gold Coast · Burleigh Heads',
    state: 'QLD',
    postcode: '4220',
    seifaDecile: 7,
    density: 'High',
    propensity: 0.67,
    saturation: 24,
    knockable: 3_510,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Sydney East · Bondi',
    state: 'NSW',
    postcode: '2026',
    seifaDecile: 10,
    density: 'High',
    propensity: 0.66,
    saturation: 31,
    knockable: 2_140,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Melbourne East · Box Hill',
    state: 'VIC',
    postcode: '3128',
    seifaDecile: 8,
    density: 'High',
    propensity: 0.64,
    saturation: 14,
    knockable: 4_280,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Newcastle · Merewether',
    state: 'NSW',
    postcode: '2291',
    seifaDecile: 9,
    density: 'Medium',
    propensity: 0.63,
    saturation: 0,
    knockable: 1_980,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Canberra · Manuka',
    state: 'ACT',
    postcode: '2603',
    seifaDecile: 10,
    density: 'Medium',
    propensity: 0.61,
    saturation: 8,
    knockable: 1_240,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Brisbane North · Albion',
    state: 'QLD',
    postcode: '4010',
    seifaDecile: 7,
    density: 'Medium',
    propensity: 0.58,
    saturation: 22,
    knockable: 2_410,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Hobart · Sandy Bay',
    state: 'TAS',
    postcode: '7005',
    seifaDecile: 9,
    density: 'Low',
    propensity: 0.56,
    saturation: 0,
    knockable: 1_180,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Melbourne West · Footscray',
    state: 'VIC',
    postcode: '3011',
    seifaDecile: 4,
    density: 'High',
    propensity: 0.42,
    saturation: 38,
    knockable: 3_290,
    status: 'Low-yield',
    tone: 'muted',
  },
  {
    name: 'Sydney West · Mt Druitt',
    state: 'NSW',
    postcode: '2770',
    seifaDecile: 2,
    density: 'High',
    propensity: 0.39,
    saturation: 0,
    knockable: 4_640,
    status: 'Low-yield',
    tone: 'muted',
  },
  {
    name: 'Perth East · Midland',
    state: 'WA',
    postcode: '6056',
    seifaDecile: 3,
    density: 'Medium',
    propensity: 0.37,
    saturation: 0,
    knockable: 2_180,
    status: 'Blocked (WA reg pending)',
    tone: 'danger',
  },
];

const AU_DATA_SOURCES = [
  {
    name: 'ABS SEIFA 2021',
    detail: 'Index of Relative Socio-Economic Disadvantage · decile per SA1',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'ABS Mesh Blocks',
    detail: '~358k boundaries · finest census geography',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'ABS Census 2021',
    detail: 'Income · age · household · dwelling cross-tabs per SA2',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'Australia Post PAF',
    detail: 'Postal Address File · 13.8M deliverable addresses · DPID',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'CoreLogic AU',
    detail: 'Property values · rental yields · transactions per LGA',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'CHOICE DNK registry',
    detail: 'Address-level Do Not Knock opt-out flags',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'ACMA DNCR',
    detail: 'Do Not Call Register · live wash on phone fields',
    region: 'AU',
    status: 'connected',
  },
  {
    name: 'Internal cohorts (AU)',
    detail: 'AU conversion history per zone · last 12mo',
    region: 'AU',
    status: 'connected',
  },
];

interface AuCity {
  name: string;
  x: number;
  y: number;
  state: string;
}

const AU_CITIES: AuCity[] = [
  { name: 'Perth', x: 12, y: 60, state: 'WA' },
  { name: 'Darwin', x: 38, y: 18, state: 'NT' },
  { name: 'Adelaide', x: 52, y: 75, state: 'SA' },
  { name: 'Melbourne', x: 68, y: 86, state: 'VIC' },
  { name: 'Canberra', x: 76, y: 78, state: 'ACT' },
  { name: 'Sydney', x: 82, y: 70, state: 'NSW' },
  { name: 'Brisbane', x: 82, y: 50, state: 'QLD' },
  { name: 'Hobart', x: 70, y: 96, state: 'TAS' },
];

export default function AuTerritoryIntelPage(): JSX.Element {
  const meanDecile = (ZONES.reduce((s, z) => s + z.seifaDecile, 0) / ZONES.length).toFixed(1);
  const totalKnockable = ZONES.reduce((s, z) => s + z.knockable, 0);
  const active = ZONES.filter((z) => z.status === 'Active').length;
  const aiSuggested = ZONES.filter((z) => z.status === 'AI suggested').length;
  const blocked = ZONES.filter((z) => z.status.startsWith('Blocked')).length;

  return (
    <PlatformShell pageTitle="AU territory intelligence">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              AU zone propensity blends <span className="font-semibold">ABS SEIFA</span> (decile per
              SA1), <span className="font-semibold">Mesh Block</span> density, ABS Census income
              cross-tabs, CoreLogic dwelling values, and your AU conversion history. Zones in WA are
              gated until the WA paid-solicitor registration clears.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="SA1 zones tracked" value={ZONES.length} hint="across AU Phase 2" />
          <KpiCard
            label="Mean SEIFA decile"
            value={meanDecile}
            hint="of active zones · 10 = least disadv."
            deltaTone="positive"
          />
          <KpiCard
            label="Knockable doors AU"
            value={totalKnockable.toLocaleString()}
            hint="net of DNK + DNCR"
          />
          <KpiCard label="ACNC-cleared LGAs" value={487} hint="of 537" deltaTone="positive" />
          <KpiCard label="Blocked zones" value={blocked} hint="WA pending" deltaTone="negative" />
        </div>

        <Section
          title="Propensity heatmap · Australia"
          subtitle="SA1-level · capital cities labelled · click any cell to drill in"
        >
          <div className="bg-ink rounded-xl overflow-hidden relative" style={{ height: 420 }}>
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: 'repeat(22, 1fr)',
                gridTemplateRows: 'repeat(14, 1fr)',
                gap: 1,
              }}
            >
              {Array.from({ length: 22 * 14 }).map((_, i) => {
                const col = i % 22;
                const row = Math.floor(i / 22);
                // Rough AU silhouette mask
                const onLand = isAuLand(col, row);
                if (!onLand) {
                  return <div key={i} style={{ background: 'transparent' }} />;
                }
                // Hot near east coast capitals
                const r =
                  Math.sin(col * 0.45 + row * 0.31) * Math.cos(col * 0.21 + row * 0.18) +
                  (col > 14 && row > 5 ? 0.3 : 0) -
                  (col < 8 && row > 10 ? 0.2 : 0);
                const intensity = (r + 1) / 2;
                let bg = 'rgba(148,163,184,0.18)';
                if (intensity > 0.78) bg = 'rgba(34,197,94,0.65)';
                else if (intensity > 0.58) bg = 'rgba(59,130,246,0.55)';
                else if (intensity > 0.38) bg = 'rgba(245,158,11,0.45)';
                else if (intensity > 0.18) bg = 'rgba(239,68,68,0.35)';
                return (
                  <div
                    key={i}
                    style={{ background: bg }}
                    className="hover:ring-2 hover:ring-white/40 cursor-pointer transition"
                  />
                );
              })}
            </div>

            {AU_CITIES.map((c) => (
              <div
                key={c.name}
                className="absolute text-surface text-[11px] font-semibold drop-shadow-md pointer-events-none flex items-center gap-1"
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-surface shadow" />
                {c.name}
              </div>
            ))}

            <div className="absolute bottom-3 left-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
                Propensity
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-rose-500/50" /> 0–0.2
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-amber-500/60" /> 0.2–0.5
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-accent/60" /> 0.5–0.75
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-green-500/70" /> 0.75+
                </span>
              </div>
            </div>

            <div className="absolute top-3 right-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm text-[10px] text-muted">
              <div className="font-semibold text-ink mb-1">AU live counters</div>
              <div>
                {ZONES.length} SA1 zones · {active} active · {aiSuggested} suggested
              </div>
              <div>{blocked} blocked (WA reg pending)</div>
            </div>
          </div>
        </Section>

        <Section
          title="All AU zones · ranked by propensity"
          subtitle="SEIFA decile = 10 (least disadvantaged) is shorthand for higher giving capacity"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                Filter
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
                New AU zone
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Zone</th>
                <th>State</th>
                <th>SEIFA</th>
                <th>Density</th>
                <th>Propensity</th>
                <th>Saturation</th>
                <th>Knockable</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ZONES.map((z) => (
                <tr key={z.name}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-soft shrink-0" />
                      <div>
                        <div className="text-[13px] font-medium text-ink">{z.name}</div>
                        <div className="text-[10px] text-muted">postcode {z.postcode}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="mono !w-9 !text-[10px]">{z.state}</span>
                  </td>
                  <td>
                    <SeifaBadge decile={z.seifaDecile} />
                  </td>
                  <td className="text-[12px] text-muted">{z.density}</td>
                  <td>
                    <PropensityBar score={z.propensity} />
                  </td>
                  <td className="text-[12px] text-muted numeric">{z.saturation}%</td>
                  <td className="text-[12px] text-ink numeric">{z.knockable.toLocaleString()}</td>
                  <td>
                    <StatusPill tone={z.tone}>{z.status}</StatusPill>
                  </td>
                  <td>
                    {z.status === 'AI suggested' ? (
                      <button className="text-[11px] font-semibold text-accent hover:underline">
                        Send rep →
                      </button>
                    ) : (
                      <button className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center">
                        <Eye size={12} className="text-soft" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="AU data feeding propensity model"
          subtitle="Nightly ingest · attribution preserved per APP 1"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AU_DATA_SOURCES.map((s) => (
              <div key={s.name} className="card card-pad">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Database size={11} className="text-soft shrink-0" />
                      <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                    </div>
                    <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                  </div>
                  <span className="tag !text-[9px]">{s.region}</span>
                </div>
                <div className="mt-2">
                  <StatusPill tone="success">{s.status}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}

function PropensityBar({ score }: { score: number }): JSX.Element {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.75
      ? 'bg-green-500'
      : score >= 0.5
        ? 'bg-accent'
        : score >= 0.25
          ? 'bg-amber-500'
          : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-line2 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-ink numeric w-8">{score.toFixed(2)}</span>
    </div>
  );
}

function SeifaBadge({ decile }: { decile: number }): JSX.Element {
  const tone =
    decile >= 9
      ? 'bg-successSoft text-success'
      : decile >= 7
        ? 'bg-accentSoft text-accent'
        : decile >= 4
          ? 'bg-warnSoft text-warn'
          : 'bg-dangerSoft text-danger';
  return (
    <span
      className={`inline-flex items-center justify-center text-[11px] font-semibold rounded px-2 py-0.5 ${tone}`}
      title={`SEIFA decile ${decile} / 10`}
    >
      D{decile}
    </span>
  );
}

/** Cheap AU silhouette mask for the 22×14 heatmap grid. */
function isAuLand(col: number, row: number): boolean {
  // Rough cells inside an Australia-shaped polygon. Hand-tuned.
  // Top row: NT/QLD coastline tops
  if (row === 0) return col >= 8 && col <= 16;
  if (row === 1) return col >= 5 && col <= 18;
  if (row === 2) return col >= 4 && col <= 19;
  if (row === 3) return col >= 4 && col <= 19;
  if (row === 4) return col >= 4 && col <= 19;
  if (row === 5) return col >= 3 && col <= 19;
  if (row === 6) return col >= 3 && col <= 19;
  if (row === 7) return col >= 3 && col <= 19;
  if (row === 8) return col >= 4 && col <= 18;
  if (row === 9) return col >= 5 && col <= 17;
  if (row === 10) return col >= 7 && col <= 17;
  if (row === 11) return col >= 9 && col <= 17;
  if (row === 12) return (col >= 11 && col <= 16) || (col >= 14 && col <= 15);
  if (row === 13) return col >= 14 && col <= 15; // Tasmania
  return false;
}
