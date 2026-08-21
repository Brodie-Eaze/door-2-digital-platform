import { Banner, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { getSession } from '@/lib/api';

export default async function SsoPage(): Promise<JSX.Element> {
  const { user, org } = await getSession();
  const configured = org.ssoProvider !== null;

  return (
    <PortalShell
      pageTitle="SSO / SAML"
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="space-y-6 max-w-[1100px]">
        <Banner
          tone={configured ? 'success' : 'warn'}
          action={
            <StatusPill tone={configured ? 'success' : 'warn'}>
              {configured ? 'Configured' : 'Not configured'}
            </StatusPill>
          }
        >
          <span className="font-medium text-ink">
            {configured
              ? `Federated via ${org.ssoProvider}.`
              : 'SSO is not yet configured for your org.'}
          </span>{' '}
          <span className="text-ink2">
            {configured
              ? `Users sign in through ${org.ssoProvider}; D2D never holds their password.`
              : 'Contact your D2D account manager to begin federating sign-in through your identity provider.'}
          </span>
        </Banner>

        <Section
          title="SAML configuration"
          subtitle="Service-provider metadata, certificate, and attribute mapping."
        >
          <div className="text-[13px] text-ink2 leading-relaxed space-y-3">
            <p>
              SSO configuration (service-provider metadata, identity-provider endpoints, signing
              certificate, and attribute / role mapping) is managed by the D2D operator team after a
              validation handshake with your identity provider. Self-serve read access for this role
              isn&rsquo;t available yet.
            </p>
            <p>
              To configure or change SSO, contact your account manager — the change is logged to the
              audit trail and takes effect on the next sign-in.
            </p>
          </div>
        </Section>
      </div>
    </PortalShell>
  );
}
