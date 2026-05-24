import { Smartphone, Apple } from 'lucide-react';
import { Banner, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { getAccount } from '@/lib/accounts';

export default function KnockerIOSPreviewPage({
  params,
}: {
  params: { slug: string };
}): JSX.Element {
  const account = getAccount(params.slug);
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Knocker iOS · Preview">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Web preview of the native <span className="font-semibold">Knocker iOS</span> app,
            white-labelled for <span className="font-semibold">{account?.shortName}</span>.
            Distributed to your reps via TestFlight + Internal Track.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="iPads provisioned" value="218" sub="all clocked in" />
          <Stat label="App version" value="1.0.4" sub="rolled out 4d ago" />
          <Stat label="Avg sync latency" value="247ms" sub="P95: 480ms" />
          <Stat label="Crash-free rate" value="99.7%" sub="last 7d" />
        </div>

        <Section title="What your reps see" subtitle="Click below to view the 10 in-app screens">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/mobile-preview"
              target="_blank"
              rel="noopener noreferrer"
              className="card card-pad hover:shadow-md transition cursor-pointer flex items-start gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-ink text-surface flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">Open all 10 mock screens</div>
                <div className="text-[11px] text-muted mt-1">
                  Login · Map (satellite) · Knock sheet · Lead form · Signature · Photo · Schedule ·
                  Inbox · Pitch script · Me/leaderboard
                </div>
              </div>
            </a>
            <div className="card card-pad">
              <div className="flex items-center gap-2 mb-3">
                <Apple size={14} />{' '}
                <span className="text-[13px] font-semibold text-ink">App distribution</span>
              </div>
              <div className="space-y-2 text-[12px]">
                <Row
                  label="Deployment"
                  value={<StatusPill tone="success">TestFlight</StatusPill>}
                />
                <Row label="Bundle ID" value={<code className="kbd">io.d2d.knocker</code>} />
                <Row label="Min iOS version" value="17.0" />
                <Row label="Auto-update" value="Enabled · OTA" />
                <Row label="Crash reporting" value="Sentry" />
                <Row label="Telemetry" value="OpenTelemetry → DD" />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="App config — pushed to every iPad in this account"
          subtitle="Changes here sync within 60 seconds via APNs silent push"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Pitch script', value: 'Q3 2026 v3.2', updated: '2d ago' },
              {
                name: 'Disposition wheel order',
                value: 'SALE · LEAD · NOT_HOME · CALLBACK · REFUSED · DNC',
                updated: '12d ago',
              },
              { name: 'Required photo on SALE', value: 'Yes', updated: 'always' },
              { name: 'Required signature on SALE', value: 'Yes', updated: 'always' },
              { name: 'Offline queue size', value: 'up to 500 knocks', updated: 'config' },
              { name: 'Shift hours', value: '09:00–17:00 local', updated: '5d ago' },
            ].map((c) => (
              <div key={c.name} className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">{c.name}</div>
                <div className="text-[13px] font-semibold text-ink mt-1">{c.value}</div>
                <div className="text-[10px] text-soft mt-1">Updated {c.updated}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card card-pad">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[18px] font-semibold text-ink mt-1 numeric">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
