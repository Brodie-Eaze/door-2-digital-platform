import { redirect } from 'next/navigation';
import { db } from '@d2d/database';
import { Banner, EmptyState, KpiCard, Money } from '@d2d/ui-web';
import type { AttributionSource } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { maskEmail } from '@/lib/db-helpers';
import { ConversionsLedger } from './ConversionsLedger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConversionsPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const params = await paramsPromise;

  const org = await db.org.findUnique({
    where: { slug: params.slug },
    select: { id: true, tradingName: true, legalName: true, regionCode: true },
  });
  if (!org) redirect('/accounts');

  const region = org.regionCode === 'AU' ? 'AU' : 'US';

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const mtdStart = new Date();
  mtdStart.setUTCDate(1);
  mtdStart.setUTCHours(0, 0, 0, 0);

  const [conversionsToday, conversionsWeek, mtdAgg, recentConversions] = await Promise.all([
    db.conversion.count({ where: { orgId: org.id, signedAt: { gte: todayStart } } }),
    db.conversion.count({ where: { orgId: org.id, signedAt: { gte: sevenDaysAgo } } }),
    db.conversion.aggregate({
      where: { orgId: org.id, signedAt: { gte: mtdStart } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    db.conversion.findMany({
      where: { orgId: org.id },
      orderBy: { signedAt: 'desc' },
      take: 60,
      select: {
        id: true,
        amountCents: true,
        signedAt: true,
        attributionSource: true,
        paymentExternalId: true,
        knockerId: true,
        lead: { select: { givenName: true, familyName: true, email: true } },
        donation: { select: { frequency: true } },
        knock: { select: { territory: { select: { name: true } } } },
      },
    }),
  ]);

  const conversionsMTD = mtdAgg._count._all;
  const revenueCentsMTD = mtdAgg._sum.amountCents ?? 0n;

  if (conversionsMTD === 0 && recentConversions.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Conversions">
        <div className="space-y-5 max-w-[1400px]">
          {/* Server component → client EmptyState: omit the icon prop, a
              function reference isn't serialisable across the RSC boundary. */}
          <EmptyState
            title="No conversions yet."
            description="Every door, call, and retarget click that lands a sale shows up here with full attribution: which knocker, which campaign, which ticket size. The first one usually lands inside 90 minutes of the first shift."
            primaryAction={{
              label: 'Onboard knockers',
              href: `/accounts/${params.slug}/knockers`,
            }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }

  const doorCount = recentConversions.filter((c) => c.attributionSource === 'door').length;
  const insideCount = recentConversions.filter(
    (c) => c.attributionSource === 'inside_sales',
  ).length;
  const retargCount = recentConversions.filter((c) => c.attributionSource === 'retargeting').length;
  const ledgerTotal = recentConversions.reduce((s, c) => s + c.amountCents, 0n);

  const knockerIds = [
    ...new Set(recentConversions.map((c) => c.knockerId).filter(Boolean)),
  ] as string[];
  const knockerUsers =
    knockerIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: knockerIds } },
          select: { id: true, givenName: true, familyName: true },
        })
      : [];
  const knockerMap = new Map(knockerUsers.map((u) => [u.id, u]));

  const ledgerRows = recentConversions.map((c) => {
    const rep = c.knockerId ? knockerMap.get(c.knockerId) : undefined;
    const repInitials = rep
      ? `${rep.givenName.charAt(0)}${rep.familyName.charAt(0) ?? ''}`.toUpperCase()
      : '—';
    // PII-first: given name kept, family name reduced to an initial — mirrors
    // the leads inbox + knockers list masking convention.
    const donorName = c.lead
      ? `${c.lead.givenName}${c.lead.familyName ? ` ${c.lead.familyName.charAt(0)}.` : ''}`.trim()
      : 'Lead';
    const frequency: 'monthly' | 'quarterly' | 'annual' | 'one-off' = c.donation
      ? c.donation.frequency === 'annual'
        ? 'annual'
        : 'monthly' // weekly/fortnightly/monthly all bucket to "monthly" cadence
      : 'one-off';

    return {
      id: c.id,
      capturedAt: c.signedAt.toISOString(),
      donorName,
      donorEmailMasked: maskEmail(c.lead?.email),
      amountCents: c.amountCents,
      frequency,
      attribution: c.attributionSource as AttributionSource,
      repInitials,
      territory: c.knock?.territory?.name ?? '—',
      // ponytail: Conversion has no explicit clearance-status column — a
      // recorded paymentExternalId is the closest honest proxy for "cleared".
      // Upgrade to a real settlement-status field if/when one lands.
      paymentStatus: c.paymentExternalId ? 'cleared' : 'pending',
    };
  });

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Conversions">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Conversion ledger for <span className="font-semibold">{org.tradingName}</span> · every
            captured pledge, donation, or contract scored by attribution (door / inside /
            retargeting). Payments cleared via{' '}
            {region === 'AU' ? 'Stripe AU + GoCardless NPP' : 'MiCamp'}.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Conv · today" value={conversionsToday.toLocaleString()} />
          <KpiCard label="Conv · 7d" value={conversionsWeek.toLocaleString()} />
          <KpiCard label="Conv · MTD" value={conversionsMTD.toLocaleString()} />
          <KpiCard
            label="Revenue · MTD"
            value={<Money cents={revenueCentsMTD} region={region} />}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Door" value={doorCount} hint="recent 60" />
          <KpiCard label="Inside sales" value={insideCount} hint="recent 60" />
          <KpiCard label="Retargeting" value={retargCount} hint="recent 60" />
        </div>

        <ConversionsLedger rows={ledgerRows} region={region} ledgerTotalCents={ledgerTotal} />
      </div>
    </AccountShell>
  );
}
