import { Banner, Section } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { getSession } from '@/lib/api';

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="h-section">{label}</div>
      <div className="mt-1 text-[13px] text-ink">{children}</div>
    </div>
  );
}

export default async function BrandKitPage(): Promise<JSX.Element> {
  const { user, org } = await getSession();

  return (
    <PortalShell
      pageTitle="Brand kit"
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="space-y-6 max-w-[1100px]">
        <p className="text-[13px] text-muted leading-relaxed max-w-[760px]">
          The white-label brand applied to the field app, donor-facing pages, and email D2D sends on{' '}
          {org.tradingName}&rsquo;s behalf. Changes here are reviewed by the D2D operator team
          before the next mobile build, so the app stores always carry an approved identity.
        </p>

        <Section title="Identity" subtitle="What this portal can confirm from your org record.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Legal name">{org.legalName}</Field>
            <Field label="Display name">{org.tradingName}</Field>
          </div>
        </Section>

        <Banner tone="info">
          <span className="font-medium text-ink">
            Colors, custom domain, support contacts, mobile bundle IDs, and brand assets are managed
            by your D2D account manager.
          </span>{' '}
          <span className="text-ink2">
            Self-serve read access to the full brand kit isn&rsquo;t wired up yet — contact your
            account manager to review or update these values, and they&rsquo;ll appear here once
            that endpoint ships.
          </span>
        </Banner>
      </div>
    </PortalShell>
  );
}
