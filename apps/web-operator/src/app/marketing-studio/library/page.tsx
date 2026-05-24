import {
  Image as ImageIcon,
  Filter,
  Plus,
  FileCheck2,
  Check,
  X,
  Eye,
  Trash2,
  Archive,
  Send,
  Download,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Creative library.
 *
 * Grid of all generated creatives (50 cards), filterable by vertical,
 * region, channel, status. Bulk-actions toolbar on top. Each card is
 * a gradient SVG placeholder + headline + copy snippet + status pill
 * + C2PA badge + cost.
 */

type Vertical = 'charity' | 'pest' | 'solar' | 'energy';
type Region = 'US' | 'AU' | 'SG';
type Channel = 'Meta' | 'Google' | 'TikTok' | 'YouTube';
type Format = 'image' | 'carousel' | 'video';
type Status = 'draft' | 'review' | 'approved' | 'published' | 'blocked';

interface LibraryCreative {
  id: string;
  headline: string;
  copy: string;
  vertical: Vertical;
  region: Region;
  channel: Channel;
  format: Format;
  status: Status;
  costCents: number;
  c2paId: string;
  gradient: string;
}

const GRADIENTS = [
  'from-emerald-500 to-teal-700',
  'from-blue-500 to-indigo-700',
  'from-amber-500 to-orange-700',
  'from-rose-500 to-red-700',
  'from-violet-500 to-purple-700',
  'from-sky-500 to-blue-700',
  'from-green-500 to-emerald-700',
  'from-pink-500 to-rose-700',
  'from-yellow-500 to-amber-700',
  'from-cyan-500 to-blue-700',
] as const;

function seedCreative(
  i: number,
  headline: string,
  copy: string,
  vertical: Vertical,
  region: Region,
  channel: Channel,
  format: Format,
  status: Status,
  costCents: number,
): LibraryCreative {
  return {
    id: `cr_${4960 - i}`,
    headline,
    copy,
    vertical,
    region,
    channel,
    format,
    status,
    costCents,
    c2paId: `c2pa-${(9421 - i).toString(16)}`,
    gradient: GRADIENTS[i % GRADIENTS.length]!,
  };
}

const LIBRARY: LibraryCreative[] = [
  seedCreative(
    0,
    'Five dollars covers a meal — every Tuesday.',
    'Hope Forward · Tx-based child sponsorship · $5/wk · ACH or card.',
    'charity',
    'US',
    'Meta',
    'image',
    'published',
    42,
  ),
  seedCreative(
    1,
    'Your neighbour just sponsored a child in Tampines.',
    'Tampines FSC · SGD 45/mo via PayNow corporate · IPC 250%.',
    'charity',
    'SG',
    'Meta',
    'carousel',
    'published',
    51,
  ),
  seedCreative(
    2,
    "Don't share your meal with roaches. Texas-licensed.",
    'PestMax · Houston + Austin · same-day service · TX-CPM 8845.',
    'pest',
    'US',
    'TikTok',
    'video',
    'published',
    68,
  ),
  seedCreative(
    3,
    'For every child sponsored in Cebu, a Knocker plants one tree.',
    'World Vision AU · child sponsorship · ACNC-registered · tax-deductible.',
    'charity',
    'AU',
    'Meta',
    'video',
    'published',
    74,
  ),
  seedCreative(
    4,
    'Our solar bills shrank 71% in 8 weeks. Boise, ID.',
    'SunlinkCo · install in 6wk · ITC + state credits · Boise, ID.',
    'solar',
    'US',
    'Google',
    'image',
    'review',
    48,
  ),
  seedCreative(
    5,
    'Renew your faith in giving — Hope Forward, 2026.',
    'Hope Forward · annual giving day · 7 May 2026 · matched 2:1.',
    'charity',
    'US',
    'YouTube',
    'video',
    'published',
    81,
  ),
  seedCreative(
    6,
    '3 in 5 Aussie families need help this winter.',
    'World Vision AU · winter appeal · SEIFA decile-9 targeting.',
    'charity',
    'AU',
    'Meta',
    'image',
    'approved',
    39,
  ),
  seedCreative(
    7,
    'Switch to NextGen Power and pay nothing for 3 months.',
    'NextGen Power · CA + TX · DMO/VDO disclosed · cancel anytime.',
    'energy',
    'US',
    'Google',
    'carousel',
    'blocked',
    44,
  ),
  seedCreative(
    8,
    "Every door is someone's story.",
    'Tampines FSC · S$45/mo · PayNow · IPC 250% deduction.',
    'charity',
    'SG',
    'Meta',
    'image',
    'draft',
    42,
  ),
  seedCreative(
    9,
    "In 5 minutes you can change a Tampines family's year.",
    'Tampines FSC · S$45/mo · UEN T26CC0021K · tax-deductible.',
    'charity',
    'SG',
    'Meta',
    'image',
    'draft',
    38,
  ),
  seedCreative(
    10,
    'Your S$45 buys a week of school meals.',
    'Tampines FSC · PLRD/H2H/2026/0188 · Knocker shows the schools.',
    'charity',
    'SG',
    'Meta',
    'image',
    'draft',
    41,
  ),
  seedCreative(
    11,
    'We knocked on 8,210 doors in your block.',
    'Tampines FSC · less than 4% give · recurring S$45/mo.',
    'charity',
    'SG',
    'Meta',
    'image',
    'review',
    39,
  ),
  seedCreative(
    12,
    "Singapore's quiet 8% live below the line.",
    'Tampines FSC · poverty awareness · review required (claim sourcing).',
    'charity',
    'SG',
    'Meta',
    'image',
    'blocked',
    44,
  ),
  seedCreative(
    13,
    'A door knocked is a child fed.',
    'Tampines FSC · S$45/mo via PayNow.',
    'charity',
    'SG',
    'Meta',
    'image',
    'approved',
    40,
  ),
  seedCreative(
    14,
    'Your CDC voucher? Stretch it twice as far.',
    'Tampines FSC · round-up at POS · recurring S$5/mo.',
    'charity',
    'SG',
    'Meta',
    'carousel',
    'approved',
    43,
  ),
  seedCreative(
    15,
    'Knock-knock. Tampines is here.',
    'Tampines FSC · youngest sponsor 16, oldest 92.',
    'charity',
    'SG',
    'Meta',
    'image',
    'published',
    45,
  ),
  seedCreative(
    16,
    "Termites cost Texas homeowners $5B/year. We're cheaper.",
    'PestMax · TX-CPM 8845 · same-day · 60-day warranty.',
    'pest',
    'US',
    'Google',
    'image',
    'published',
    36,
  ),
  seedCreative(
    17,
    'Pre-summer special: ant + roach combo, $89.',
    'PestMax · Houston · same-day · TX licensed.',
    'pest',
    'US',
    'TikTok',
    'video',
    'review',
    71,
  ),
  seedCreative(
    18,
    'You spent $312 on power last month. Solar would cost $87.',
    'SunlinkCo · ROI calc · Boise + Phoenix · 25-year warranty.',
    'solar',
    'US',
    'Meta',
    'carousel',
    'approved',
    52,
  ),
  seedCreative(
    19,
    'Free quote, no salesperson. Knockers leave a card.',
    'SunlinkCo · text-back quote · install in 6wk · ITC.',
    'solar',
    'US',
    'Meta',
    'image',
    'published',
    47,
  ),
  seedCreative(
    20,
    'World Vision: 1.3M Australians on our giving books.',
    'World Vision AU · child sponsorship · trust 92% (Roy Morgan).',
    'charity',
    'AU',
    'Google',
    'image',
    'published',
    42,
  ),
  seedCreative(
    21,
    'For the cost of a coffee, a child eats this week.',
    'World Vision AU · $9.50/wk · ACNC-registered · DGR Item 1.',
    'charity',
    'AU',
    'Meta',
    'image',
    'published',
    38,
  ),
  seedCreative(
    22,
    'Knockers cleared 28,400 doors in NSW this month.',
    'World Vision AU · SEIFA decile-9 zones · CHOICE DNK respected.',
    'charity',
    'AU',
    'Meta',
    'carousel',
    'approved',
    51,
  ),
  seedCreative(
    23,
    'Gold Coast Hospital · new oncology wing · open 2027.',
    'Gold Coast Hosp Foundation · capital campaign · QLD-CCA 8845.',
    'charity',
    'AU',
    'Meta',
    'image',
    'approved',
    39,
  ),
  seedCreative(
    24,
    "A child in Surry Hills doesn't need to be alone tonight.",
    'World Vision AU · NSW urban appeal · SEIFA-targeted.',
    'charity',
    'AU',
    'Meta',
    'image',
    'review',
    44,
  ),
  seedCreative(
    25,
    'NSW · 14,200 sponsors waiting on a Knocker visit.',
    'World Vision AU · ops dashboard · SEIFA decile-10 priority.',
    'charity',
    'AU',
    'Meta',
    'image',
    'draft',
    41,
  ),
  seedCreative(
    26,
    'A Hope Forward dollar lasts longer than the dollar in your pocket.',
    'Hope Forward · efficiency 92¢/$ · ACFR-audited · 4-star Charity Navigator.',
    'charity',
    'US',
    'Google',
    'image',
    'published',
    37,
  ),
  seedCreative(
    27,
    '4,831 conversions in May. Pilot Charlie working.',
    'Hope Forward · ops update · internal share.',
    'charity',
    'US',
    'Meta',
    'image',
    'draft',
    33,
  ),
  seedCreative(
    28,
    'TX pest licence 8845 · 28 trucks · 3 hours response.',
    'PestMax · Houston + Dallas · live ops update.',
    'pest',
    'US',
    'Google',
    'image',
    'published',
    35,
  ),
  seedCreative(
    29,
    'AZ summer: termite-season starts in May. We knock at 9am.',
    'PestMax · Phoenix · seasonal · AZ-CPM 1041.',
    'pest',
    'US',
    'TikTok',
    'video',
    'review',
    64,
  ),
  seedCreative(
    30,
    "Your power bill, decoded. We'll send a Knocker.",
    'NextGen Power · TX retail · DMO/VDO disclosed · door audit.',
    'energy',
    'US',
    'Meta',
    'carousel',
    'review',
    49,
  ),
  seedCreative(
    31,
    'Boise homes saved $11M with SunlinkCo in 2025.',
    'SunlinkCo · ID + WA · 25-year warranty · Clean Energy badge.',
    'solar',
    'US',
    'YouTube',
    'video',
    'published',
    78,
  ),
  seedCreative(
    32,
    'A solar quote in 8 minutes. Knocker can sketch your roof.',
    'SunlinkCo · ID + WA · ROI calc · cancel anytime.',
    'solar',
    'US',
    'Meta',
    'image',
    'approved',
    40,
  ),
  seedCreative(
    33,
    'SCS pilot: 412 Singaporeans now give monthly.',
    'Singapore Cancer Society · pilot · UEN T26CC0021K · IPC.',
    'charity',
    'SG',
    'Meta',
    'image',
    'published',
    42,
  ),
  seedCreative(
    34,
    'Pap smears for free, courtesy of your PayNow today.',
    'SCS pilot · awareness · Toa Payoh · permit PLRD/H2H/2026/0214.',
    'charity',
    'SG',
    'Meta',
    'image',
    'approved',
    44,
  ),
  seedCreative(
    35,
    "A neighbour's recovery story. S$45/mo.",
    'SCS pilot · personal narrative · UEN T26CC0021K.',
    'charity',
    'SG',
    'Meta',
    'video',
    'published',
    71,
  ),
  seedCreative(
    36,
    'You walked past 4 cancer survivors today. They walked thanks to SCS.',
    'SCS pilot · awareness · review pending (claim sourcing).',
    'charity',
    'SG',
    'Meta',
    'image',
    'blocked',
    46,
  ),
  seedCreative(
    37,
    'Recycle a dollar of giving. Earn IPC 250% deduction.',
    'SCS pilot · tax-positioning · IPC 000211.',
    'charity',
    'SG',
    'Google',
    'image',
    'approved',
    41,
  ),
  seedCreative(
    38,
    'Stayed-at-home grandma · 28 grandkids · 1 PayNow.',
    'SCS pilot · multi-generational appeal · PLRD permitted.',
    'charity',
    'SG',
    'Meta',
    'carousel',
    'review',
    52,
  ),
  seedCreative(
    39,
    'Pilot Charlie: 218 Knockers, 4,831 conversions in May.',
    'Hope Forward · ops update · internal · ACFR audit copy.',
    'charity',
    'US',
    'Google',
    'image',
    'draft',
    35,
  ),
  seedCreative(
    40,
    'You read this in 4s. A Tampines knock takes 90s.',
    'Tampines FSC · efficiency · S$45/mo recurring.',
    'charity',
    'SG',
    'TikTok',
    'video',
    'review',
    68,
  ),
  seedCreative(
    41,
    '"Free solar" — we\'ll never say it. Here\'s the actual math.',
    'SunlinkCo · transparency · ROI calc · ID + WA.',
    'solar',
    'US',
    'Meta',
    'image',
    'published',
    43,
  ),
  seedCreative(
    42,
    'Hope Forward · 5-star Charity Navigator · 7 years running.',
    'Hope Forward · trust badge · ACFR-audited · 92¢/$.',
    'charity',
    'US',
    'YouTube',
    'video',
    'published',
    79,
  ),
  seedCreative(
    43,
    'Pest control without surprise fees. TX-CPM 8845.',
    'PestMax · transparent pricing · 60-day warranty.',
    'pest',
    'US',
    'Google',
    'image',
    'approved',
    37,
  ),
  seedCreative(
    44,
    'Knockers walked 312 km in Carlton this week.',
    'World Vision AU · VIC ops · SEIFA decile-9 targeting.',
    'charity',
    'AU',
    'Meta',
    'image',
    'draft',
    40,
  ),
  seedCreative(
    45,
    'Your sponsor letter arrives in 14 days. Knocker delivers if local.',
    'World Vision AU · sponsor experience · personal touch.',
    'charity',
    'AU',
    'Meta',
    'carousel',
    'approved',
    48,
  ),
  seedCreative(
    46,
    'NextGen Power Texas — Knocker shows DMO live on tablet.',
    'NextGen Power · transparency · AER retail code compliant.',
    'energy',
    'US',
    'Meta',
    'image',
    'review',
    44,
  ),
  seedCreative(
    47,
    'Tampines · 8,210 HDB units · 412 giving today.',
    'Tampines FSC · live ops · S$45/mo via PayNow.',
    'charity',
    'SG',
    'Meta',
    'image',
    'published',
    42,
  ),
  seedCreative(
    48,
    'Stairwell-by-stairwell · Bedok block 412.',
    'SCS pilot · area-specific · UEN T26CC0021K.',
    'charity',
    'SG',
    'Meta',
    'image',
    'approved',
    41,
  ),
  seedCreative(
    49,
    'A pest-free home for $89/mo. TX + AZ.',
    'PestMax · recurring · 28-truck fleet · same-day.',
    'pest',
    'US',
    'Meta',
    'image',
    'published',
    38,
  ),
];

function statusTone(s: Status): 'success' | 'info' | 'warn' | 'danger' | 'muted' {
  switch (s) {
    case 'published':
      return 'success';
    case 'approved':
      return 'info';
    case 'review':
      return 'warn';
    case 'blocked':
      return 'danger';
    case 'draft':
      return 'muted';
  }
}

export default function CreativeLibraryPage(): JSX.Element {
  const drafts = LIBRARY.filter((c) => c.status === 'draft').length;
  const reviews = LIBRARY.filter((c) => c.status === 'review').length;
  const approved = LIBRARY.filter((c) => c.status === 'approved').length;
  const published = LIBRARY.filter((c) => c.status === 'published').length;
  const blocked = LIBRARY.filter((c) => c.status === 'blocked').length;
  const totalCostCents = LIBRARY.reduce((s, c) => s + c.costCents, 0);

  return (
    <PlatformShell pageTitle="Creative library">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ImageIcon size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{LIBRARY.length} creatives</span> across all accounts
              · all signed with C2PA provenance · filter to drill in, bulk-publish from approved.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total" value={LIBRARY.length} />
          <KpiCard label="Drafts" value={drafts} />
          <KpiCard label="In review" value={reviews} deltaTone="negative" />
          <KpiCard label="Approved" value={approved} deltaTone="positive" />
          <KpiCard label="Published" value={published} deltaTone="positive" />
          <KpiCard label="Blocked" value={blocked} deltaTone="negative" />
        </div>

        <Section
          title="Filters & bulk actions"
          subtitle="Filter by vertical · region · channel · status · select a row to enable bulk"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill label="All verticals" active />
              <Pill label="Charity" />
              <Pill label="Pest" />
              <Pill label="Solar" />
              <Pill label="Energy" />
              <span className="w-px h-4 bg-line2 mx-1" />
              <Pill label="All regions" active />
              <Pill label="US" />
              <Pill label="AU" />
              <Pill label="SG" />
              <span className="w-px h-4 bg-line2 mx-1" />
              <Pill label="All channels" active />
              <Pill label="Meta" />
              <Pill label="Google" />
              <Pill label="TikTok" />
              <Pill label="YouTube" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                Advanced filter
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
                New creative
              </Button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-line2 flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11.5px] text-muted">
              0 selected · spend across library:{' '}
              <span className="text-ink font-semibold">${(totalCostCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Send size={13} />} disabled>
                Send to review
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Check size={13} />} disabled>
                Approve
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Archive size={13} />} disabled>
                Archive
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Download size={13} />} disabled>
                Export
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} disabled>
                Delete
              </Button>
            </div>
          </div>
        </Section>

        <Section
          title={`Creatives · ${LIBRARY.length}`}
          subtitle="Sorted by most recent · click a tile to inspect"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {LIBRARY.map((c) => (
              <div
                key={c.id}
                className="card overflow-hidden cursor-pointer hover:ring-1 hover:ring-accent transition"
              >
                <div
                  className={`h-28 bg-gradient-to-br ${c.gradient} relative flex items-end p-2.5`}
                >
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
                      {c.channel}
                    </span>
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    <span
                      className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
                      title="C2PA provenance manifest signed"
                    >
                      <FileCheck2 size={9} /> C2PA
                    </span>
                  </div>
                  <div className="text-surface text-[11.5px] font-semibold leading-snug drop-shadow-md line-clamp-2">
                    {c.headline}
                  </div>
                </div>
                <div className="p-2.5 space-y-1.5">
                  <div className="text-[10.5px] text-muted line-clamp-2 leading-snug">{c.copy}</div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-line2 text-[10px]">
                    <span className="text-muted capitalize">
                      {c.vertical} · {c.region} · {c.format}
                    </span>
                    <span className="mono text-soft">${(c.costCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="w-5 h-5 rounded hover:bg-successSoft flex items-center justify-center text-success"
                        title="Approve"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        type="button"
                        className="w-5 h-5 rounded hover:bg-dangerSoft flex items-center justify-center text-danger"
                        title="Reject"
                      >
                        <X size={11} />
                      </button>
                      <button
                        type="button"
                        className="w-5 h-5 rounded hover:bg-paper flex items-center justify-center text-soft"
                        title="Inspect"
                      >
                        <Eye size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}

function Pill({ label, active }: { label: string; active?: boolean }): JSX.Element {
  return (
    <span
      className={
        active
          ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface'
          : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full border border-line2 text-muted hover:text-ink cursor-pointer'
      }
    >
      {label}
    </span>
  );
}
