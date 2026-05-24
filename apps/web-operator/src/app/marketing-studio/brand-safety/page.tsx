import {
  ShieldCheck,
  AlertTriangle,
  Eye,
  CheckCircle2,
  XCircle,
  Lock,
  Plus,
  Filter,
  Edit3,
  FileText,
  Clock,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Brand-safety control room.
 *
 * Per-vertical / per-jurisdiction rule packs (master plan §10.2),
 * recent safety blocks with reviewer assignment, custom rule list
 * (editable decoratively), legal-hold queue.
 */

interface RulePack {
  vertical: string;
  jurisdiction: string;
  rules: string[];
  active: number;
  inactive: number;
  lastBlock: string;
}

const RULE_PACKS: RulePack[] = [
  {
    vertical: 'Charity',
    jurisdiction: 'AU',
    rules: [
      'ACNC fundraising standards check',
      'No "guaranteed impact" without DGR backing',
      'DGR endorsement disclosure',
      'ACL substantiation on stat claims',
    ],
    active: 12,
    inactive: 2,
    lastBlock: '2026-05-24 09:31 AEST',
  },
  {
    vertical: 'Charity',
    jurisdiction: 'US',
    rules: [
      'NY State annual report boilerplate',
      'ACFR standards compliance',
      'No deceptive efficiency claims',
      'State-specific charitable disclosure (29 states)',
    ],
    active: 18,
    inactive: 3,
    lastBlock: '2026-05-24 08:14 EST',
  },
  {
    vertical: 'Charity',
    jurisdiction: 'SG',
    rules: [
      'Charity Council Code fundraising',
      'PLRD permit number disclosure',
      'IPC status accurate (250% deduction)',
      'No misleading impact projections',
    ],
    active: 10,
    inactive: 1,
    lastBlock: '2026-05-23 14:22 SGT',
  },
  {
    vertical: 'Pest control',
    jurisdiction: 'US',
    rules: [
      'Block health claims unless EPA-allowed',
      'ACL substantiation on efficacy',
      'APVMA / EPA chemical name disclosure',
      'No "100% guarantee" without contract',
    ],
    active: 9,
    inactive: 0,
    lastBlock: '2026-05-24 07:48 CST',
  },
  {
    vertical: 'Solar',
    jurisdiction: 'US',
    rules: [
      'Block "free solar" / "$0 down" w/o finance terms',
      'FTC Green Guides compliance',
      'ROI claims with assumption disclosure',
      'No state-incentive misrepresentation',
    ],
    active: 11,
    inactive: 1,
    lastBlock: '2026-05-24 06:32 PST',
  },
  {
    vertical: 'Solar',
    jurisdiction: 'AU',
    rules: [
      'Clean Energy Council Code',
      'Block "free solar" without finance terms',
      'STC valuation method disclosed',
      'Energy rebate eligibility accurate',
    ],
    active: 8,
    inactive: 1,
    lastBlock: '2026-05-22 11:18 AEST',
  },
  {
    vertical: 'Energy / Telco',
    jurisdiction: 'US',
    rules: [
      'FCC marketing rules compliance',
      'No locked comparison w/o DMO/VDO',
      'Cancellation fee disclosure',
      'No deceptive bill comparisons',
    ],
    active: 7,
    inactive: 1,
    lastBlock: '2026-05-23 22:54 CST',
  },
  {
    vertical: 'Energy / Telco',
    jurisdiction: 'AU',
    rules: [
      'AER retail code compliance',
      'DMO/VDO disclosure required',
      'No locked-comparison without Energy Made Easy ref',
      'Cancellation + reconnection fee disclosure',
    ],
    active: 9,
    inactive: 1,
    lastBlock: '2026-05-23 16:42 AEST',
  },
];

interface SafetyBlock {
  id: string;
  creativeId: string;
  creativeHeadline: string;
  ruleViolated: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reviewer: string;
  status: 'open' | 'in_review' | 'resolved' | 'escalated';
  ts: string;
  account: string;
}

const RECENT_BLOCKS: SafetyBlock[] = [
  {
    id: 'sb_4821',
    creativeId: 'cr_4948',
    creativeHeadline: '"Singapore\'s quiet 8% live below the line."',
    ruleViolated: 'Charity SG · ambiguous stat claim · requires source',
    severity: 'medium',
    reviewer: 'Brodie',
    status: 'in_review',
    ts: '2026-05-24 09:31:18',
    account: 'Tampines FSC pilot (SG)',
  },
  {
    id: 'sb_4820',
    creativeId: 'cr_4937',
    creativeHeadline: '"NextGen Power locks in your rate forever."',
    ruleViolated: 'Energy US · FCC · "forever" lock-in misleading',
    severity: 'high',
    reviewer: 'Brodie',
    status: 'escalated',
    ts: '2026-05-24 08:14:55',
    account: 'NextGen Power (US)',
  },
  {
    id: 'sb_4819',
    creativeId: 'cr_4924',
    creativeHeadline: '"Free solar. Pay nothing. Ever."',
    ruleViolated: 'Solar US · FTC Green Guides · finance terms missing',
    severity: 'critical',
    reviewer: 'Counsel (assigned)',
    status: 'escalated',
    ts: '2026-05-24 06:32:09',
    account: 'SunlinkCo (US)',
  },
  {
    id: 'sb_4818',
    creativeId: 'cr_4914',
    creativeHeadline: '"You walked past 4 cancer survivors today. SCS."',
    ruleViolated: 'Charity SG · COC · unverified personal-impact claim',
    severity: 'medium',
    reviewer: 'Brodie',
    status: 'open',
    ts: '2026-05-23 22:54:33',
    account: 'SCS pilot (SG)',
  },
  {
    id: 'sb_4817',
    creativeId: 'cr_4906',
    creativeHeadline: '"World Vision impact guaranteed."',
    ruleViolated: 'Charity AU · ACNC · "guaranteed" not permitted',
    severity: 'high',
    reviewer: 'Compliance team',
    status: 'resolved',
    ts: '2026-05-23 16:42:11',
    account: 'World Vision (AU)',
  },
  {
    id: 'sb_4816',
    creativeId: 'cr_4892',
    creativeHeadline: '"PestMax kills 100% of roaches in one visit."',
    ruleViolated: 'Pest US · ACL substantiation · efficacy claim',
    severity: 'medium',
    reviewer: 'Brodie',
    status: 'resolved',
    ts: '2026-05-23 14:22:08',
    account: 'PestMax (US)',
  },
  {
    id: 'sb_4815',
    creativeId: 'cr_4881',
    creativeHeadline: '"Donate a coffee, save a child."',
    ruleViolated: 'Charity US · NY · annual-report boilerplate missing',
    severity: 'low',
    reviewer: 'Auto-resolved',
    status: 'resolved',
    ts: '2026-05-23 11:18:55',
    account: 'Hope Forward (US)',
  },
  {
    id: 'sb_4814',
    creativeId: 'cr_4877',
    creativeHeadline: '"AZ summer: termite-season starts in May."',
    ruleViolated: 'Pest US · EPA chemical disclosure absent',
    severity: 'low',
    reviewer: 'Auto-resolved',
    status: 'resolved',
    ts: '2026-05-22 17:48:21',
    account: 'PestMax (US)',
  },
];

interface CustomRule {
  id: string;
  description: string;
  vertical: string;
  jurisdiction: string;
  method: 'regex' | 'llm-judge' | 'image-scan' | 'video-frame';
  blocksLast30d: number;
  enabled: boolean;
}

const CUSTOM_RULES: CustomRule[] = [
  {
    id: 'rule_281',
    description: 'Block "guaranteed" / "no risk" near impact words',
    vertical: 'Charity',
    jurisdiction: 'ALL',
    method: 'regex',
    blocksLast30d: 24,
    enabled: true,
  },
  {
    id: 'rule_282',
    description: 'LLM judge: misleading scarcity ("last chance", "expires today")',
    vertical: 'ALL',
    jurisdiction: 'ALL',
    method: 'llm-judge',
    blocksLast30d: 12,
    enabled: true,
  },
  {
    id: 'rule_283',
    description: 'Require PLRD permit number on SG charity creative',
    vertical: 'Charity',
    jurisdiction: 'SG',
    method: 'regex',
    blocksLast30d: 8,
    enabled: true,
  },
  {
    id: 'rule_284',
    description: 'Block "free" without finance-terms within 100 chars',
    vertical: 'Solar',
    jurisdiction: 'US',
    method: 'regex',
    blocksLast30d: 11,
    enabled: true,
  },
  {
    id: 'rule_285',
    description: 'Require DGR badge image present on AU charity creative',
    vertical: 'Charity',
    jurisdiction: 'AU',
    method: 'image-scan',
    blocksLast30d: 5,
    enabled: true,
  },
  {
    id: 'rule_286',
    description: 'Video frame scan: brand-competitor logo detection',
    vertical: 'ALL',
    jurisdiction: 'ALL',
    method: 'video-frame',
    blocksLast30d: 2,
    enabled: true,
  },
  {
    id: 'rule_287',
    description: 'Block "100%" near "kill" / "eliminate" / "destroy"',
    vertical: 'Pest control',
    jurisdiction: 'US',
    method: 'regex',
    blocksLast30d: 6,
    enabled: true,
  },
  {
    id: 'rule_288',
    description: 'LLM judge: vulnerable-audience language flag',
    vertical: 'Charity',
    jurisdiction: 'ALL',
    method: 'llm-judge',
    blocksLast30d: 18,
    enabled: true,
  },
  {
    id: 'rule_289',
    description: 'Reject if NY State annual report boilerplate missing',
    vertical: 'Charity',
    jurisdiction: 'US',
    method: 'regex',
    blocksLast30d: 3,
    enabled: true,
  },
  {
    id: 'rule_290',
    description: 'Block locked-rate energy claims without DMO ref',
    vertical: 'Energy / Telco',
    jurisdiction: 'ALL',
    method: 'llm-judge',
    blocksLast30d: 4,
    enabled: false,
  },
];

interface LegalHold {
  id: string;
  account: string;
  reason: string;
  openedAt: string;
  counsel: string;
  itemCount: number;
}

const LEGAL_HOLDS: LegalHold[] = [
  {
    id: 'lh_0027',
    account: 'SunlinkCo (US)',
    reason: 'FTC inquiry into "free solar" creative messaging',
    openedAt: '2026-05-18',
    counsel: 'Davis Wright Tremaine LLP',
    itemCount: 14,
  },
  {
    id: 'lh_0028',
    account: 'NextGen Power (US)',
    reason: 'State AG (TX) inquiry into rate-lock disclosures',
    openedAt: '2026-05-22',
    counsel: 'Vinson & Elkins LLP',
    itemCount: 8,
  },
];

function severityTone(s: SafetyBlock['severity']): 'muted' | 'info' | 'warn' | 'danger' {
  switch (s) {
    case 'low':
      return 'muted';
    case 'medium':
      return 'info';
    case 'high':
      return 'warn';
    case 'critical':
      return 'danger';
  }
}

function blockStatusTone(s: SafetyBlock['status']): 'success' | 'info' | 'warn' | 'danger' {
  switch (s) {
    case 'resolved':
      return 'success';
    case 'in_review':
      return 'info';
    case 'open':
      return 'warn';
    case 'escalated':
      return 'danger';
  }
}

export default function BrandSafetyPage(): JSX.Element {
  const totalActiveRules = RULE_PACKS.reduce((s, p) => s + p.active, 0);
  const openBlocks = RECENT_BLOCKS.filter(
    (b) => b.status === 'open' || b.status === 'in_review',
  ).length;
  const escalatedBlocks = RECENT_BLOCKS.filter((b) => b.status === 'escalated').length;
  const resolvedBlocks = RECENT_BLOCKS.filter((b) => b.status === 'resolved').length;
  const totalRulesActive = CUSTOM_RULES.filter((r) => r.enabled).length;

  return (
    <PlatformShell pageTitle="Brand safety control room">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span>
              Per-vertical, per-jurisdiction safety stack:{' '}
              <span className="font-semibold">Anthropic moderation</span> +{' '}
              <span className="font-semibold">custom rule engine</span> (regex + LLM-as-judge) +{' '}
              <span className="font-semibold">Sightengine</span> image scan + video frame sampling.
              Every block has a reviewer and an outcome.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Rule packs" value={RULE_PACKS.length} hint="per vert/jur" />
          <KpiCard
            label="Active rules"
            value={totalActiveRules}
            hint="across packs"
            deltaTone="positive"
          />
          <KpiCard
            label="Custom rules"
            value={`${totalRulesActive} / ${CUSTOM_RULES.length}`}
            hint="enabled"
          />
          <KpiCard label="Open blocks" value={openBlocks} deltaTone="negative" />
          <KpiCard
            label="Escalated"
            value={escalatedBlocks}
            hint="counsel review"
            deltaTone="negative"
          />
          <KpiCard label="Resolved 30d" value={resolvedBlocks} deltaTone="positive" />
        </div>

        <Section
          title="Rule packs · per vertical × jurisdiction"
          subtitle="Master plan §10.2 · click a card to inspect rule chain"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {RULE_PACKS.map((p) => (
              <div key={`${p.vertical}-${p.jurisdiction}`} className="card card-pad">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{p.vertical}</div>
                    <div className="text-[10.5px] text-muted">{p.jurisdiction}</div>
                  </div>
                  <StatusPill tone="success">
                    {p.active}/{p.active + p.inactive} active
                  </StatusPill>
                </div>
                <ul className="space-y-1 mb-2.5">
                  {p.rules.map((r, i) => (
                    <li
                      key={i}
                      className="text-[11.5px] text-muted leading-snug flex items-start gap-1.5"
                    >
                      <CheckCircle2 size={10} className="text-success mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 border-t border-line2 text-[10px] text-muted flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} /> last block
                  </span>
                  <span className="mono">{p.lastBlock}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title={`Recent safety blocks · ${RECENT_BLOCKS.length}`}
          subtitle="Sorted by recency · click to inspect creative + decision history"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                Filter
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Block ID</th>
                <th>Creative</th>
                <th>Account</th>
                <th>Rule violated</th>
                <th>Severity</th>
                <th>Reviewer</th>
                <th>Status</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RECENT_BLOCKS.map((b) => (
                <tr key={b.id} className="cursor-pointer hover:bg-paper">
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{b.id}</span>
                  </td>
                  <td>
                    <div className="text-[12.5px] font-medium text-ink leading-snug">
                      {b.creativeHeadline}
                    </div>
                    <div className="text-[10px] text-muted mono">{b.creativeId}</div>
                  </td>
                  <td className="text-[12px] text-ink">{b.account}</td>
                  <td className="text-[12px] text-muted">{b.ruleViolated}</td>
                  <td>
                    <StatusPill tone={severityTone(b.severity)}>{b.severity}</StatusPill>
                  </td>
                  <td className="text-[12px] text-ink">{b.reviewer}</td>
                  <td>
                    <StatusPill tone={blockStatusTone(b.status)}>
                      {b.status.replace('_', ' ')}
                    </StatusPill>
                  </td>
                  <td className="text-[11px] text-muted numeric">{b.ts}</td>
                  <td>
                    <button
                      type="button"
                      className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                      title="Inspect"
                    >
                      <Eye size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Custom rules"
          subtitle="Editable rule library · regex + LLM-as-judge + image/video scan"
          paddedBody={false}
          action={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
              New rule
            </Button>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Description</th>
                <th>Vertical</th>
                <th>Jurisdiction</th>
                <th>Method</th>
                <th>Blocks 30d</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {CUSTOM_RULES.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{r.id}</span>
                  </td>
                  <td className="text-[12.5px] text-ink">{r.description}</td>
                  <td className="text-[12px] text-muted">{r.vertical}</td>
                  <td className="text-[12px] text-muted">{r.jurisdiction}</td>
                  <td>
                    <span className="tag !text-[9px]">{r.method}</span>
                  </td>
                  <td className="text-[12px] text-ink numeric">{r.blocksLast30d}</td>
                  <td>
                    <StatusPill tone={r.enabled ? 'success' : 'muted'}>
                      {r.enabled ? 'Enabled' : 'Paused'}
                    </StatusPill>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                      title="Edit"
                    >
                      <Edit3 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title={`Legal-hold queue · ${LEGAL_HOLDS.length}`}
          subtitle="Counsel-routed items · creative + delivery frozen pending review"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LEGAL_HOLDS.map((h) => (
              <div key={h.id} className="card card-pad">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Lock size={13} className="text-warn" />
                      <div className="text-[13.5px] font-semibold text-ink">{h.account}</div>
                    </div>
                    <div className="text-[10.5px] text-muted mt-0.5 mono">
                      {h.id} · opened {h.openedAt}
                    </div>
                  </div>
                  <StatusPill tone="warn">{h.itemCount} items</StatusPill>
                </div>
                <div className="text-[12px] text-muted leading-snug mb-2">{h.reason}</div>
                <div className="pt-2 border-t border-line2 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 text-muted">
                    <FileText size={11} /> Counsel
                  </span>
                  <span className="text-ink font-medium">{h.counsel}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            icon={<XCircle size={14} className="text-danger" />}
            label="Critical blocks 7d"
            value="1"
            hint="SunlinkCo · FTC"
          />
          <StatTile
            icon={<AlertTriangle size={14} className="text-warn" />}
            label="High blocks 7d"
            value="3"
            hint="2 charity · 1 energy"
          />
          <StatTile
            icon={<CheckCircle2 size={14} className="text-success" />}
            label="Auto-resolved 7d"
            value="18"
            hint="regex + image-scan"
          />
          <StatTile
            icon={<ShieldCheck size={14} className="text-accent" />}
            label="Avg time to resolution"
            value="4.2 hr"
            hint="open → resolved"
          />
        </div>
      </div>
    </PlatformShell>
  );
}

function StatTile({
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
      <div className="mt-1.5 text-[18px] font-semibold text-ink tracking-tight numeric">
        {value}
      </div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}
