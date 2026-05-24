import Link from 'next/link';
import { ArrowRight, Plus, UserPlus } from 'lucide-react';
import { Banner, Button, KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { AccountAvatar } from '@/components/AccountAvatar';
import { ACCOUNTS } from '@/lib/accounts';

export default function AccountsPage(): JSX.Element {
  const totalKnockers = ACCOUNTS.reduce((s, a) => s + a.knockers, 0);
  const totalLeads = ACCOUNTS.reduce((s, a) => s + a.leadsInboxToday, 0);
  const totalRevenue = ACCOUNTS.reduce((s, a) => s + a.revenueCentsMTD, 0n);

  return (
    <PlatformShell pageTitle="Accounts">
      <div className="space-y-6 max-w-[1400px]">
        {/* Header bar with primary CTA */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[19px] font-semibold text-ink tracking-tight">
              All sub-accounts
            </div>
            <div className="text-[12px] text-muted">
              {ACCOUNTS.length} businesses live · {totalKnockers} knockers active across portfolio
            </div>
          </div>
          <Link href="/onboard-account">
            <Button variant="primary" leftIcon={<UserPlus size={14} />}>
              Onboard new business
            </Button>
          </Link>
        </div>

        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">Door 2 Digital Command Centre</span> — your team&apos;s
            home. Click any account to drop into its full CRM workspace (territories, Knockers,
            leads, pipeline, campaigns, drip). Each account is a tiny operating system inside the
            one.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Accounts" value={ACCOUNTS.length} hint="charity + commercial" />
          <KpiCard
            label="Knockers active"
            value={totalKnockers}
            delta="+18 vs yest."
            deltaTone="positive"
          />
          <KpiCard
            label="Leads today (all accts)"
            value={totalLeads}
            delta="+22%"
            deltaTone="positive"
          />
          <KpiCard
            label="MTD revenue"
            value={<Money cents={totalRevenue} region="US" />}
            delta="+18.4%"
            deltaTone="positive"
          />
        </div>

        <Section
          title="Sub-accounts"
          subtitle="Each account is fully isolated — own territories, Knockers, leads, pipeline, compliance"
          action={
            <Button leftIcon={<Plus size={14} />} variant="primary" size="sm">
              New account
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACCOUNTS.map((a) => (
              <Link
                key={a.slug}
                href={`/accounts/${a.slug}/today`}
                className="card card-pad hover:shadow-md transition group cursor-pointer block"
              >
                <div className="flex items-start gap-4">
                  <AccountAvatar account={a} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-ink truncate group-hover:text-accent transition">
                          {a.name}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">{a.notes}</div>
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-soft group-hover:text-accent transition shrink-0 mt-1"
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <RegionBadge region={a.region} />
                      <span className="tag capitalize">{a.vertical}</span>
                      <span
                        className={`pill ${
                          a.health === 'healthy'
                            ? 'pill-success'
                            : a.health === 'attention'
                              ? 'pill-warn'
                              : 'pill-danger'
                        }`}
                      >
                        {a.plan}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 pt-4 border-t border-line2">
                  <Stat label="Knockers" value={a.knockers.toString()} />
                  <Stat label="Leads today" value={a.leadsInboxToday.toString()} />
                  <Stat label="Conv. MTD" value={a.conversionsMTD.toLocaleString()} />
                  <Stat
                    label="Revenue"
                    value={
                      <Money cents={a.revenueCentsMTD} region={a.region === 'AU' ? 'AU' : 'US'} />
                    }
                  />
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Account roll-up" subtitle="Cross-account KPIs (Brodie's view)">
          <table className="tbl">
            <thead>
              <tr>
                <th>Account</th>
                <th>Vertical</th>
                <th>Region</th>
                <th>Knockers</th>
                <th>MTD Conv.</th>
                <th>MTD Revenue</th>
                <th>Projected LTV</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.map((a) => (
                <tr key={a.slug}>
                  <td>
                    <Link
                      href={`/accounts/${a.slug}/today`}
                      className="text-[13px] text-ink hover:text-accent font-medium inline-flex items-center gap-2"
                    >
                      <AccountAvatar account={a} size={24} />
                      {a.name}
                    </Link>
                  </td>
                  <td className="text-[12px] text-muted capitalize">{a.vertical}</td>
                  <td>
                    <RegionBadge region={a.region} />
                  </td>
                  <td className="numeric text-[13px]">{a.knockers}</td>
                  <td className="numeric text-[13px]">{a.conversionsMTD.toLocaleString()}</td>
                  <td>
                    <Money cents={a.revenueCentsMTD} region={a.region === 'AU' ? 'AU' : 'US'} />
                  </td>
                  <td>
                    <Money cents={a.ltvCentsMTD} region={a.region === 'AU' ? 'AU' : 'US'} />
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        a.health === 'healthy'
                          ? 'success'
                          : a.health === 'attention'
                            ? 'warn'
                            : 'danger'
                      }
                    >
                      {a.health}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </PlatformShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">{value}</div>
    </div>
  );
}
