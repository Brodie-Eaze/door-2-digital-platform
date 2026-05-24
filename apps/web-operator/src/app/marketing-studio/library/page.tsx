'use client';

import { useMemo, useState } from 'react';
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
  Search,
  SlidersHorizontal,
  Calendar,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { pickCreativeImage, inferTheme } from '@/lib/creative-images';

/**
 * Creative library.
 *
 * Responsive grid of 60 creatives with theme-matched Unsplash previews in
 * mixed aspect ratios (square / portrait / vertical / video). Interactive
 * filters (vertical, region, channel, status) wire through useState.
 * Bulk-actions bar with select-all checkbox. Click any card → side panel
 * slides in showing full-size preview, metadata, activity log, similar
 * creatives.
 */

type Vertical = 'charity' | 'pest' | 'solar' | 'energy';
type Region = 'US' | 'AU' | 'SG';
type Channel = 'Meta' | 'Google' | 'TikTok' | 'YouTube';
type Format = 'image' | 'carousel' | 'video';
type Status = 'draft' | 'review' | 'approved' | 'published' | 'blocked';
type Aspect = 'square' | 'portrait' | 'vertical' | 'video';

interface LibraryCreative {
  id: string;
  seed: string;
  headline: string;
  copy: string;
  vertical: Vertical;
  region: Region;
  channel: Channel;
  format: Format;
  aspect: Aspect;
  status: Status;
  costCents: number;
  spendCents: bigint;
  conversions: number;
  roas: number;
  c2paId: string;
  createdAt: string;
}

function seed(
  i: number,
  seedStr: string,
  headline: string,
  copy: string,
  vertical: Vertical,
  region: Region,
  channel: Channel,
  format: Format,
  aspect: Aspect,
  status: Status,
  costCents: number,
  spendCents: bigint,
  conversions: number,
  roas: number,
): LibraryCreative {
  return {
    id: `cr_${4960 - i}`,
    seed: seedStr,
    headline,
    copy,
    vertical,
    region,
    channel,
    format,
    aspect,
    status,
    costCents,
    spendCents,
    conversions,
    roas,
    c2paId: `c2pa-${(9421 - i).toString(16)}`,
    createdAt: `2026-05-${(24 - Math.floor(i / 5)).toString().padStart(2, '0')}`,
  };
}

const LIBRARY: LibraryCreative[] = [
  seed(
    0,
    'hopeforward-tx-meals-4960',
    'Five dollars covers a meal — every Tuesday.',
    'Hope Forward · Tx-based child sponsorship · $5/wk · ACH or card.',
    'charity',
    'US',
    'Meta',
    'image',
    'square',
    'published',
    42,
    124_00n,
    88,
    6.4,
  ),
  seed(
    1,
    'tampines-fsc-neighbour-4959',
    'Your neighbour just sponsored a child in Tampines.',
    'Tampines FSC · SGD 45/mo via PayNow corporate · IPC 250%.',
    'charity',
    'SG',
    'Meta',
    'carousel',
    'square',
    'published',
    51,
    94_00n,
    51,
    5.8,
  ),
  seed(
    2,
    'pestmax-tx-roach-4958',
    "Don't share your meal with roaches. Texas-licensed.",
    'PestMax · Houston + Austin · same-day service · TX-CPM 8845.',
    'pest',
    'US',
    'TikTok',
    'video',
    'vertical',
    'published',
    68,
    184_00n,
    42,
    4.9,
  ),
  seed(
    3,
    'worldvision-cebu-tree-4957',
    'For every child sponsored in Cebu, a Knocker plants one tree.',
    'World Vision AU · child sponsorship · ACNC-registered · tax-deductible.',
    'charity',
    'AU',
    'Meta',
    'video',
    'video',
    'published',
    74,
    142_00n,
    64,
    5.4,
  ),
  seed(
    4,
    'sunlinkco-boise-solar-4956',
    'Our solar bills shrank 71% in 8 weeks. Boise, ID.',
    'SunlinkCo · install in 6wk · ITC + state credits · Boise, ID.',
    'solar',
    'US',
    'Google',
    'image',
    'square',
    'review',
    48,
    0n,
    0,
    0,
  ),
  seed(
    5,
    'hopeforward-renew-2026-4955',
    'Renew your faith in giving — Hope Forward, 2026.',
    'Hope Forward · annual giving day · 7 May 2026 · matched 2:1.',
    'charity',
    'US',
    'YouTube',
    'video',
    'video',
    'published',
    81,
    312_00n,
    71,
    5.1,
  ),
  seed(
    6,
    'worldvision-au-winter-4954',
    '3 in 5 Aussie families need help this winter.',
    'World Vision AU · winter appeal · SEIFA decile-9 targeting.',
    'charity',
    'AU',
    'Meta',
    'image',
    'portrait',
    'approved',
    39,
    0n,
    0,
    0,
  ),
  seed(
    7,
    'nextgen-power-switch-4953',
    'Switch to NextGen Power and pay nothing for 3 months.',
    'NextGen Power · CA + TX · DMO/VDO disclosed · cancel anytime.',
    'energy',
    'US',
    'Google',
    'carousel',
    'square',
    'blocked',
    44,
    0n,
    0,
    0,
  ),
  seed(
    8,
    'tampines-door-story-4952',
    "Every door is someone's story.",
    'Tampines FSC · S$45/mo · PayNow · IPC 250% deduction.',
    'charity',
    'SG',
    'Meta',
    'image',
    'portrait',
    'draft',
    42,
    0n,
    0,
    0,
  ),
  seed(
    9,
    'tampines-5min-change-4951',
    "In 5 minutes you can change a Tampines family's year.",
    'Tampines FSC · S$45/mo · UEN T26CC0021K · tax-deductible.',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'draft',
    38,
    0n,
    0,
    0,
  ),
  seed(
    10,
    'tampines-school-meals-4950',
    'Your S$45 buys a week of school meals.',
    'Tampines FSC · PLRD/H2H/2026/0188 · Knocker shows the schools.',
    'charity',
    'SG',
    'Meta',
    'image',
    'portrait',
    'draft',
    41,
    0n,
    0,
    0,
  ),
  seed(
    11,
    'tampines-8210-doors-4949',
    'We knocked on 8,210 doors in your block.',
    'Tampines FSC · less than 4% give · recurring S$45/mo.',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'review',
    39,
    0n,
    0,
    0,
  ),
  seed(
    12,
    'tampines-quiet-8pct-4948',
    "Singapore's quiet 8% live below the line.",
    'Tampines FSC · poverty awareness · review required (claim sourcing).',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'blocked',
    44,
    0n,
    0,
    0,
  ),
  seed(
    13,
    'tampines-door-fed-4947',
    'A door knocked is a child fed.',
    'Tampines FSC · S$45/mo via PayNow.',
    'charity',
    'SG',
    'Meta',
    'image',
    'portrait',
    'approved',
    40,
    0n,
    0,
    0,
  ),
  seed(
    14,
    'tampines-cdc-voucher-4946',
    'Your CDC voucher? Stretch it twice as far.',
    'Tampines FSC · round-up at POS · recurring S$5/mo.',
    'charity',
    'SG',
    'Meta',
    'carousel',
    'square',
    'approved',
    43,
    0n,
    0,
    0,
  ),
  seed(
    15,
    'tampines-knockknock-4945',
    'Knock-knock. Tampines is here.',
    'Tampines FSC · youngest sponsor 16, oldest 92.',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'published',
    45,
    84_00n,
    38,
    5.2,
  ),
  seed(
    16,
    'pestmax-tx-termites-4944',
    "Termites cost Texas homeowners $5B/year. We're cheaper.",
    'PestMax · TX-CPM 8845 · same-day · 60-day warranty.',
    'pest',
    'US',
    'Google',
    'image',
    'square',
    'published',
    36,
    92_00n,
    28,
    4.4,
  ),
  seed(
    17,
    'pestmax-houston-combo-4943',
    'Pre-summer special: ant + roach combo, $89.',
    'PestMax · Houston · same-day · TX licensed.',
    'pest',
    'US',
    'TikTok',
    'video',
    'vertical',
    'review',
    71,
    0n,
    0,
    0,
  ),
  seed(
    18,
    'sunlinkco-roi-calc-4942',
    'You spent $312 on power last month. Solar would cost $87.',
    'SunlinkCo · ROI calc · Boise + Phoenix · 25-year warranty.',
    'solar',
    'US',
    'Meta',
    'carousel',
    'square',
    'approved',
    52,
    0n,
    0,
    0,
  ),
  seed(
    19,
    'sunlinkco-text-quote-4941',
    'Free quote, no salesperson. Knockers leave a card.',
    'SunlinkCo · text-back quote · install in 6wk · ITC.',
    'solar',
    'US',
    'Meta',
    'image',
    'portrait',
    'published',
    47,
    142_00n,
    36,
    4.8,
  ),
  seed(
    20,
    'wv-au-13m-on-books-4940',
    'World Vision: 1.3M Australians on our giving books.',
    'World Vision AU · child sponsorship · trust 92% (Roy Morgan).',
    'charity',
    'AU',
    'Google',
    'image',
    'square',
    'published',
    42,
    168_00n,
    84,
    6.1,
  ),
  seed(
    21,
    'wv-au-coffee-cost-4939',
    'For the cost of a coffee, a child eats this week.',
    'World Vision AU · $9.50/wk · ACNC-registered · DGR Item 1.',
    'charity',
    'AU',
    'Meta',
    'image',
    'portrait',
    'published',
    38,
    124_00n,
    92,
    7.1,
  ),
  seed(
    22,
    'wv-au-nsw-28400-4938',
    'Knockers cleared 28,400 doors in NSW this month.',
    'World Vision AU · SEIFA decile-9 zones · CHOICE DNK respected.',
    'charity',
    'AU',
    'Meta',
    'carousel',
    'square',
    'approved',
    51,
    0n,
    0,
    0,
  ),
  seed(
    23,
    'goldcoast-oncology-4937',
    'Gold Coast Hospital · new oncology wing · open 2027.',
    'Gold Coast Hosp Foundation · capital campaign · QLD-CCA 8845.',
    'charity',
    'AU',
    'Meta',
    'image',
    'portrait',
    'approved',
    39,
    0n,
    0,
    0,
  ),
  seed(
    24,
    'wv-au-surry-hills-4936',
    "A child in Surry Hills doesn't need to be alone tonight.",
    'World Vision AU · NSW urban appeal · SEIFA-targeted.',
    'charity',
    'AU',
    'Meta',
    'image',
    'square',
    'review',
    44,
    0n,
    0,
    0,
  ),
  seed(
    25,
    'wv-au-nsw-14200-4935',
    'NSW · 14,200 sponsors waiting on a Knocker visit.',
    'World Vision AU · ops dashboard · SEIFA decile-10 priority.',
    'charity',
    'AU',
    'Meta',
    'image',
    'square',
    'draft',
    41,
    0n,
    0,
    0,
  ),
  seed(
    26,
    'hf-dollar-stretch-4934',
    'A Hope Forward dollar lasts longer than the dollar in your pocket.',
    'Hope Forward · efficiency 92¢/$ · ACFR-audited · 4-star Charity Navigator.',
    'charity',
    'US',
    'Google',
    'image',
    'square',
    'published',
    37,
    142_00n,
    71,
    5.8,
  ),
  seed(
    27,
    'hf-pilot-charlie-4933',
    '4,831 conversions in May. Pilot Charlie working.',
    'Hope Forward · ops update · internal share.',
    'charity',
    'US',
    'Meta',
    'image',
    'square',
    'draft',
    33,
    0n,
    0,
    0,
  ),
  seed(
    28,
    'pestmax-28-trucks-4932',
    'TX pest licence 8845 · 28 trucks · 3 hours response.',
    'PestMax · Houston + Dallas · live ops update.',
    'pest',
    'US',
    'Google',
    'image',
    'square',
    'published',
    35,
    64_00n,
    22,
    4.1,
  ),
  seed(
    29,
    'pestmax-az-termite-4931',
    'AZ summer: termite-season starts in May. We knock at 9am.',
    'PestMax · Phoenix · seasonal · AZ-CPM 1041.',
    'pest',
    'US',
    'TikTok',
    'video',
    'vertical',
    'review',
    64,
    0n,
    0,
    0,
  ),
  seed(
    30,
    'nextgen-bill-decoded-4930',
    "Your power bill, decoded. We'll send a Knocker.",
    'NextGen Power · TX retail · DMO/VDO disclosed · door audit.',
    'energy',
    'US',
    'Meta',
    'carousel',
    'square',
    'review',
    49,
    0n,
    0,
    0,
  ),
  seed(
    31,
    'sunlinkco-boise-11m-4929',
    'Boise homes saved $11M with SunlinkCo in 2025.',
    'SunlinkCo · ID + WA · 25-year warranty · Clean Energy badge.',
    'solar',
    'US',
    'YouTube',
    'video',
    'video',
    'published',
    78,
    218_00n,
    48,
    5.6,
  ),
  seed(
    32,
    'sunlinkco-8min-quote-4928',
    'A solar quote in 8 minutes. Knocker can sketch your roof.',
    'SunlinkCo · ID + WA · ROI calc · cancel anytime.',
    'solar',
    'US',
    'Meta',
    'image',
    'square',
    'approved',
    40,
    0n,
    0,
    0,
  ),
  seed(
    33,
    'scs-pilot-412-sgp-4927',
    'SCS pilot: 412 Singaporeans now give monthly.',
    'Singapore Cancer Society · pilot · UEN T26CC0021K · IPC.',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'published',
    42,
    64_00n,
    31,
    4.9,
  ),
  seed(
    34,
    'scs-pap-smear-4926',
    'Pap smears for free, courtesy of your PayNow today.',
    'SCS pilot · awareness · Toa Payoh · permit PLRD/H2H/2026/0214.',
    'charity',
    'SG',
    'Meta',
    'image',
    'portrait',
    'approved',
    44,
    0n,
    0,
    0,
  ),
  seed(
    35,
    'scs-recovery-story-4925',
    "A neighbour's recovery story. S$45/mo.",
    'SCS pilot · personal narrative · UEN T26CC0021K.',
    'charity',
    'SG',
    'Meta',
    'video',
    'vertical',
    'published',
    71,
    88_00n,
    39,
    5.9,
  ),
  seed(
    36,
    'scs-survivor-walk-4924',
    'You walked past 4 cancer survivors today. They walked thanks to SCS.',
    'SCS pilot · awareness · review pending (claim sourcing).',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'blocked',
    46,
    0n,
    0,
    0,
  ),
  seed(
    37,
    'scs-ipc-recycle-4923',
    'Recycle a dollar of giving. Earn IPC 250% deduction.',
    'SCS pilot · tax-positioning · IPC 000211.',
    'charity',
    'SG',
    'Google',
    'image',
    'square',
    'approved',
    41,
    0n,
    0,
    0,
  ),
  seed(
    38,
    'scs-grandma-28-kids-4922',
    'Stayed-at-home grandma · 28 grandkids · 1 PayNow.',
    'SCS pilot · multi-generational appeal · PLRD permitted.',
    'charity',
    'SG',
    'Meta',
    'carousel',
    'square',
    'review',
    52,
    0n,
    0,
    0,
  ),
  seed(
    39,
    'hf-pilot-charlie-ops-4921',
    'Pilot Charlie: 218 Knockers, 4,831 conversions in May.',
    'Hope Forward · ops update · internal · ACFR audit copy.',
    'charity',
    'US',
    'Google',
    'image',
    'square',
    'draft',
    35,
    0n,
    0,
    0,
  ),
  seed(
    40,
    'tampines-4s-read-4920',
    'You read this in 4s. A Tampines knock takes 90s.',
    'Tampines FSC · efficiency · S$45/mo recurring.',
    'charity',
    'SG',
    'TikTok',
    'video',
    'vertical',
    'review',
    68,
    0n,
    0,
    0,
  ),
  seed(
    41,
    'sunlinkco-free-math-4919',
    '"Free solar" — we\'ll never say it. Here\'s the actual math.',
    'SunlinkCo · transparency · ROI calc · ID + WA.',
    'solar',
    'US',
    'Meta',
    'image',
    'square',
    'published',
    43,
    88_00n,
    24,
    4.7,
  ),
  seed(
    42,
    'hf-charity-navigator-4918',
    'Hope Forward · 5-star Charity Navigator · 7 years running.',
    'Hope Forward · trust badge · ACFR-audited · 92¢/$.',
    'charity',
    'US',
    'YouTube',
    'video',
    'video',
    'published',
    79,
    184_00n,
    42,
    5.3,
  ),
  seed(
    43,
    'pestmax-no-surprise-4917',
    'Pest control without surprise fees. TX-CPM 8845.',
    'PestMax · transparent pricing · 60-day warranty.',
    'pest',
    'US',
    'Google',
    'image',
    'square',
    'approved',
    37,
    0n,
    0,
    0,
  ),
  seed(
    44,
    'wv-au-carlton-knock-4916',
    'Knockers walked 312 km in Carlton this week.',
    'World Vision AU · VIC ops · SEIFA decile-9 targeting.',
    'charity',
    'AU',
    'Meta',
    'image',
    'square',
    'draft',
    40,
    0n,
    0,
    0,
  ),
  seed(
    45,
    'wv-au-sponsor-letter-4915',
    'Your sponsor letter arrives in 14 days. Knocker delivers if local.',
    'World Vision AU · sponsor experience · personal touch.',
    'charity',
    'AU',
    'Meta',
    'carousel',
    'square',
    'approved',
    48,
    0n,
    0,
    0,
  ),
  seed(
    46,
    'nextgen-tx-dmo-tablet-4914',
    'NextGen Power Texas — Knocker shows DMO live on tablet.',
    'NextGen Power · transparency · AER retail code compliant.',
    'energy',
    'US',
    'Meta',
    'image',
    'portrait',
    'review',
    44,
    0n,
    0,
    0,
  ),
  seed(
    47,
    'tampines-live-ops-4913',
    'Tampines · 8,210 HDB units · 412 giving today.',
    'Tampines FSC · live ops · S$45/mo via PayNow.',
    'charity',
    'SG',
    'Meta',
    'image',
    'square',
    'published',
    42,
    71_00n,
    24,
    4.4,
  ),
  seed(
    48,
    'scs-bedok-stairwell-4912',
    'Stairwell-by-stairwell · Bedok block 412.',
    'SCS pilot · area-specific · UEN T26CC0021K.',
    'charity',
    'SG',
    'Meta',
    'image',
    'portrait',
    'approved',
    41,
    0n,
    0,
    0,
  ),
  seed(
    49,
    'pestmax-89-mo-recurring-4911',
    'A pest-free home for $89/mo. TX + AZ.',
    'PestMax · recurring · 28-truck fleet · same-day.',
    'pest',
    'US',
    'Meta',
    'image',
    'square',
    'published',
    38,
    124_00n,
    41,
    5.1,
  ),
  seed(
    50,
    'hf-tx-townhall-4910',
    'Hope Forward · TX Town Hall · Knocker leadership.',
    'Hope Forward · annual · ACFR-audited · ops transparency.',
    'charity',
    'US',
    'YouTube',
    'video',
    'video',
    'published',
    82,
    184_00n,
    38,
    4.8,
  ),
  seed(
    51,
    'wv-au-melbourne-knock-4909',
    'Melbourne knock teams cleared 18,400 doors · week of 22 May.',
    'World Vision AU · VIC live ops · SEIFA decile-9.',
    'charity',
    'AU',
    'Meta',
    'image',
    'square',
    'approved',
    41,
    0n,
    0,
    0,
  ),
  seed(
    52,
    'pestmax-az-summer-tip-4908',
    'Phoenix tip: pre-treat in May, save $400 by August.',
    'PestMax · AZ-CPM 1041 · seasonal pricing · 28-truck fleet.',
    'pest',
    'US',
    'TikTok',
    'video',
    'vertical',
    'review',
    64,
    0n,
    0,
    0,
  ),
  seed(
    53,
    'sunlinkco-text-back-4907',
    'Text the word ROOF to (208) 555-0142. Quote in 4 min.',
    'SunlinkCo · text-back · ID + WA · ROI calc.',
    'solar',
    'US',
    'Meta',
    'image',
    'square',
    'published',
    39,
    64_00n,
    18,
    4.2,
  ),
  seed(
    54,
    'hf-mothers-day-4906',
    'Mothers Day · sponsor a child in her name.',
    'Hope Forward · Mothers Day 2026 · matched 2:1.',
    'charity',
    'US',
    'Meta',
    'carousel',
    'square',
    'published',
    51,
    124_00n,
    84,
    5.8,
  ),
  seed(
    55,
    'wv-au-nsw-callbacks-4905',
    'NSW SEIFA-9 callbacks · 4,812 doors reactivated.',
    'World Vision AU · NSW callback ops · retargeting feed.',
    'charity',
    'AU',
    'Meta',
    'image',
    'square',
    'approved',
    38,
    0n,
    0,
    0,
  ),
  seed(
    56,
    'tampines-paynow-recur-4904',
    'PayNow recurring · S$45/mo · auto-debit · stop anytime.',
    'Tampines FSC · simplest possible setup.',
    'charity',
    'SG',
    'Meta',
    'image',
    'portrait',
    'published',
    36,
    94_00n,
    28,
    5.4,
  ),
  seed(
    57,
    'pestmax-houston-ant-4903',
    'Houston ant infestation? We get it. $89 same-day.',
    'PestMax · Houston · same-day · 60-day warranty.',
    'pest',
    'US',
    'Google',
    'image',
    'square',
    'approved',
    38,
    0n,
    0,
    0,
  ),
  seed(
    58,
    'hf-charity-nav-badge-4902',
    'Charity Navigator 4-star · Hope Forward · 7 years running.',
    'Hope Forward · trust badge · ACFR-audited · 92¢/$.',
    'charity',
    'US',
    'Meta',
    'image',
    'square',
    'published',
    37,
    88_00n,
    41,
    5.7,
  ),
  seed(
    59,
    'sunlinkco-itc-update-4901',
    'ITC reduced to 26%. Lock your install before Q3.',
    'SunlinkCo · time-bound · ID + WA · ITC accurate.',
    'solar',
    'US',
    'Meta',
    'carousel',
    'square',
    'review',
    49,
    0n,
    0,
    0,
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

function aspectClass(a: Aspect): string {
  switch (a) {
    case 'square':
      return 'aspect-square';
    case 'portrait':
      return 'aspect-[4/5]';
    case 'vertical':
      return 'aspect-[9/16]';
    case 'video':
      return 'aspect-video';
  }
}

function aspectDims(a: Aspect): { w: number; h: number } {
  switch (a) {
    case 'square':
      return { w: 600, h: 600 };
    case 'portrait':
      return { w: 600, h: 750 };
    case 'vertical':
      return { w: 450, h: 800 };
    case 'video':
      return { w: 800, h: 450 };
  }
}

function channelBadge(c: Channel): string {
  switch (c) {
    case 'Meta':
      return 'bg-blue-100 text-blue-700';
    case 'Google':
      return 'bg-amber-100 text-amber-700';
    case 'TikTok':
      return 'bg-rose-100 text-rose-700';
    case 'YouTube':
      return 'bg-red-100 text-red-700';
  }
}

const VERTICAL_OPTS: Array<{ value: Vertical | 'all'; label: string }> = [
  { value: 'all', label: 'All verticals' },
  { value: 'charity', label: 'Charity' },
  { value: 'pest', label: 'Pest' },
  { value: 'solar', label: 'Solar' },
  { value: 'energy', label: 'Energy' },
];
const REGION_OPTS: Array<{ value: Region | 'all'; label: string }> = [
  { value: 'all', label: 'All regions' },
  { value: 'US', label: 'US' },
  { value: 'AU', label: 'AU' },
  { value: 'SG', label: 'SG' },
];
const CHANNEL_OPTS: Array<{ value: Channel | 'all'; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'Meta', label: 'Meta' },
  { value: 'Google', label: 'Google' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'YouTube', label: 'YouTube' },
];
const STATUS_OPTS: Array<{ value: Status | 'all'; label: string }> = [
  { value: 'all', label: 'All status' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'blocked', label: 'Blocked' },
];

export default function CreativeLibraryPage(): JSX.Element {
  const [vertical, setVertical] = useState<Vertical | 'all'>('all');
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      LIBRARY.filter((c) => {
        if (vertical !== 'all' && c.vertical !== vertical) return false;
        if (region !== 'all' && c.region !== region) return false;
        if (channel !== 'all' && c.channel !== channel) return false;
        if (status !== 'all' && c.status !== status) return false;
        if (query) {
          const q = query.toLowerCase();
          if (!c.headline.toLowerCase().includes(q) && !c.copy.toLowerCase().includes(q))
            return false;
        }
        return true;
      }),
    [vertical, region, channel, status, query],
  );

  const opened = openId ? LIBRARY.find((c) => c.id === openId) : null;
  const drafts = LIBRARY.filter((c) => c.status === 'draft').length;
  const reviews = LIBRARY.filter((c) => c.status === 'review').length;
  const approved = LIBRARY.filter((c) => c.status === 'approved').length;
  const published = LIBRARY.filter((c) => c.status === 'published').length;
  const blocked = LIBRARY.filter((c) => c.status === 'blocked').length;
  const totalCostCents = LIBRARY.reduce((s, c) => s + c.costCents, 0);

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered(): void {
    if (filtered.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const selectedCount = selectedIds.size;

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
          subtitle="Filter chips live-update the grid · select rows for bulk operations"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft pointer-events-none"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search headline or copy"
                  className="text-[12px] pl-7 pr-3 py-1.5 rounded-full border border-line2 bg-paper text-ink w-[260px] focus:ring-1 focus:ring-accent focus:outline-none"
                />
              </div>
              <span className="w-px h-4 bg-line2 mx-1" />
              {VERTICAL_OPTS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  active={vertical === opt.value}
                  onClick={() => setVertical(opt.value)}
                />
              ))}
              <span className="w-px h-4 bg-line2 mx-1" />
              {REGION_OPTS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  active={region === opt.value}
                  onClick={() => setRegion(opt.value)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {CHANNEL_OPTS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  active={channel === opt.value}
                  onClick={() => setChannel(opt.value)}
                />
              ))}
              <span className="w-px h-4 bg-line2 mx-1" />
              {STATUS_OPTS.map((opt) => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  active={status === opt.value}
                  onClick={() => setStatus(opt.value)}
                />
              ))}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" leftIcon={<SlidersHorizontal size={13} />}>
                  Advanced
                </Button>
                <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
                  New creative
                </Button>
              </div>
            </div>
            <div className="pt-3 border-t border-line2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-[11.5px] text-muted">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={selectAllFiltered}
                    className="accent-accent"
                  />
                  <span>
                    {selectedCount > 0
                      ? `${selectedCount} of ${filtered.length} selected`
                      : `Select all ${filtered.length}`}
                  </span>
                </label>
                <span className="text-soft">·</span>
                <span>
                  spend across library:{' '}
                  <span className="text-ink font-semibold">
                    ${(totalCostCents / 100).toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Send size={13} />}
                  disabled={selectedCount === 0}
                >
                  Send to review
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Check size={13} />}
                  disabled={selectedCount === 0}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Archive size={13} />}
                  disabled={selectedCount === 0}
                >
                  Archive
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Download size={13} />}
                  disabled={selectedCount === 0}
                >
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 size={13} />}
                  disabled={selectedCount === 0}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title={`Creatives · ${filtered.length}`}
          subtitle="Click a tile to inspect full preview + activity log"
        >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[12.5px] text-muted">
              No creatives match your filters. Clear filters to see all {LIBRARY.length}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((c) => (
                <LibraryCard
                  key={c.id}
                  creative={c}
                  selected={selectedIds.has(c.id)}
                  onToggle={() => toggleSelect(c.id)}
                  onOpen={() => setOpenId(c.id)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {opened && <DetailDrawer creative={opened} onClose={() => setOpenId(null)} />}
    </PlatformShell>
  );
}

function LibraryCard({
  creative,
  selected,
  onToggle,
  onOpen,
}: {
  creative: LibraryCreative;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}): JSX.Element {
  const dims = aspectDims(creative.aspect);
  return (
    <div
      className={`card overflow-hidden cursor-pointer transition relative ${selected ? 'ring-2 ring-accent' : 'hover:ring-1 hover:ring-accent'}`}
      onClick={onOpen}
    >
      <div className={`${aspectClass(creative.aspect)} relative overflow-hidden bg-paper`}>
        <img
          src={pickCreativeImage(
            inferTheme({
              vertical: creative.vertical,
              headline: creative.headline,
              copy: creative.copy,
            }),
            creative.id,
            { w: dims.w, h: dims.h },
          )}
          alt={creative.headline}
          width={dims.w}
          height={dims.h}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 accent-accent"
          />
          <span
            className={`rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold ${channelBadge(creative.channel)}`}
          >
            {creative.channel}
          </span>
        </div>
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
            title="C2PA signed"
          >
            <FileCheck2 size={9} /> C2PA
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <div className="text-surface text-[11.5px] font-semibold leading-snug drop-shadow-md line-clamp-2">
            {creative.headline}
          </div>
        </div>
      </div>
      <div className="p-2.5 space-y-1.5">
        <div className="text-[10.5px] text-muted line-clamp-2 leading-snug">{creative.copy}</div>
        <div className="flex items-center justify-between pt-1.5 border-t border-line2 text-[10px]">
          <span className="text-muted capitalize">
            {creative.vertical} · {creative.region} · {creative.format}
          </span>
          {creative.roas > 0 ? (
            <span className="text-success font-semibold">{creative.roas.toFixed(1)}x</span>
          ) : (
            <span className="text-soft">—</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <StatusPill tone={statusTone(creative.status)}>{creative.status}</StatusPill>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="w-5 h-5 rounded hover:bg-successSoft flex items-center justify-center text-success"
              title="Approve"
            >
              <Check size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="w-5 h-5 rounded hover:bg-dangerSoft flex items-center justify-center text-danger"
              title="Reject"
            >
              <X size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="w-5 h-5 rounded hover:bg-paper flex items-center justify-center text-soft"
              title="Inspect"
            >
              <Eye size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({
  creative,
  onClose,
}: {
  creative: LibraryCreative;
  onClose: () => void;
}): JSX.Element {
  const dims = aspectDims(creative.aspect);
  const similar = LIBRARY.filter(
    (c) => c.id !== creative.id && c.vertical === creative.vertical && c.region === creative.region,
  ).slice(0, 4);
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
      <aside
        className="w-[520px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
          <div>
            <div className="text-[12.5px] font-semibold text-ink">{creative.id}</div>
            <div className="text-[10.5px] text-muted">{creative.headline.slice(0, 48)}…</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center text-soft"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div
            className={`${aspectClass(creative.aspect)} relative overflow-hidden bg-paper rounded-lg`}
          >
            <img
              src={pickCreativeImage(
                inferTheme({
                  vertical: creative.vertical,
                  headline: creative.headline,
                  copy: creative.copy,
                }),
                creative.id,
                { w: dims.w, h: dims.h },
              )}
              alt={creative.headline}
              width={dims.w}
              height={dims.h}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ink leading-snug">
              {creative.headline}
            </div>
            <div className="text-[12px] text-muted mt-1 leading-snug">{creative.copy}</div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Metric
              icon={<Activity size={11} className="text-accent" />}
              label="Conversions"
              value={creative.conversions.toString()}
            />
            <Metric
              icon={<TrendingUp size={11} className="text-success" />}
              label="ROAS"
              value={creative.roas > 0 ? `${creative.roas.toFixed(1)}x` : '—'}
            />
            <Metric
              icon={<Calendar size={11} className="text-accent" />}
              label="Created"
              value={creative.createdAt}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <Meta label="Vertical" value={creative.vertical} />
            <Meta label="Region" value={creative.region} />
            <Meta label="Channel" value={creative.channel} />
            <Meta label="Format" value={creative.format} />
            <Meta label="Cost" value={`$${(creative.costCents / 100).toFixed(2)}`} />
            <Meta label="C2PA" value={creative.c2paId} mono />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
              Activity log
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted">
              <li className="flex items-start gap-2">
                <Check size={11} className="text-success mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">Approved</span> by Brodie · 2026-05-24
                  09:38
                </span>
              </li>
              <li className="flex items-start gap-2">
                <FileCheck2 size={11} className="text-success mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">Safety scan passed</span> · 4 rules ·
                  2026-05-24 09:36
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Activity size={11} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">Generated</span> · flux-1.1-pro · seed
                  482910
                </span>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
              Similar creatives
            </div>
            <div className="grid grid-cols-4 gap-2">
              {similar.map((s) => {
                const sdims = aspectDims(s.aspect);
                return (
                  <div
                    key={s.id}
                    className="aspect-square rounded overflow-hidden border border-line2"
                  >
                    <img
                      src={pickCreativeImage(
                        inferTheme({ vertical: s.vertical, headline: s.headline, copy: s.copy }),
                        s.id,
                        { w: sdims.w, h: sdims.h },
                      )}
                      alt={s.headline}
                      width={120}
                      height={120}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-line2">
            <Button variant="primary" size="sm" leftIcon={<Check size={12} />}>
              Approve
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<X size={12} />}>
              Reject
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Send size={12} />}>
              Send to review
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface transition'
          : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full border border-line2 text-muted hover:text-ink hover:border-soft transition'
      }
    >
      {label}
    </button>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="border border-line2 rounded-md p-2">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">{value}</div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-[11.5px] font-semibold text-ink ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}
