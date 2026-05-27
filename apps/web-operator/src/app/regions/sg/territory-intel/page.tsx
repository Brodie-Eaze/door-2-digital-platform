import { Sparkles, MapPin, Eye, Plus, Filter, Database } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * SG territory intelligence.
 *
 * Singapore is small (≈ 735 km²), so we work at planning-area
 * granularity rather than SA1/Mesh Block. The heatmap is a hand-drawn
 * Singapore island outline with the major planning areas plotted as
 * colored zones, blended from SingStat census + URA Master Plan + HDB
 * resale + LTA OneMap.
 *
 * Income figures are realistic 2024 SGD median household monthly
 * incomes per planning area; HDB block counts approximate.
 */

interface SgZone {
  area: string;
  region: 'East' | 'West' | 'North' | 'South' | 'Central' | 'North-East';
  postal: string; // postal sector prefix
  incomeDecile: number; // 1 (lowest) — 10 (highest) per SingStat
  density: 'High' | 'Medium' | 'Low';
  propensity: number;
  saturation: number;
  knockable: number;
  status: 'AI suggested' | 'Active' | 'Low-yield' | 'Blocked (PLRD pending)';
  tone: 'success' | 'info' | 'muted' | 'danger';
  medianIncomeSgd: number; // monthly household income
  hdbBlocks: number;
}

const SG_ZONES: SgZone[] = [
  {
    area: 'Tampines',
    region: 'East',
    postal: '52',
    incomeDecile: 7,
    density: 'High',
    propensity: 0.78,
    saturation: 12,
    knockable: 21_840,
    status: 'Active',
    tone: 'info',
    medianIncomeSgd: 9_840,
    hdbBlocks: 624,
  },
  {
    area: 'Bedok',
    region: 'East',
    postal: '46',
    incomeDecile: 6,
    density: 'High',
    propensity: 0.74,
    saturation: 18,
    knockable: 18_210,
    status: 'Active',
    tone: 'info',
    medianIncomeSgd: 9_220,
    hdbBlocks: 542,
  },
  {
    area: 'Jurong East',
    region: 'West',
    postal: '60',
    incomeDecile: 8,
    density: 'High',
    propensity: 0.72,
    saturation: 9,
    knockable: 12_410,
    status: 'Active',
    tone: 'info',
    medianIncomeSgd: 10_120,
    hdbBlocks: 388,
  },
  {
    area: 'Toa Payoh',
    region: 'Central',
    postal: '31',
    incomeDecile: 6,
    density: 'High',
    propensity: 0.7,
    saturation: 0,
    knockable: 9_410,
    status: 'AI suggested',
    tone: 'success',
    medianIncomeSgd: 8_980,
    hdbBlocks: 286,
  },
  {
    area: 'Ang Mo Kio',
    region: 'North-East',
    postal: '56',
    incomeDecile: 6,
    density: 'High',
    propensity: 0.68,
    saturation: 22,
    knockable: 14_820,
    status: 'Active',
    tone: 'info',
    medianIncomeSgd: 8_710,
    hdbBlocks: 442,
  },
  {
    area: 'Woodlands',
    region: 'North',
    postal: '73',
    incomeDecile: 5,
    density: 'High',
    propensity: 0.65,
    saturation: 8,
    knockable: 16_240,
    status: 'AI suggested',
    tone: 'success',
    medianIncomeSgd: 8_140,
    hdbBlocks: 488,
  },
  {
    area: 'Punggol',
    region: 'North-East',
    postal: '82',
    incomeDecile: 8,
    density: 'High',
    propensity: 0.81,
    saturation: 0,
    knockable: 11_820,
    status: 'AI suggested',
    tone: 'success',
    medianIncomeSgd: 11_240,
    hdbBlocks: 312,
  },
  {
    area: 'Sengkang',
    region: 'North-East',
    postal: '54',
    incomeDecile: 7,
    density: 'High',
    propensity: 0.76,
    saturation: 0,
    knockable: 13_140,
    status: 'Blocked (PLRD pending)',
    tone: 'danger',
    medianIncomeSgd: 10_410,
    hdbBlocks: 358,
  },
  {
    area: 'Choa Chu Kang',
    region: 'West',
    postal: '68',
    incomeDecile: 5,
    density: 'High',
    propensity: 0.62,
    saturation: 14,
    knockable: 12_840,
    status: 'Active',
    tone: 'info',
    medianIncomeSgd: 8_410,
    hdbBlocks: 384,
  },
  {
    area: 'Hougang',
    region: 'North-East',
    postal: '53',
    incomeDecile: 6,
    density: 'Medium',
    propensity: 0.64,
    saturation: 31,
    knockable: 11_220,
    status: 'Active',
    tone: 'info',
    medianIncomeSgd: 8_640,
    hdbBlocks: 338,
  },
  {
    area: 'Bishan',
    region: 'Central',
    postal: '57',
    incomeDecile: 9,
    density: 'Medium',
    propensity: 0.79,
    saturation: 0,
    knockable: 7_410,
    status: 'AI suggested',
    tone: 'success',
    medianIncomeSgd: 12_840,
    hdbBlocks: 224,
  },
  {
    area: 'Geylang',
    region: 'Central',
    postal: '38',
    incomeDecile: 3,
    density: 'High',
    propensity: 0.41,
    saturation: 38,
    knockable: 6_820,
    status: 'Low-yield',
    tone: 'muted',
    medianIncomeSgd: 5_980,
    hdbBlocks: 218,
  },
];

const SG_DATA_SOURCES = [
  {
    name: 'SingStat Census 2020',
    detail: 'Resident profile · age · dwelling type · household income per planning area',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'SingStat Planning Area boundaries',
    detail: '55 planning areas · GeoJSON polygons',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'URA Master Plan 2024',
    detail: 'Land-use zoning · plot ratio · building heights',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'HDB Resale Index',
    detail: 'Per-town resale flat pricing trend',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'LTA OneMap geometries',
    detail: '147k postal codes · streets · MRT exit centroids',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'PDPC DNC Registry',
    detail: 'Live wash on voice + SMS marketing fields',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'IPOS UEN registry',
    detail: 'UEN validation for PayNow Corporate matching',
    region: 'SG',
    status: 'connected',
  },
  {
    name: 'Internal cohorts (SG)',
    detail: 'SG conversion history per planning area · last 12mo',
    region: 'SG',
    status: 'connected',
  },
];

// Hand-drawn Singapore island outline using SVG paths.
// Approx geographic: Tuas (W) at ~5%, Changi (E) at ~95%.
// North coast: ~10% y, South coast: ~85% y.
interface SgAreaPin {
  name: string;
  x: number;
  y: number;
  tone: 'hot' | 'warm' | 'mild' | 'cool';
}

const SG_AREA_PINS: SgAreaPin[] = [
  { name: 'Woodlands', x: 38, y: 18, tone: 'warm' },
  { name: 'Sembawang', x: 47, y: 16, tone: 'cool' },
  { name: 'Yishun', x: 56, y: 22, tone: 'warm' },
  { name: 'Punggol', x: 70, y: 22, tone: 'hot' },
  { name: 'Sengkang', x: 64, y: 30, tone: 'hot' },
  { name: 'Ang Mo Kio', x: 53, y: 36, tone: 'warm' },
  { name: 'Bishan', x: 48, y: 44, tone: 'hot' },
  { name: 'Toa Payoh', x: 46, y: 52, tone: 'warm' },
  { name: 'Hougang', x: 62, y: 40, tone: 'warm' },
  { name: 'Tampines', x: 78, y: 38, tone: 'hot' },
  { name: 'Bedok', x: 77, y: 58, tone: 'warm' },
  { name: 'Changi', x: 92, y: 42, tone: 'cool' },
  { name: 'Geylang', x: 55, y: 64, tone: 'mild' },
  { name: 'Marina Bay', x: 48, y: 75, tone: 'warm' },
  { name: 'Queenstown', x: 36, y: 68, tone: 'warm' },
  { name: 'Jurong East', x: 22, y: 56, tone: 'hot' },
  { name: 'Bukit Batok', x: 28, y: 46, tone: 'warm' },
  { name: 'Choa Chu Kang', x: 30, y: 34, tone: 'warm' },
  { name: 'Tuas', x: 8, y: 60, tone: 'cool' },
];

function pinColor(tone: SgAreaPin['tone']): string {
  switch (tone) {
    case 'hot':
      return '#22c55e';
    case 'warm':
      return '#3b82f6';
    case 'mild':
      return '#f59e0b';
    case 'cool':
      return '#ef4444';
  }
}

export default function SgTerritoryIntelPage(): JSX.Element {
  const meanDecile = (SG_ZONES.reduce((s, z) => s + z.incomeDecile, 0) / SG_ZONES.length).toFixed(
    1,
  );
  const totalKnockable = SG_ZONES.reduce((s, z) => s + z.knockable, 0);
  const totalHdbBlocks = SG_ZONES.reduce((s, z) => s + z.hdbBlocks, 0);
  const active = SG_ZONES.filter((z) => z.status === 'Active').length;
  const aiSuggested = SG_ZONES.filter((z) => z.status === 'AI suggested').length;
  const blocked = SG_ZONES.filter((z) => z.status.startsWith('Blocked')).length;

  return (
    <PlatformShell pageTitle="SG territory intelligence">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              SG zone propensity blends <span className="font-semibold">SingStat Census 2020</span>{' '}
              (income + dwelling per planning area), <span className="font-semibold">URA</span>{' '}
              zoning, <span className="font-semibold">HDB Resale</span> trend, LTA OneMap centroids,
              and your SG conversion history. Sengkang is gated until the PLRD H2H permit lands.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Planning areas tracked"
            value={SG_ZONES.length}
            hint={`of 55 SG planning areas`}
          />
          <KpiCard
            label="Mean income decile"
            value={meanDecile}
            hint="across covered areas · 10 = highest"
            deltaTone="positive"
          />
          <KpiCard
            label="Knockable units"
            value={totalKnockable.toLocaleString()}
            hint="net of DNC + PDPA opt-outs"
          />
          <KpiCard
            label="HDB blocks indexed"
            value={totalHdbBlocks.toLocaleString()}
            hint={`across ${SG_ZONES.length} areas`}
          />
          <KpiCard label="Blocked zones" value={blocked} hint="PLRD pending" deltaTone="negative" />
        </div>

        <Section
          title="Propensity heatmap · Singapore"
          subtitle="Planning-area level · island outline · click any pin to drill in"
        >
          <div className="bg-ink rounded-xl overflow-hidden relative" style={{ height: 420 }}>
            <svg
              viewBox="0 0 1000 500"
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 w-full h-full"
            >
              <defs>
                <radialGradient id="seaGradient" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>
              <rect width="1000" height="500" fill="url(#seaGradient)" />
              {/* Singapore island — hand-traced silhouette */}
              <path
                d="
                  M 60 320
                  C 70 280, 110 250, 160 240
                  C 200 220, 260 200, 310 180
                  C 360 150, 430 130, 490 120
                  C 560 110, 620 110, 680 120
                  C 740 130, 800 150, 850 180
                  C 890 210, 920 240, 940 280
                  C 950 320, 940 360, 900 390
                  C 850 420, 780 440, 700 430
                  C 620 425, 540 420, 460 415
                  C 380 410, 300 405, 230 400
                  C 170 395, 110 380, 80 360
                  C 60 350, 55 335, 60 320
                  Z
                "
                fill="url(#landGradient)"
                stroke="#334155"
                strokeWidth={2}
                opacity={0.95}
              />
              {/* Sentosa */}
              <ellipse
                cx="520"
                cy="430"
                rx="50"
                ry="14"
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={1}
              />
              {/* MRT spine hint */}
              <path
                d="M 200 290 Q 400 250, 600 260 T 880 240"
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="3 4"
                opacity={0.35}
                fill="none"
              />
            </svg>

            {SG_AREA_PINS.map((pin) => (
              <div
                key={pin.name}
                className="absolute flex flex-col items-center pointer-events-none"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-lg"
                  style={{
                    background: pinColor(pin.tone),
                    boxShadow: `0 0 12px ${pinColor(pin.tone)}80`,
                  }}
                />
                <span className="text-surface text-[10px] font-semibold drop-shadow-md mt-1 whitespace-nowrap">
                  {pin.name}
                </span>
              </div>
            ))}

            <div className="absolute bottom-3 left-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
                Propensity
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-rose-500/50" /> 0–0.4
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-amber-500/60" /> 0.4–0.6
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-accent/60" /> 0.6–0.75
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-green-500/70" /> 0.75+
                </span>
              </div>
            </div>

            <div className="absolute top-3 right-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm text-[10px] text-muted">
              <div className="font-semibold text-ink mb-1">SG live counters</div>
              <div>
                {SG_ZONES.length} planning areas · {active} active · {aiSuggested} suggested
              </div>
              <div>{blocked} blocked (PLRD permit pending)</div>
            </div>
          </div>
        </Section>

        <Section
          title="All SG planning areas · ranked by propensity"
          subtitle="SingStat income decile + HDB density + URA zoning + LTA OneMap centroid"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                Filter
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
                New SG planning area
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Planning area</th>
                <th>Region</th>
                <th>Postal</th>
                <th>Income</th>
                <th>Median HH (SGD/mo)</th>
                <th>HDB blocks</th>
                <th>Propensity</th>
                <th>Knockable</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SG_ZONES.map((z) => (
                <tr key={z.area}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-soft shrink-0" />
                      <div className="text-[13px] font-medium text-ink">{z.area}</div>
                    </div>
                  </td>
                  <td className="text-[12px] text-muted">{z.region}</td>
                  <td>
                    <span className="mono !w-9 !text-[10px]">{z.postal}</span>
                  </td>
                  <td>
                    <IncomeBadge decile={z.incomeDecile} />
                  </td>
                  <td className="text-[12px] text-ink numeric">
                    S${z.medianIncomeSgd.toLocaleString()}
                  </td>
                  <td className="text-[12px] text-muted numeric">{z.hdbBlocks}</td>
                  <td>
                    <PropensityBar score={z.propensity} />
                  </td>
                  <td className="text-[12px] text-ink numeric">{z.knockable.toLocaleString()}</td>
                  <td>
                    <StatusPill tone={z.tone}>{z.status}</StatusPill>
                  </td>
                  <td>
                    {z.status === 'AI suggested' ? (
                      <button className="text-[11px] font-semibold text-accent hover:underline">
                        Send knocker
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
          title="SG data feeding propensity model"
          subtitle="Nightly ingest · attribution preserved per PDPA Openness obligation"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SG_DATA_SOURCES.map((s) => (
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

function IncomeBadge({ decile }: { decile: number }): JSX.Element {
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
      title={`Income decile ${decile} / 10`}
    >
      D{decile}
    </span>
  );
}
