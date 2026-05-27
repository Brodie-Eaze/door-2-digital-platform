import { Fragment } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Banner, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { AccountAvatar } from '@/components/AccountAvatar';
import { ACCOUNTS } from '@/lib/accounts';

interface ScreenEntry {
  href: string;
  title: string;
  scope: 'HQ' | 'In-account' | 'Mobile';
  surface: string;
  description: string;
  preview:
    | 'kpi-rail'
    | 'kanban'
    | 'iphone'
    | 'sidebar-table'
    | 'flow'
    | 'cards-grid'
    | 'dialer'
    | 'timeline'
    | 'matrix'
    | 'creative-grid';
}

const SCREENS: ScreenEntry[] = [
  {
    href: '/accounts',
    title: 'Accounts portfolio',
    scope: 'HQ',
    surface: 'Operator',
    description:
      "Brodie's team home — 4 sub-accounts (charity + commercial) with cross-account roll-up.",
    preview: 'cards-grid',
  },
  {
    href: '/accounts/hope-forward/today',
    title: 'Today — Hope Forward',
    scope: 'In-account',
    surface: 'Org workspace',
    description: 'Mission-control inside a charity account. Anomalies, leaderboard, territories.',
    preview: 'kpi-rail',
  },
  {
    href: '/accounts/hope-forward/leads',
    title: 'Leads inbox',
    scope: 'In-account',
    surface: 'CRM',
    description: 'Every Knocker-captured + ad-clicked lead lands here. 3-source attribution.',
    preview: 'cards-grid',
  },
  {
    href: '/accounts/hope-forward/leads/maria-santos',
    title: 'Lead journey timeline',
    scope: 'In-account',
    surface: 'CRM',
    description: 'One lead from door knock → SMS → callback → converted donor (26h 51m).',
    preview: 'timeline',
  },
  {
    href: '/accounts/hope-forward/pipeline',
    title: 'Pipeline kanban (drag-drop live)',
    scope: 'In-account',
    surface: 'CRM',
    description: '5-stage kanban. Drag leads between stages — it actually works.',
    preview: 'kanban',
  },
  {
    href: '/accounts/hope-forward/lead-lists',
    title: 'Smart lead lists',
    scope: 'In-account',
    surface: 'CRM',
    description: 'Saved filter rules. Auto-updating dynamic lists. Push to campaigns + sequences.',
    preview: 'sidebar-table',
  },
  {
    href: '/accounts/hope-forward/campaigns',
    title: 'Marketing campaigns',
    scope: 'In-account',
    surface: 'Marketing',
    description: 'Multi-channel (Meta / Google / TikTok / Email / SMS) targeting smart lists.',
    preview: 'sidebar-table',
  },
  {
    href: '/accounts/hope-forward/drip',
    title: 'Sequence designer',
    scope: 'In-account',
    surface: 'Marketing',
    description: 'Per-pipeline-stage multi-step sequences. Channel-aware (SMS / email / call).',
    preview: 'flow',
  },
  {
    href: '/accounts/hope-forward/inside-sales',
    title: 'Inside sales dialer',
    scope: 'In-account',
    surface: 'CRM',
    description: 'Three-column cockpit — queue / script / objections. Aircall under the hood.',
    preview: 'dialer',
  },
  {
    href: '/accounts/hope-forward/knockers',
    title: 'Knockers roster',
    scope: 'In-account',
    surface: 'Field',
    description: "Today's knocker performance — knocks, conversions, revenue, idle alerts.",
    preview: 'sidebar-table',
  },
  {
    href: '/accounts/hope-forward/marketing-studio',
    title: 'AI marketing studio',
    scope: 'In-account',
    surface: 'Marketing',
    description: 'Brief in, AI generates copy / image / video. Brand-safety gated.',
    preview: 'creative-grid',
  },
  {
    href: '/accounts/world-vision/today',
    title: 'Today — World Vision (AU)',
    scope: 'In-account',
    surface: 'Org workspace',
    description: 'Same shell, different account. AU charity. Same KPIs, different data.',
    preview: 'kpi-rail',
  },
  {
    href: '/accounts/pestmax/today',
    title: 'Today — PestMax (commercial)',
    scope: 'In-account',
    surface: 'Org workspace',
    description: 'Commercial vertical. One-shot sales. Different conversion model.',
    preview: 'kpi-rail',
  },
  {
    href: '/compliance',
    title: 'Compliance — US 50-state matrix',
    scope: 'HQ',
    surface: 'Compliance',
    description: 'Paid-solicitor registration grid. Hard-blocks campaigns from un-cleared states.',
    preview: 'matrix',
  },
  {
    href: '/audit',
    title: 'Hash-chained audit log',
    scope: 'HQ',
    surface: 'Security',
    description: '7-year S3 Object Lock. Tamper-evident. Weekly Merkle root verified in CI.',
    preview: 'sidebar-table',
  },
  {
    href: '/billing',
    title: 'Cross-account billing',
    scope: 'HQ',
    surface: 'Finance',
    description: 'Invoices per account + MiCamp ISO residual roll-up.',
    preview: 'sidebar-table',
  },
  {
    href: '/mobile-preview',
    title: 'Knocker iOS app preview',
    scope: 'Mobile',
    surface: 'Field',
    description: 'Native iOS knocker app: Map, KnockSheet bottom sheet, Me/leaderboard.',
    preview: 'iphone',
  },
];

export default function ScreensPage(): JSX.Element {
  const grouped = {
    HQ: SCREENS.filter((s) => s.scope === 'HQ'),
    'In-account': SCREENS.filter((s) => s.scope === 'In-account'),
    Mobile: SCREENS.filter((s) => s.scope === 'Mobile'),
  };

  return (
    <PlatformShell pageTitle="Screens gallery">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Visual catalogue of every UI surface in Door 2 Digital OS. Click any tile to open the
            live screen.
            <span className="font-semibold ml-1">17 screens</span> total across HQ, in-account, and
            mobile.
          </span>
        </Banner>

        {(Object.entries(grouped) as Array<[string, ScreenEntry[]]>).map(([scope, items]) => (
          <Section
            key={scope}
            title={`${scope}${scope === 'In-account' ? ' (workspace)' : ''}`}
            subtitle={`${items.length} screens`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="card !p-0 overflow-hidden group hover:shadow-md transition cursor-pointer block"
                >
                  <ScreenPreview kind={s.preview} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-semibold text-ink truncate group-hover:text-accent transition">
                        {s.title}
                      </div>
                      <ExternalLink size={12} className="text-soft shrink-0 mt-1" />
                    </div>
                    <div className="text-[11px] text-muted mt-1">{s.description}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusPill
                        tone={scope === 'HQ' ? 'info' : scope === 'Mobile' ? 'warn' : 'success'}
                      >
                        {s.surface}
                      </StatusPill>
                      <code className="text-[10px] text-soft font-mono truncate">{s.href}</code>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        ))}

        <Section
          title="Accounts in the demo"
          subtitle="Click any account name to drop into its workspace"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ACCOUNTS.map((a) => (
              <Link
                key={a.slug}
                href={`/accounts/${a.slug}/today`}
                className="card card-pad text-center hover:shadow-md transition cursor-pointer flex flex-col items-center"
              >
                <AccountAvatar account={a} size={40} />
                <div className="text-[12px] font-semibold text-ink mt-2">{a.shortName}</div>
                <div className="text-[10px] text-muted capitalize mt-0.5">
                  {a.vertical} · {a.region}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}

/** Tiny stylised preview thumbnails per screen type. */
function ScreenPreview({ kind }: { kind: ScreenEntry['preview'] }): JSX.Element {
  const base = 'bg-paper relative overflow-hidden border-b border-line2';
  const style = { aspectRatio: '16/9' };
  switch (kind) {
    case 'kpi-rail':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-x-3 top-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface border border-line2 rounded p-1.5">
                <div className="h-1 w-8 bg-line2 rounded" />
                <div className="h-2.5 w-10 bg-ink rounded mt-1.5" />
                <div className="h-1 w-6 bg-success/40 rounded mt-1" />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-3 top-[60%] bg-surface border border-line2 rounded h-12">
            <div className="h-1 w-16 bg-accent/40 m-2 rounded" />
            <div className="h-1 w-32 bg-line2 mx-2 mt-1 rounded" />
          </div>
        </div>
      );
    case 'kanban':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-x-2 inset-y-2 grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((c) => (
              <div key={c} className="bg-surface border border-line2 rounded p-1 space-y-1">
                <div className="h-1.5 w-full bg-line2 rounded" />
                {Array.from({ length: c === 3 ? 4 : c === 1 ? 3 : 2 }).map((_, i) => (
                  <div key={i} className="h-3 bg-paper border border-line2 rounded" />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    case 'iphone':
      return (
        <div className={base} style={style}>
          <div className="absolute left-1/2 top-3 bottom-3 -translate-x-1/2 w-16 bg-ink rounded-xl p-1">
            <div className="bg-surface h-full rounded-lg relative">
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-ink rounded-full" />
              <div className="absolute inset-x-1 top-4 bottom-6 bg-paper rounded">
                <div className="absolute left-2 top-2 w-1.5 h-1.5 rounded-full bg-accent" />
                <div className="absolute left-5 top-4 w-1.5 h-1.5 rounded-full bg-success" />
                <div className="absolute left-3 top-7 w-1.5 h-1.5 rounded-full bg-ink" />
                <div className="absolute right-2 bottom-2 w-3 h-3 rounded bg-ink" />
              </div>
              <div className="absolute inset-x-1 bottom-1 h-4 bg-paper border-t border-line2 rounded-b flex items-center justify-around">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-soft" />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    case 'sidebar-table':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-x-3 inset-y-3 bg-surface border border-line2 rounded">
            <div className="h-3 border-b border-line2 flex items-center px-2">
              <div className="h-1 w-12 bg-line2 rounded" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 border-b border-line2 flex items-center px-2 gap-2">
                <div className="w-2 h-2 bg-ink rounded" />
                <div className="h-1 w-16 bg-line2 rounded" />
                <div className="flex-1" />
                <div className="h-1.5 w-6 bg-success/40 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'flow':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-0 flex items-center justify-around px-4">
            {[1, 2, 3, 4].map((i) => (
              <Fragment key={`n-${i}`}>
                <div className="w-8 h-8 rounded-lg bg-accentSoft border border-accent/30 flex items-center justify-center">
                  <div className="w-3 h-3 bg-accent rounded" />
                </div>
                {i < 4 && <div className="flex-1 h-px bg-line2" />}
              </Fragment>
            ))}
          </div>
        </div>
      );
    case 'cards-grid':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-3 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface border border-line2 rounded p-1.5">
                <div className="h-1.5 w-full bg-line2 rounded" />
                <div className="h-1 w-3/4 bg-line2 rounded mt-1" />
                <div className="h-1 w-1/2 bg-accent/40 rounded mt-1.5" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'dialer':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-2 grid grid-cols-12 gap-1.5">
            <div className="col-span-3 bg-surface border border-line2 rounded p-1 space-y-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-2.5 bg-paper border border-line2 rounded" />
              ))}
            </div>
            <div className="col-span-6 bg-surface border border-line2 rounded p-1 flex flex-col">
              <div className="flex-1 space-y-1">
                <div className="h-2 bg-line2 rounded w-1/2" />
                <div className="h-2 bg-line2 rounded w-3/4" />
                <div className="h-2 bg-line2 rounded w-2/3" />
              </div>
              <div className="h-4 bg-ink rounded flex items-center justify-around">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-surface" />
                ))}
              </div>
            </div>
            <div className="col-span-3 bg-surface border border-line2 rounded p-1 space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-paper border border-line2 rounded" />
              ))}
            </div>
          </div>
        </div>
      );
    case 'timeline':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-3 flex">
            <div className="w-6 flex flex-col items-center pt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Fragment key={`d-${i}`}>
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  {i < 5 && <div className="w-px flex-1 bg-line2 my-0.5" />}
                </Fragment>
              ))}
            </div>
            <div className="flex-1 space-y-2 pt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-surface border border-line2 rounded p-1.5">
                  <div className="h-1 w-3/4 bg-ink rounded" />
                  <div className="h-1 w-1/2 bg-line2 rounded mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 'matrix':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-3 grid grid-cols-10 gap-0.5">
            {Array.from({ length: 50 }).map((_, i) => {
              const colors = ['bg-success', 'bg-success', 'bg-accent', 'bg-warn', 'bg-line2'];
              return <div key={i} className={`${colors[i % 5]}/40 rounded-sm`} />;
            })}
          </div>
        </div>
      );
    case 'creative-grid':
      return (
        <div className={base} style={style}>
          <div className="absolute inset-3 grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-surface border border-line2 rounded overflow-hidden">
                <div className="h-2/3 bg-line2" />
                <div className="p-1">
                  <div className="h-1 w-3/4 bg-ink rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
  }
}
