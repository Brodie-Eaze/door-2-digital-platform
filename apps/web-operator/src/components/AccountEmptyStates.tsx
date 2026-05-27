/**
 * Per-account empty-state surfaces.
 *
 * These wrap the shared `<EmptyState/>` + `<FirstRunChecklist/>` primitives
 * with copy tuned to the D2D account context. Pages call into these so the
 * "you just onboarded — here's what to do next" UX is consistent across
 * every screen.
 *
 * Sprint C: every per-account page in the audit list renders one of these
 * components when its data slice is legitimately empty. Pages with rich
 * seed data (hope-forward et al.) skip past these and render normally.
 */

'use client';

import {
  Inbox,
  Kanban,
  Phone,
  ListChecks,
  Megaphone,
  Sparkles,
  ImageIcon,
  Plug,
  BarChart3,
  Radio,
  Users,
  Map as MapIcon,
  CalendarClock,
  Target,
  Calendar,
  FileText,
  Globe,
  Heart,
  CheckSquare,
  Workflow,
  FolderOpen,
  CreditCard,
  ShieldCheck,
  UserPlus,
  Building2,
} from 'lucide-react';
import { EmptyState, FirstRunChecklist, Banner, type FirstRunMilestone } from '@d2d/ui-web';
import { defaultFirstRunMilestones } from '@/lib/first-run';

interface AccountEmptyProps {
  slug: string;
  accountName: string;
}

/**
 * Banner shown above every per-account page when the account is in first-run
 * mode. Keeps the surface itself functional (e.g. settings still renders)
 * while the operator is reminded that setup isn't finished.
 */
export function FirstRunBanner({ slug, accountName }: AccountEmptyProps): JSX.Element {
  return (
    <Banner tone="info">
      <span className="text-[13px]">
        <span className="font-semibold">{accountName}</span> is in first-run setup. Finish the
        checklist on{' '}
        <a className="font-semibold text-accent hover:underline" href={`/accounts/${slug}/today`}>
          today
        </a>{' '}
        to unlock live data on this surface.
      </span>
    </Banner>
  );
}

/**
 * `/today` first-run hero — the checklist itself. Other empty states show
 * their per-surface CTA + a hint pointing back at `/today`.
 */
export function TodayFirstRun({ slug, accountName }: AccountEmptyProps): JSX.Element {
  const milestones: FirstRunMilestone[] = defaultFirstRunMilestones(slug);
  return (
    <div className="space-y-5 max-w-[1500px]">
      <FirstRunChecklist accountName={accountName} milestones={milestones} />
      <EmptyState
        icon={BarChart3}
        title="Your command centre populates after the first knock."
        description="KPIs, anomaly cards, and the activity stream all wire up the moment your knockers start capturing leads. Tip: the first conversion usually lands inside 90 minutes of the first shift."
        primaryAction={{ label: 'Onboard knockers', href: `/accounts/${slug}/knockers` }}
        secondaryAction={{ label: 'Draw territory', href: `/accounts/${slug}/territories` }}
        variant="first-run"
      />
    </div>
  );
}

interface SurfaceProps extends AccountEmptyProps {
  /** Visual placement — `inline` drops it inside a Section card, `page` is
   *  the full-page hero. */
  placement?: 'page' | 'inline';
}

const VARIANT_FROM_PLACEMENT = (p: SurfaceProps['placement']) =>
  p === 'inline' ? { bare: true } : { bare: false };

export function LeadsEmpty({ slug, accountName, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Inbox}
      title="No leads captured yet."
      description={`Every knock by a ${accountName} knocker creates a lead — even if they did not sell on the spot. Install the Knocker iOS app on a field device to start.`}
      primaryAction={{ label: 'Open Knocker iOS preview', href: `/accounts/${slug}/knocker-ios` }}
      secondaryAction={{ label: 'Invite a knocker', href: `/accounts/${slug}/knockers` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function PipelineEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Kanban}
      title="No leads in the pipeline."
      description="Leads flow into stages as knockers and inside sales qualify them. Configure your pipeline stages first so qualification looks right when the first lead lands."
      primaryAction={{ label: 'Pipeline settings', href: `/accounts/${slug}/settings` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/pipeline' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function InsideSalesEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Phone}
      title="Inside sales has not dialled anyone yet."
      description="Drop a number into a Smart List to start a call session. Sequences and disposition tracking spin up automatically."
      primaryAction={{ label: 'Build a Smart List', href: `/accounts/${slug}/smart-lists` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/inside-sales' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function SmartListsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={ListChecks}
      title="No Smart Lists yet."
      description="Smart Lists group leads for batch outreach — segment by territory, source, lead age, or any tag. Build one to power your first inside-sales sequence."
      primaryAction={{ label: 'Build a Smart List', href: `/accounts/${slug}/smart-lists?new=1` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function CampaignsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Megaphone}
      title="No campaigns launched."
      description="Marketing campaigns spend on retargeting and lead-gen so your knockers walk into warm doors instead of cold ones."
      primaryAction={{ label: 'Open Marketing Studio', href: `/accounts/${slug}/marketing-studio` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/campaigns' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function MarketingStudioEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Sparkles}
      title="Generate your first creative."
      description="Claude writes the copy, FLUX paints the image. Approve in Library and it becomes eligible to publish to Meta or Google."
      primaryAction={{
        label: 'Generate creative',
        href: `/accounts/${slug}/marketing-studio/generate`,
      }}
      secondaryAction={{
        label: 'See the library',
        href: `/accounts/${slug}/marketing-studio/library`,
      }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function MarketingLibraryEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={ImageIcon}
      title="Nothing in your library yet."
      description="Drafts and approved creatives live here. Generate one in Studio to populate the shelves."
      primaryAction={{
        label: 'Generate creative',
        href: `/accounts/${slug}/marketing-studio/generate`,
      }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function MarketingIntegrationsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Plug}
      title="No ad providers connected."
      description="Connect Meta or Google to publish creatives. OAuth handshake takes about 90 seconds; pixels and Conversions API stitch up automatically."
      primaryAction={{
        label: 'Connect provider',
        href: `/accounts/${slug}/marketing-studio/integrations?new=1`,
      }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function MarketingCampaignsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Megaphone}
      title="No marketing campaigns running."
      description="Campaigns ride on the providers you connect in Integrations. Spin up your first to start spending on warm-door retargeting."
      primaryAction={{
        label: 'Launch a campaign',
        href: `/accounts/${slug}/marketing-studio/campaigns?new=1`,
      }}
      secondaryAction={{
        label: 'Manage integrations',
        href: `/accounts/${slug}/marketing-studio/integrations`,
      }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function ReportsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={BarChart3}
      title="Pick a date range with activity."
      description="Reports populate once knocks, conversions, or inside-sales calls land. Try Last 7 days once your first shift has run, or Last 30 days after a couple of weeks of trading."
      primaryAction={{ label: 'Onboard knockers', href: `/accounts/${slug}/knockers` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/reports' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function LiveMapEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Radio}
      title="All knockers offline."
      description="Either nobody has clocked in, or your shift is between sessions. Live pings reappear the moment a knocker starts their next door."
      primaryAction={{ label: 'Open roster', href: `/accounts/${slug}/roster` }}
      secondaryAction={{ label: 'Invite a knocker', href: `/accounts/${slug}/knockers` }}
      variant="anomaly"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function KnockersEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Users}
      title="No knockers on the roster."
      description="Onboard your first knocker via the Knocker iOS app or invite them by email. Once on, they show up here with live status, knocks, conversions, and revenue."
      primaryAction={{ label: 'Invite by email', href: `/accounts/${slug}/knockers?invite=1` }}
      secondaryAction={{ label: 'iOS app preview', href: `/accounts/${slug}/knocker-ios` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function TerritoriesEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={MapIcon}
      title="No territories drawn yet."
      description="Polygon the streets your knockers will work. Census + Mesh Block + heatmap layers paint on top, and knockers see boundaries in the iOS app immediately."
      primaryAction={{ label: 'Draw territory', href: `/accounts/${slug}/territories?new=1` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/territories' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function RosterEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={CalendarClock}
      title="No shifts scheduled."
      description="Block out next week so knockers know when to clock in. Roster + territories combine to staff every door without overlap."
      primaryAction={{ label: 'Schedule a shift', href: `/accounts/${slug}/roster?new=1` }}
      secondaryAction={{ label: 'Onboard knockers', href: `/accounts/${slug}/knockers` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function PlanningEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Target}
      title="No plans staged."
      description="Plan a campaign push — pick a territory, a window, a target revenue, and let the planner stage knockers + air cover together."
      primaryAction={{ label: 'New plan', href: `/accounts/${slug}/planning?new=1` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function CalendarsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Calendar}
      title="No events on the calendar."
      description="Sync Google or Outlook to pull existing events in, then layer roster shifts, callbacks, and campaign launches on top."
      primaryAction={{ label: 'Sync a calendar', href: `/accounts/${slug}/calendars?connect=1` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/calendars' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function FormsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={FileText}
      title="No capture forms built."
      description="Build a form once and embed it in your site, in a campaign, or have a knocker open it on the iOS app at the door. Submissions flow into Leads."
      primaryAction={{ label: 'Build a form', href: `/accounts/${slug}/forms?new=1` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function SitesEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Globe}
      title="No sites or funnels published."
      description="Build a landing page that converts visitors into leads. Templates, A/B testing, and form embedding included."
      primaryAction={{ label: 'New site', href: `/accounts/${slug}/sites?new=1` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function MembershipsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Heart}
      title="No membership programs yet."
      description="Run a recurring program — donor club, customer rewards, or a sustainer ladder. Stripe billing, sequence nurture, and member portal all bundled in."
      primaryAction={{ label: 'New program', href: `/accounts/${slug}/memberships?new=1` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function TasksEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={CheckSquare}
      title="Inbox zero."
      description="Tasks appear when a knocker pings you from the field, a lead callback comes due, or a campaign needs approval. Until then, everything is on track."
      primaryAction={{ label: 'New task', href: `/accounts/${slug}/tasks?new=1` }}
      variant="default"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function WorkflowsEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={Workflow}
      title="No workflows configured."
      description="Workflows automate the busy work: when a lead converts → fire a receipt; when a knocker idles 15 min → ping the manager. Build one to start."
      primaryAction={{ label: 'New workflow', href: `/accounts/${slug}/workflows?new=1` }}
      secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/workflows' }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function FilesEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No files uploaded."
      description="Pitch decks, charity letters, photos, contracts. Drag files here or upload via the iOS app at the door."
      primaryAction={{ label: 'Upload a file', href: `/accounts/${slug}/files?upload=1` }}
      variant="default"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function InvoicesEmpty({ placement, slug }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={CreditCard}
      title="No invoices generated yet."
      description="Your first monthly invoice generates on the 1st with platform fees + rakes itemised. Stripe + ACH + GoCardless rails wire up automatically."
      primaryAction={{ label: 'Billing settings', href: `/accounts/${slug}/settings` }}
      variant="default"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function ComplianceEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Compliance dashboard activates after first clearance."
      description="State registrations, bond filings, and consumer-protection windows light up here once counsel files them. Hand-shake takes ~2-3 weeks per state."
      primaryAction={{ label: 'Compliance roadmap', href: `/public/compliance` }}
      secondaryAction={{ label: 'See an example', href: `/accounts/hope-forward/compliance` }}
      variant="default"
      ariaLabel={`${slug} compliance · pre-clearance`}
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

export function TeamEmpty({ slug, placement }: SurfaceProps): JSX.Element {
  return (
    <EmptyState
      icon={UserPlus}
      title="Only you on the team so far."
      description="Invite your first ops manager, accountant, or compliance auditor. Each gets a role-scoped login (org_admin, accountant, compliance, readonly)."
      primaryAction={{ label: 'Invite teammate', href: `/accounts/${slug}/team?invite=1` }}
      variant="first-run"
      {...VARIANT_FROM_PLACEMENT(placement)}
    />
  );
}

/* ---------- Platform shell empty states ---------- */

export function AccountsEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Building2}
      title="No sub-accounts onboarded."
      description="Door 2 Digital scales by adding accounts. Each charity, commercial customer, or pilot gets its own workspace — territories, knockers, leads, pipeline, campaigns, compliance."
      primaryAction={{ label: 'Onboard new business', href: '/onboard-account' }}
      variant="first-run"
    />
  );
}

export function CommandCentreEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={BarChart3}
      title="No activity across the portfolio yet."
      description="Activity from your sub-accounts appears here once they start capturing leads and running campaigns. Usually inside the first hour after a roster goes live."
      primaryAction={{ label: 'Open accounts', href: '/accounts' }}
      secondaryAction={{ label: 'Onboard new business', href: '/onboard-account' }}
      variant="first-run"
    />
  );
}
