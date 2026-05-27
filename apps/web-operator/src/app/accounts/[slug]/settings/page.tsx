import { Plug, Settings as SettingsIcon } from 'lucide-react';
import { Banner, EmptyState, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

export default function SettingsPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  if (!account) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Settings">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <EmptyState
            icon={SettingsIcon}
            title="Account profile is pending."
            description="Settings for this workspace appear once the onboard-account flow finishes provisioning the org row and brand kit. Refresh if you just finished onboarding."
            primaryAction={{ label: 'Open accounts list', href: '/accounts' }}
            secondaryAction={{ label: 'Onboard new account', href: '/onboard-account' }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Settings">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Account-scoped settings for <span className="font-semibold">{account.name}</span>.
            Changes audit-logged + pushed to apps within 60s.
          </span>
        </Banner>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Account profile">
            <div className="space-y-3 text-[13px]">
              <Field label="Legal name" value={account.name} />
              <Field label="Trading name" value={account.shortName} />
              <Field label="Vertical" value={account.vertical} />
              <Field
                label="Region"
                value={`${account.region} · ${account.region === 'AU' ? 'ap-southeast-2' : account.region === 'SG' ? 'ap-southeast-1' : 'us-east-1'}`}
              />
              <Field label="EIN / ABN / UEN" value="83-2461037" />
              <Field label="Contracted" value={account.contractedAt} />
              <Field label="Status" value={<StatusPill tone="success">Active</StatusPill>} />
            </div>
          </Section>

          <Section title="Branding" subtitle="White-label config pushed to Knocker iOS + portal">
            <div className="space-y-3 text-[13px]">
              <Field
                label="Primary colour"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ background: account.avatarBg }} />{' '}
                    {account.avatarBg}
                  </span>
                }
              />
              <Field label="Logo (light)" value="logos/hf-light.svg · 12 KB" />
              <Field label="Logo (dark)" value="logos/hf-dark.svg · 11 KB" />
              <Field label="iOS app icon" value="app-icons/hf-1024.png · 84 KB" />
              <Field label="Custom domain" value="app.hopeforward.org" />
              <Field
                label="Knocker iOS bundle"
                value={<code className="kbd">org.hopeforward.knocker</code>}
              />
            </div>
          </Section>

          <Section title="Payments" subtitle="Processor + currency + rake settings">
            <div className="space-y-3 text-[13px]">
              <Field label="Processor" value="MiCamp Gateway (US ISO)" />
              <Field
                label="Currency"
                value={account.region === 'AU' ? 'AUD' : account.region === 'SG' ? 'SGD' : 'USD'}
              />
              <Field label="Platform fee" value="$2,500/mo" />
              <Field label="Door rake" value="15%" />
              <Field label="Inside-sales rake" value="10%" />
              <Field label="Retargeting rake" value="5%" />
              <Field label="Payout cadence" value="Fortnightly" />
            </div>
          </Section>

          <Section title="Integrations" subtitle="Active connections to this account">
            <div className="space-y-2">
              {[
                { name: 'MiCamp Gateway', status: 'connected', detail: 'Cards · ACH · recurring' },
                {
                  name: 'Aircall',
                  status: 'connected',
                  detail: 'Inside-sales dialer · call recording',
                },
                { name: 'Twilio', status: 'connected', detail: 'SMS + voice · US long codes' },
                { name: 'Resend', status: 'connected', detail: 'Transactional + marketing email' },
                {
                  name: 'Meta Marketing API',
                  status: 'connected',
                  detail: 'Custom audiences + ads',
                },
                { name: 'Google Ads', status: 'connected', detail: 'Customer match + RLSA' },
                { name: 'TikTok Marketing', status: 'pending', detail: 'OAuth pending IT review' },
                { name: 'Okta SAML', status: 'connected', detail: 'SSO for org admins' },
              ].map((i) => (
                <div
                  key={i.name}
                  className="flex items-center justify-between p-2.5 bg-paper rounded-lg border border-line2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Plug size={13} className="text-soft shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-ink truncate">{i.name}</div>
                      <div className="text-[10px] text-muted truncate">{i.detail}</div>
                    </div>
                  </div>
                  <StatusPill tone={i.status === 'connected' ? 'success' : 'warn'}>
                    {i.status}
                  </StatusPill>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Security & compliance">
            <div className="space-y-3 text-[13px]">
              <Field
                label="SSO/SAML"
                value={<StatusPill tone="success">Active · Okta</StatusPill>}
              />
              <Field
                label="WebAuthn for admins"
                value={<StatusPill tone="success">Required</StatusPill>}
              />
              <Field
                label="SOC 2 Type I"
                value={<StatusPill tone="info">Evidence collection</StatusPill>}
              />
              <Field
                label="Audit chain integrity"
                value={<StatusPill tone="success">100% (14m ago)</StatusPill>}
              />
              <Field label="Data residency" value={`${account.region} only · enforced`} />
              <Field label="DR · RPO / RTO" value="5min / 1h" />
            </div>
          </Section>

          <Section title="Notifications" subtitle="Per-event channel preferences">
            <div className="space-y-2 text-[13px]">
              {[
                { event: 'Knocker idle > 15min', sms: true, email: false, push: true },
                { event: 'Conversion captured', sms: false, email: true, push: true },
                { event: 'AI anomaly detected', sms: true, email: true, push: true },
                { event: 'Daily summary', sms: false, email: true, push: false },
                { event: 'Compliance state cleared', sms: false, email: true, push: false },
              ].map((n) => (
                <div
                  key={n.event}
                  className="flex items-center justify-between p-2 border-b border-line2 last:border-b-0"
                >
                  <span className="text-ink">{n.event}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${n.sms ? 'bg-success/20 text-success' : 'bg-line2 text-soft'}`}
                    >
                      SMS
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${n.email ? 'bg-success/20 text-success' : 'bg-line2 text-soft'}`}
                    >
                      EMAIL
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${n.push ? 'bg-success/20 text-success' : 'bg-line2 text-soft'}`}
                    >
                      PUSH
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </AccountShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
