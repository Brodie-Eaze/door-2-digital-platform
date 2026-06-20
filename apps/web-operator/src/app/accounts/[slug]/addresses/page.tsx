'use client';

import { use, useState, useMemo } from 'react';
import {
  Download,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Construction,
  ArrowRight,
} from 'lucide-react';
import { Banner } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type KnockStatus = 'Un-knocked' | 'Knocked' | 'Converted';
type PrizmSegment =
  | 'Young Digerati'
  | 'Money & Brains'
  | 'Bohemian Mix'
  | 'Movers & Shakers'
  | 'Kids & Cul-de-Sacs'
  | 'Suburban Sprawl';

interface AddressRow {
  id: string;
  address: string;
  city: string;
  territory: string;
  prizmSegment: PrizmSegment;
  propensityScore: number;
  estIncome: number;
  constructionAlerts: number;
  status: KnockStatus;
  lastKnock: string | null; // ISO date or null
}

/* ─── Mock data — 30 rows ────────────────────────────────────────────────── */

const MOCK_ADDRESSES: AddressRow[] = [
  {
    id: '1',
    address: '412 Lakeview Dr',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Young Digerati',
    propensityScore: 0.91,
    estIncome: 112000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '2',
    address: '88 Meridian Ave',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Money & Brains',
    propensityScore: 0.87,
    estIncome: 145000,
    constructionAlerts: 2,
    status: 'Knocked',
    lastKnock: '2026-06-12',
  },
  {
    id: '3',
    address: '5 Thornwood Ct',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Movers & Shakers',
    propensityScore: 0.83,
    estIncome: 132000,
    constructionAlerts: 0,
    status: 'Converted',
    lastKnock: '2026-06-08',
  },
  {
    id: '4',
    address: '310 Cedar Ridge Blvd',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Young Digerati',
    propensityScore: 0.81,
    estIncome: 98000,
    constructionAlerts: 1,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '5',
    address: '1201 Skyline Loop',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Money & Brains',
    propensityScore: 0.79,
    estIncome: 168000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-10',
  },
  {
    id: '6',
    address: '74 Birchwood Pl',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Kids & Cul-de-Sacs',
    propensityScore: 0.76,
    estIncome: 87500,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '7',
    address: '2800 Riverwalk Dr',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Bohemian Mix',
    propensityScore: 0.74,
    estIncome: 72000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-13',
  },
  {
    id: '8',
    address: '99 Hazel Oak Rd',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Young Digerati',
    propensityScore: 0.72,
    estIncome: 105000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '9',
    address: '555 Granite Way',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Movers & Shakers',
    propensityScore: 0.69,
    estIncome: 125000,
    constructionAlerts: 2,
    status: 'Converted',
    lastKnock: '2026-06-05',
  },
  {
    id: '10',
    address: '1048 Pinewood Ave',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Kids & Cul-de-Sacs',
    propensityScore: 0.66,
    estIncome: 79000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-11',
  },
  {
    id: '11',
    address: '3 Westbrook Ln',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Suburban Sprawl',
    propensityScore: 0.63,
    estIncome: 62000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '12',
    address: '208 Velvet Oaks Cir',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Money & Brains',
    propensityScore: 0.61,
    estIncome: 151000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-07',
  },
  {
    id: '13',
    address: '770 Copper Creek Rd',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Bohemian Mix',
    propensityScore: 0.58,
    estIncome: 68000,
    constructionAlerts: 1,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '14',
    address: '41 Elm Street',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Suburban Sprawl',
    propensityScore: 0.55,
    estIncome: 58000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-03',
  },
  {
    id: '15',
    address: '619 Aspen Ridge Dr',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Young Digerati',
    propensityScore: 0.52,
    estIncome: 91000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '16',
    address: '12 Hollow Brook Path',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Kids & Cul-de-Sacs',
    propensityScore: 0.5,
    estIncome: 77000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '17',
    address: '330 Creekside Blvd',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Movers & Shakers',
    propensityScore: 0.48,
    estIncome: 118000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-14',
  },
  {
    id: '18',
    address: '2201 Canyon View Rd',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Suburban Sprawl',
    propensityScore: 0.45,
    estIncome: 54000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '19',
    address: '890 Foxglove Lane',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Bohemian Mix',
    propensityScore: 0.43,
    estIncome: 65000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-05-30',
  },
  {
    id: '20',
    address: '145 Ironwood Way',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Young Digerati',
    propensityScore: 0.41,
    estIncome: 84000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '21',
    address: '500 Maplecrest Ct',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Kids & Cul-de-Sacs',
    propensityScore: 0.38,
    estIncome: 73000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '22',
    address: '78 Desert Rose Dr',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Suburban Sprawl',
    propensityScore: 0.35,
    estIncome: 49000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-06-01',
  },
  {
    id: '23',
    address: '1700 Blue Ridge Pkwy',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Money & Brains',
    propensityScore: 0.94,
    estIncome: 189000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '24',
    address: '36 Sycamore Hill Rd',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Movers & Shakers',
    propensityScore: 0.32,
    estIncome: 109000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '25',
    address: '4412 Hickory Glen Dr',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Suburban Sprawl',
    propensityScore: 0.28,
    estIncome: 47000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '26',
    address: '28 Rosewood Terrace',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Bohemian Mix',
    propensityScore: 0.24,
    estIncome: 61000,
    constructionAlerts: 0,
    status: 'Knocked',
    lastKnock: '2026-05-28',
  },
  {
    id: '27',
    address: '920 Willowbend Rd',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Young Digerati',
    propensityScore: 0.21,
    estIncome: 78000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '28',
    address: '155 Sunridge Ave',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Kids & Cul-de-Sacs',
    propensityScore: 0.18,
    estIncome: 66000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '29',
    address: '3300 Lakewood Trail',
    city: 'Austin, TX',
    territory: 'Downtown East',
    prizmSegment: 'Suburban Sprawl',
    propensityScore: 0.14,
    estIncome: 43000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
  {
    id: '30',
    address: '701 Old Mill Creek Rd',
    city: 'Austin, TX',
    territory: 'Suburb North',
    prizmSegment: 'Money & Brains',
    propensityScore: 0.12,
    estIncome: 138000,
    constructionAlerts: 0,
    status: 'Un-knocked',
    lastKnock: null,
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const PRIZM_COLORS: Record<PrizmSegment, string> = {
  'Young Digerati': 'bg-violet-100 text-violet-700',
  'Money & Brains': 'bg-sky-100 text-sky-700',
  'Bohemian Mix': 'bg-teal-100 text-teal-700',
  'Movers & Shakers': 'bg-amber-100 text-amber-700',
  'Kids & Cul-de-Sacs': 'bg-pink-100 text-pink-700',
  'Suburban Sprawl': 'bg-slate-100 text-slate-600',
};

function scoreColor(score: number): string {
  if (score >= 0.7) return 'bg-green-500';
  if (score >= 0.4) return 'bg-amber-400';
  return 'bg-red-400';
}

function scoreTextColor(score: number): string {
  if (score >= 0.7) return 'text-green-700';
  if (score >= 0.4) return 'text-amber-700';
  return 'text-red-600';
}

function statusPill(status: KnockStatus): JSX.Element {
  const cls: Record<KnockStatus, string> = {
    'Un-knocked': 'bg-slate-100 text-slate-600',
    Knocked: 'bg-blue-100 text-blue-700',
    Converted: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${cls[status]}`}>
      {status}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const now = new Date('2026-06-15');
  const then = new Date(iso);
  const days = Math.round((now.getTime() - then.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function fmtIncome(n: number): string {
  return `$${n.toLocaleString()}`;
}

type SortKey =
  | 'address'
  | 'territory'
  | 'prizmSegment'
  | 'propensityScore'
  | 'estIncome'
  | 'status'
  | 'lastKnock';

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AddressIntelPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const [territory, setTerritory] = useState('All');
  const [scoreFilter, setScoreFilter] = useState('All');
  const [prizmFilter, setPrizmFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | KnockStatus>('All');
  const [sortKey, setSortKey] = useState<SortKey>('propensityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let rows = [...MOCK_ADDRESSES];
    if (territory !== 'All') rows = rows.filter((r) => r.territory === territory);
    if (scoreFilter === 'High (>0.7)') rows = rows.filter((r) => r.propensityScore > 0.7);
    else if (scoreFilter === 'Medium (0.4-0.7)')
      rows = rows.filter((r) => r.propensityScore >= 0.4 && r.propensityScore <= 0.7);
    else if (scoreFilter === 'Low (<0.4)') rows = rows.filter((r) => r.propensityScore < 0.4);
    if (prizmFilter !== 'All') rows = rows.filter((r) => r.prizmSegment === prizmFilter);
    if (statusFilter !== 'All') rows = rows.filter((r) => r.status === statusFilter);

    rows.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'propensityScore':
          va = a.propensityScore;
          vb = b.propensityScore;
          break;
        case 'estIncome':
          va = a.estIncome;
          vb = b.estIncome;
          break;
        case 'address':
          va = a.address;
          vb = b.address;
          break;
        case 'territory':
          va = a.territory;
          vb = b.territory;
          break;
        case 'prizmSegment':
          va = a.prizmSegment;
          vb = b.prizmSegment;
          break;
        case 'status':
          va = a.status;
          vb = b.status;
          break;
        case 'lastKnock':
          va = a.lastKnock ?? '';
          vb = b.lastKnock ?? '';
          break;
        default:
          va = 0;
          vb = 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [territory, scoreFilter, prizmFilter, statusFilter, sortKey, sortDir]);

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }): JSX.Element | null {
    if (sortKey !== col) return null;
    return sortDir === 'desc' ? (
      <ChevronDown size={11} className="inline ml-0.5" />
    ) : (
      <ChevronUp size={11} className="inline ml-0.5" />
    );
  }

  function thCls(col: SortKey): string {
    return `cursor-pointer select-none hover:text-ink transition ${sortKey === col ? 'text-ink' : ''}`;
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Address Intelligence">
      <div className="space-y-5 max-w-[1700px]">
        {/* Header */}
        <div>
          <h1 className="text-[20px] font-semibold text-ink tracking-tight">
            Address Intelligence
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            AI-enriched household data for every address in your territory.
          </p>
        </div>

        {/* AI Insights panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InsightCard
            icon={<Lightbulb size={14} className="text-amber-500" />}
            bg="bg-amber-50 border-amber-100"
            title="High-value cluster"
            detail="8 addresses in Downtown East have propensity > 0.8"
          />
          <InsightCard
            icon={<Construction size={14} className="text-orange-500" />}
            bg="bg-orange-50 border-orange-100"
            title="New construction"
            detail="Planet Labs detected 3 active builds in the territory"
          />
          <InsightCard
            icon={<ArrowRight size={14} className="text-blue-500" />}
            bg="bg-blue-50 border-blue-100"
            title="Underworked area"
            detail="14 high-score addresses haven't been knocked in 7+ days"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={territory}
            onChange={setTerritory}
            options={['All', 'Downtown East', 'Suburb North']}
            label="Territory"
          />
          <Select
            value={scoreFilter}
            onChange={setScoreFilter}
            options={['All Scores', 'High (>0.7)', 'Medium (0.4-0.7)', 'Low (<0.4)']}
            label="Score"
          />
          <Select
            value={prizmFilter}
            onChange={setPrizmFilter}
            options={[
              'All Segments',
              'Young Digerati',
              'Money & Brains',
              'Bohemian Mix',
              'Movers & Shakers',
              'Kids & Cul-de-Sacs',
              'Suburban Sprawl',
            ]}
            label="PRIZM"
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'All' | KnockStatus)}
            options={['All', 'Un-knocked', 'Knocked', 'Converted']}
            label="Status"
          />
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => alert('CSV export coming soon')}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md bg-ink text-surface hover:bg-ink/90 transition"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="border border-line2 rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-2.5 border-b border-line2 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-ink">
              {filtered.length} addresses
            </span>
            <span className="text-[11px] text-muted">Sorted by propensity score · AI enriched</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#F8FAFC] border-b border-line2 z-10">
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted">
                  <th
                    className={`px-4 py-2.5 ${thCls('address')}`}
                    onClick={() => handleSort('address')}
                  >
                    Address <SortIcon col="address" />
                  </th>
                  <th
                    className={`px-3 py-2.5 ${thCls('territory')}`}
                    onClick={() => handleSort('territory')}
                  >
                    Territory <SortIcon col="territory" />
                  </th>
                  <th
                    className={`px-3 py-2.5 ${thCls('prizmSegment')}`}
                    onClick={() => handleSort('prizmSegment')}
                  >
                    PRIZM Segment <SortIcon col="prizmSegment" />
                  </th>
                  <th
                    className={`px-3 py-2.5 ${thCls('propensityScore')} min-w-[130px]`}
                    onClick={() => handleSort('propensityScore')}
                  >
                    Propensity <SortIcon col="propensityScore" />
                  </th>
                  <th
                    className={`px-3 py-2.5 ${thCls('estIncome')}`}
                    onClick={() => handleSort('estIncome')}
                  >
                    Est. Income <SortIcon col="estIncome" />
                  </th>
                  <th className="px-3 py-2.5">Construction</th>
                  <th
                    className={`px-3 py-2.5 ${thCls('status')}`}
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIcon col="status" />
                  </th>
                  <th
                    className={`px-3 py-2.5 ${thCls('lastKnock')}`}
                    onClick={() => handleSort('lastKnock')}
                  >
                    Last Knock <SortIcon col="lastKnock" />
                  </th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line2">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{row.address}</div>
                      <div className="text-[10.5px] text-muted">{row.city}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.territory}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${PRIZM_COLORS[row.prizmSegment]}`}
                      >
                        {row.prizmSegment}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-line2 overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${scoreColor(row.propensityScore)}`}
                            style={{ width: `${row.propensityScore * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${scoreTextColor(row.propensityScore)}`}
                        >
                          {row.propensityScore.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-ink font-medium tabular-nums whitespace-nowrap">
                      {fmtIncome(row.estIncome)}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.constructionAlerts > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <Construction size={10} />
                          {row.constructionAlerts} alert{row.constructionAlerts > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{statusPill(row.status)}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                      {relativeTime(row.lastKnock)}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-accent hover:underline whitespace-nowrap"
                        onClick={() => alert(`Address detail coming soon — ${row.address}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted text-[12.5px]">
                      No addresses match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function InsightCard({
  icon,
  bg,
  title,
  detail,
}: {
  icon: React.ReactNode;
  bg: string;
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <div className={`border rounded-xl px-4 py-3 ${bg} flex items-start gap-2.5`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="text-[12px] font-semibold text-ink">{title}</div>
        <div className="text-[11.5px] text-muted leading-snug mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10.5px] uppercase tracking-wider text-muted font-semibold shrink-0">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[12px] px-2.5 py-1.5 rounded-md border border-line2 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
      >
        {options.map((o) => (
          <option key={o} value={o === 'All Scores' || o === 'All Segments' ? 'All' : o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
