'use client';

import { useState } from 'react';
import { PartnerShell } from '@/components/PartnerShell';
import { Section, StatusPill } from '@d2d/ui-web';
import { Check, Copy, RefreshCw } from 'lucide-react';

interface SsoState {
  provider: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  status: 'configured' | 'pending' | 'not_configured';
}

const SP_METADATA = {
  entityId: 'https://partner.door2digital.io/saml/pilot-charlie',
  acsUrl: 'https://partner.door2digital.io/saml/pilot-charlie/acs',
  metadataUrl: 'https://partner.door2digital.io/saml/pilot-charlie/metadata.xml',
};

export default function SsoPage() {
  const [sso, setSso] = useState<SsoState>({
    provider: 'okta',
    entityId: 'https://pilotcharlie.okta.com',
    ssoUrl: 'https://pilotcharlie.okta.com/app/d2d/exk1234567890/sso/saml',
    certificate:
      '-----BEGIN CERTIFICATE-----\nMIICpDCC...(truncated)...\n-----END CERTIFICATE-----',
    status: 'configured',
  });
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <PartnerShell pageTitle="SSO / SAML">
      <div className="space-y-6 max-w-2xl">
        <Section title="Current status">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">SAML 2.0 single sign-on</div>
              <div className="text-xs text-muted mt-0.5">
                {sso.status === 'configured'
                  ? `Configured — ${sso.provider === 'okta' ? 'Okta' : sso.provider}`
                  : 'Not configured'}
              </div>
            </div>
            <StatusPill tone={sso.status === 'configured' ? 'success' : 'muted'}>
              {sso.status === 'configured' ? 'Active' : 'Inactive'}
            </StatusPill>
          </div>
        </Section>

        <Section title="Your service-provider details (give these to your IT admin)">
          <div className="space-y-3 text-sm">
            {[
              { label: 'SP Entity ID', value: SP_METADATA.entityId, key: 'entityId' },
              { label: 'ACS URL', value: SP_METADATA.acsUrl, key: 'acsUrl' },
              { label: 'Metadata URL', value: SP_METADATA.metadataUrl, key: 'metadataUrl' },
            ].map((item) => (
              <div key={item.key}>
                <div className="text-xs text-muted mb-1">{item.label}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 mono text-xs bg-surface border border-line rounded-lg px-3 py-2 truncate">
                    {item.value}
                  </div>
                  <button
                    className="p-2 rounded-lg border border-line hover:border-accent transition-colors"
                    onClick={() => copy(item.value, item.key)}
                  >
                    {copied === item.key ? (
                      <Check size={13} className="text-success" />
                    ) : (
                      <Copy size={13} className="text-muted" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            Download the SP metadata XML from the Metadata URL above and import it into your IdP
            (Okta / Azure AD / Google Workspace) to auto-populate these values.
          </p>
        </Section>

        <Section title="IdP configuration">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Identity provider</label>
              <select
                className="input w-full"
                value={sso.provider}
                onChange={(e) => setSso({ ...sso, provider: e.target.value })}
              >
                <option value="okta">Okta</option>
                <option value="azuread">Azure AD / Entra ID</option>
                <option value="google_workspace">Google Workspace</option>
                <option value="auth0">Auth0</option>
                <option value="generic_saml">Generic SAML 2.0</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">IdP Entity ID</label>
              <input
                className="input w-full mono text-sm"
                value={sso.entityId}
                onChange={(e) => setSso({ ...sso, entityId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                SSO URL (IdP single sign-on URL)
              </label>
              <input
                className="input w-full mono text-sm"
                value={sso.ssoUrl}
                onChange={(e) => setSso({ ...sso, ssoUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Signing certificate (X.509 PEM)
              </label>
              <textarea
                className="input w-full mono text-xs h-28"
                value={sso.certificate}
                onChange={(e) => setSso({ ...sso, certificate: e.target.value })}
              />
              <p className="text-xs text-muted mt-1">
                Paste the full certificate from your IdP. Stored encrypted at rest.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Attribute mapping">
          <div className="card p-4 text-sm space-y-3">
            <p className="text-muted text-xs">
              D2D expects the following SAML attributes. Configure your IdP to send them in the
              assertion. Attribute names are case-sensitive.
            </p>
            <div className="tbl-wrapper">
              <table className="tbl text-xs">
                <thead>
                  <tr>
                    <th>D2D attribute</th>
                    <th>Expected SAML attribute name</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { d2d: 'email', saml: 'email', required: true },
                    { d2d: 'givenName', saml: 'firstName', required: true },
                    { d2d: 'familyName', saml: 'lastName', required: true },
                    { d2d: 'role', saml: 'd2d_role', required: false },
                  ].map((row) => (
                    <tr key={row.d2d}>
                      <td className="mono">{row.d2d}</td>
                      <td className="mono">{row.saml}</td>
                      <td>
                        <StatusPill tone={row.required ? 'warn' : 'muted'}>
                          {row.required ? 'Required' : 'Optional'}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              If <span className="mono">d2d_role</span> is omitted, new users are provisioned as{' '}
              <span className="mono">viewer</span>. Valid values:{' '}
              <span className="mono">org_admin, manager, inside_sales, accountant, viewer</span>.
            </p>
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-success text-white' : 'bg-accent text-white hover:bg-accent/90'}`}
          >
            {saved ? (
              <>
                <Check size={14} /> Saved
              </>
            ) : (
              'Save SSO config'
            )}
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-line hover:border-accent transition-colors"
            onClick={() => alert('Test SSO flow — opens IdP redirect in new tab')}
          >
            <RefreshCw size={13} />
            Test SSO
          </button>
        </div>
      </div>
    </PartnerShell>
  );
}
