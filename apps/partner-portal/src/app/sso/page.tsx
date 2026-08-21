import { Banner, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { CopyField } from '@/components/CopyField';
import { SSO_CONFIG, fmtDate } from '@/lib/portal-data';

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="h-section">{label}</div>
      <div className="mt-1 text-[13px] text-ink break-all">{children}</div>
    </div>
  );
}

export default function SsoPage(): JSX.Element {
  const s = SSO_CONFIG;
  const configured = s.status === 'configured';

  return (
    <PortalShell pageTitle="SSO / SAML">
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
            {configured ? `Federated via ${s.provider}.` : 'SSO is not yet configured.'}
          </span>{' '}
          <span className="text-ink2">
            {configured
              ? `Users sign in through ${s.provider}; D2D never holds their password. Last validated ${fmtDate(
                  s.lastValidatedAt,
                )}.`
              : 'Share the service-provider metadata below with your IdP administrator to begin.'}
          </span>
        </Banner>

        <Section
          title="Service provider metadata"
          subtitle="D2D is the SAML service provider. Paste these values into your identity provider when configuring the application."
        >
          <div className="space-y-4">
            <CopyField label="SP entity ID (audience)" value={s.spEntityId} />
            <CopyField label="Assertion consumer service (ACS) URL" value={s.spAcsUrl} />
            <CopyField label="SP metadata URL" value={s.spMetadataUrl} />
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Identity provider"
            subtitle={`The ${s.provider} endpoints D2D federates against.`}
          >
            <div className="space-y-4">
              <Field label="IdP entity ID">
                <span className="mono text-[12px]">{s.idpEntityId}</span>
              </Field>
              <Field label="IdP SSO URL">
                <span className="mono text-[12px]">{s.idpSsoUrl}</span>
              </Field>
            </div>
          </Section>

          <Section
            title="Signing certificate"
            subtitle="Used to verify SAML assertions from the IdP."
          >
            <div className="space-y-4">
              <Field label="SHA-1 thumbprint">
                <span className="mono text-[12px]">{s.certThumbprint}</span>
              </Field>
              <div className="flex items-center justify-between gap-3">
                <Field label="Expires">{fmtDate(s.certExpiresAt)}</Field>
                <StatusPill tone="success">Valid</StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink2">Just-in-time provisioning</span>
                <StatusPill tone={s.jitProvisioning ? 'success' : 'muted'}>
                  {s.jitProvisioning ? 'Enabled' : 'Disabled'}
                </StatusPill>
              </div>
            </div>
          </Section>
        </div>

        <Section
          title="Attribute mapping"
          subtitle="SAML assertion claims D2D reads from each sign-in."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>D2D field</th>
                <th>SAML attribute</th>
              </tr>
            </thead>
            <tbody>
              {s.attributeMapping.map((m) => (
                <tr key={m.claim}>
                  <td className="font-medium text-ink">{m.claim}</td>
                  <td className="mono text-[12px] text-ink2">{m.samlAttribute}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Role mapping"
          subtitle="IdP groups map to D2D platform roles. A user's group on sign-in sets their access."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>IdP group</th>
                <th>D2D role</th>
              </tr>
            </thead>
            <tbody>
              {s.roleMapping.map((m) => (
                <tr key={m.idpGroup}>
                  <td className="mono text-[12px] text-ink2">{m.idpGroup}</td>
                  <td>
                    <span className="tag">{m.platformRole}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <p className="text-[11px] text-muted leading-relaxed max-w-[760px]">
          Changes to SSO configuration are made by the D2D operator team after a validation
          handshake with your IdP. To rotate the signing certificate or update group mappings,
          contact your account manager — the change is logged to the audit trail and takes effect on
          the next sign-in.
        </p>
      </div>
    </PortalShell>
  );
}
