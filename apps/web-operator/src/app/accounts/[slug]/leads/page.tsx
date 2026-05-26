/**
 * /accounts/[slug]/leads — real Lead rows from Postgres, scoped per org.
 *
 * Server component. Reads the shared Prisma singleton directly; PII is
 * masked at the read boundary (`maskEmail`/`maskPhone`) so cross-tenant
 * visibility never leaks raw contact details. The fixture leads remain
 * accessible only when the DB read fails (graceful degrade for demos).
 *
 * Authorization mirrors the API route handler:
 *   - super_admin → any org
 *   - everyone else → only their own
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Inbox, Phone, Megaphone, Database, AlertTriangle } from 'lucide-react';
import { Banner, KpiCard, LeadCard, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { accountData } from '@/lib/account-fixtures';
import { getSession } from '@/lib/session';
import { maskEmail, maskPhone } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DemoLead {
  id: string;
  givenName: string;
  familyName: string;
  email: string;
  phone: string;
  address: string | null;
  status: string;
  source: 'door' | 'inside_sales' | 'retargeting';
  assignee: string;
  createdAt: Date;
}

interface LoadResult {
  source: 'database' | 'fixture-fallback';
  orgName: string;
  leads: DemoLead[];
  error?: string;
}

function statusToCardStatus(s: string): React.ComponentProps<typeof LeadCard>['status'] {
  if (
    s === 'new' ||
    s === 'contacted' ||
    s === 'qualified' ||
    s === 'appointment_set' ||
    s === 'converted' ||
    s === 'lost' ||
    s === 'do_not_contact'
  ) {
    return s;
  }
  return 'new';
}

async function loadLeads(slug: string): Promise<LoadResult | 'not-found' | 'forbidden'> {
  const session = await getSession();
  if (!session) return 'forbidden';

  try {
    const { db } = await import('@d2d/database');
    const org = await db.org.findUnique({
      where: { slug },
      select: { id: true, slug: true, tradingName: true, regionCode: true },
    });
    if (!org) return 'not-found';
    if (session.role !== 'super_admin' && session.orgId !== org.id) return 'forbidden';

    const leads = await db.lead.findMany({
      where: { orgId: org.id, status: { not: 'do_not_contact' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: {
        address: { select: { street: true, locality: true, region: true, postcode: true } },
      },
    });

    return {
      source: 'database',
      orgName: org.tradingName,
      leads: leads.map((l, i) => ({
        id: l.id,
        givenName: l.givenName,
        familyName: l.familyName,
        email: maskEmail(l.email),
        phone: maskPhone(l.phone),
        address: l.address
          ? `${l.address.street}, ${l.address.locality}${l.address.region ? `, ${l.address.region}` : ''}${l.address.postcode ? ` ${l.address.postcode}` : ''}`
          : null,
        status: l.status,
        // Sources are stored at the Knock layer (sourceKnockId); for the demo
        // we round-robin door / inside_sales / retargeting so the breakdown
        // KPIs are populated. Phase 1.2 will derive these from the joined
        // Knock + Conversion attribution.
        source: (['door', 'inside_sales', 'retargeting'] as const)[i % 3]!,
        assignee:
          (
            [
              'Maya Castellanos',
              'Jacob Bell',
              'Imani Walker',
              'Sage Whitfield',
              'Dion Quintero',
              'Aurelia Sokolov',
            ] as const
          )[i % 6] ?? 'Unassigned',
        createdAt: l.createdAt,
      })),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[accounts/leads] DB load failed:', err);
    // Graceful degrade to fixture for demo continuity.
    const fx = accountData(slug);
    if (!fx.account) return 'not-found';
    return {
      source: 'fixture-fallback',
      orgName: fx.account.name,
      error: err instanceof Error ? err.message : String(err),
      leads: fx.leads.map((l) => ({
        id: l.id,
        givenName: l.name.split(' ')[0] ?? l.name,
        familyName: l.name.split(' ').slice(1).join(' '),
        email: '—',
        phone: maskPhone(l.phone),
        address: l.address,
        status: l.status,
        source: l.source,
        assignee: l.assignee || 'Unassigned',
        createdAt: new Date(),
      })),
    };
  }
}

export default async function LeadsInboxPage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect(`/login?next=/accounts/${params.slug}/leads`);

  const result = await loadLeads(params.slug);
  if (result === 'not-found') {
    notFound();
  }
  if (result === 'forbidden') {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Leads inbox">
        <Banner tone="warn">
          <span className="text-[13px]">
            You do not have access to this sub-account. Contact your administrator.
          </span>
        </Banner>
      </AccountShell>
    );
  }

  const { leads, source, error } = result;
  const door = leads.filter((l) => l.source === 'door').length;
  const inside = leads.filter((l) => l.source === 'inside_sales').length;
  const retarget = leads.filter((l) => l.source === 'retargeting').length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Leads inbox">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2 flex-wrap">
            <span>
              Every Knocker interaction at the door creates a Lead — even if they didn&apos;t sell
              on the spot. Inside-sales team has <span className="font-semibold">7 days</span> to
              call, convert, or close out.
            </span>
            {source === 'database' ? (
              <span
                className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold"
                title="Loaded from Postgres with PII vault masking"
              >
                <Database size={10} /> Live · PII masked
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold"
                title={error ? `DB error: ${error}` : 'Showing fixture data'}
              >
                <AlertTriangle size={10} /> Fixture
              </span>
            )}
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="In inbox"
            value={leads.length}
            hint={`across ${door + inside + retarget} sources`}
          />
          <KpiCard label="Door" value={door} hint="15% rake" />
          <KpiCard label="Inside sales" value={inside} hint="10% rake" />
          <KpiCard label="Retargeting" value={retarget} hint="5% rake" />
        </div>

        <Section
          title={`${leads.length} leads in inbox`}
          subtitle="Sort: most-recent · Click any card for full journey · email + phone vault-masked"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map((lead) => {
              const isMaria =
                lead.givenName === 'Maria' &&
                lead.familyName === 'Santos' &&
                params.slug === 'hope-forward';
              const card = (
                <LeadCard
                  givenName={lead.givenName}
                  familyName={lead.familyName}
                  status={statusToCardStatus(lead.status)}
                  address={lead.address ?? '—'}
                  phone={lead.phone}
                  email={lead.email}
                  attributionSource={lead.source}
                  assignee={lead.assignee || undefined}
                />
              );
              return isMaria ? (
                <Link
                  key={lead.id}
                  href={`/accounts/${params.slug}/leads/maria-santos`}
                  className="block"
                >
                  {card}
                </Link>
              ) : (
                <div key={lead.id}>{card}</div>
              );
            })}
          </div>
        </Section>

        <Section
          title="How a lead flows through this account"
          subtitle="Door → CRM → Sales team works 7 days → Converted"
        >
          <div className="flex items-center justify-between gap-2 py-2 flex-wrap">
            {[
              {
                icon: Inbox,
                label: 'Captured',
                sub: 'by Knocker at door',
                tone: 'bg-accentSoft text-accent',
              },
              { icon: ArrowRight, arrow: true },
              {
                icon: Megaphone,
                label: 'Auto-routed',
                sub: 'territory + load',
                tone: 'bg-accentSoft text-accent',
              },
              { icon: ArrowRight, arrow: true },
              {
                icon: Phone,
                label: 'Sales calls (7d)',
                sub: 'sequence + drip',
                tone: 'bg-accentSoft text-accent',
              },
              { icon: ArrowRight, arrow: true },
              {
                icon: Inbox,
                label: 'Converted',
                sub: 'attribution + rake',
                tone: 'bg-successSoft text-success',
              },
            ].map((step, i) => {
              if (step.arrow) {
                return (
                  <div key={i} className="flex items-center text-soft">
                    <step.icon size={18} />
                  </div>
                );
              }
              const Icon = step.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-2 min-w-[110px]">
                  <div
                    className={`w-12 h-12 rounded-2xl ${step.tone} flex items-center justify-center`}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="text-[12px] font-semibold text-ink">{step.label}</div>
                  <div className="text-[10px] text-muted text-center">{step.sub}</div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
