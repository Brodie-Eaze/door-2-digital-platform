import { Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { BRAND_KIT } from '@/lib/portal-data';

/** A labelled hex swatch. Inline style is the only honest render of an
 *  arbitrary brand colour pulled from data. */
function Swatch({ label, hex }: { label: string; hex: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-10 w-10 rounded-lg border border-line shrink-0"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="text-[12px] text-muted mono uppercase">{hex}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="h-section">{label}</div>
      <div className="mt-1 text-[13px] text-ink">{children}</div>
    </div>
  );
}

export default function BrandKitPage(): JSX.Element {
  const b = BRAND_KIT;

  return (
    <PortalShell pageTitle="Brand kit">
      <div className="space-y-6 max-w-[1100px]">
        <p className="text-[13px] text-muted leading-relaxed max-w-[760px]">
          The white-label brand applied to the field app, donor-facing pages, and email D2D sends on{' '}
          {b.displayName}&rsquo;s behalf. Changes here are reviewed by the D2D operator team before
          the next mobile build, so the app stores always carry an approved identity.
        </p>

        <Section
          title="Identity"
          subtitle="Display name and the two brand colours used across surfaces."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Display name">{b.displayName}</Field>
            <Swatch label="Primary" hex={b.primaryColor} />
            <Swatch label="Accent" hex={b.accentColor} />
          </div>
        </Section>

        <Section
          title="Custom domain"
          subtitle="Donor-facing pages are served from the client's own subdomain."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-medium text-ink mono">{b.customDomain}</div>
              <div className="mt-1 text-[12px] text-muted">
                CNAME verified against the D2D edge; TLS issued automatically.
              </div>
            </div>
            <StatusPill tone={b.domainVerified ? 'success' : 'warn'}>
              {b.domainVerified ? 'Verified' : 'Pending verification'}
            </StatusPill>
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Support contacts"
            subtitle="Shown to donors in receipts and the field app."
          >
            <div className="space-y-4">
              <Field label="Support email">
                <span className="mono">{b.supportEmail}</span>
              </Field>
              <Field label="Support phone">
                <span className="mono">{b.supportPhone}</span>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Privacy policy">
                  <a href={b.privacyPolicyUrl} className="text-accent hover:underline break-all">
                    {b.privacyPolicyUrl.replace(/^https?:\/\//, '')}
                  </a>
                </Field>
                <Field label="Terms">
                  <a href={b.termsUrl} className="text-accent hover:underline break-all">
                    {b.termsUrl.replace(/^https?:\/\//, '')}
                  </a>
                </Field>
              </div>
            </div>
          </Section>

          <Section
            title="Mobile identifiers"
            subtitle="Bundle IDs the white-label field app ships under."
          >
            <div className="space-y-4">
              <Field label="iOS bundle ID">
                <span className="mono">{b.iosBundleId}</span>
              </Field>
              <Field label="Android package">
                <span className="mono">{b.androidPackage}</span>
              </Field>
              <p className="text-[11px] text-muted leading-relaxed">
                Phase 1 distribution is TestFlight + Play Internal under D2D&rsquo;s developer
                accounts. Public store submission uses these identifiers when the engagement opts
                in.
              </p>
            </div>
          </Section>
        </div>

        <Section
          title="Brand assets"
          subtitle="Logos and icons baked into the build. Replacements are picked up at the next release."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Spec</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {b.assets.map((a) => (
                <tr key={a.label}>
                  <td className="font-medium text-ink">{a.label}</td>
                  <td className="text-muted">{a.spec}</td>
                  <td className="text-right">
                    <StatusPill tone={a.status === 'uploaded' ? 'success' : 'warn'}>
                      {a.status === 'uploaded' ? 'Uploaded' : 'Missing'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </PortalShell>
  );
}
