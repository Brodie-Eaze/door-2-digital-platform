import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Banner, Button, KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { ACCOUNTS } from '@/lib/accounts';

export default function AccountsPage(): JSX.Element {
  const totalNoctuas = ACCOUNTS.reduce((s, a) => s + a.noctuas, 0);
  const totalLeads = ACCOUNTS.reduce((s, a) => s + a.leadsInboxToday, 0);
  const totalConversions = ACCOUNTS.reduce((s, a) => s + a.conversionsMTD, 0);
  const totalRevenue = ACCOUNTS.reduce((s, a) => s + a.revenueCentsMTD, 0n);

  return (
    <PlatformShell pageTitle="Accounts">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">NoctuaOS HQ</span> — your team's home. Click any account
            to drop into its full CRM workspace (territories, Noctuas, leads, pipeline, campaigns,
            drip). Each account is a tiny operating system inside the one.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Accounts" value={ACCOUNTS.length} hint="charity + commercial" />
          <KpiCard
            label="Noctuas active"
            value={totalNoctuas}
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
          subtitle="Each account is fully isolated — own territories, Noctuas, leads, pipeline, compliance"
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
                  <div className="w-14 h-14 rounded-xl bg-paper border border-line2 flex items-center justify-center text-2xl shrink-0">
                    {a.logo}
                  </div>
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
                  <Stat label="Noctuas" value={a.noctuas.toString()} />
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
                <th>Noctuas</th>
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
                      className="text-[13px] text-ink hover:text-accent font-medium"
                    >
                      {a.logo} {a.name}
                    </Link>
                  </td>
                  <td className="text-[12px] text-muted capitalize">{a.vertical}</td>
                  <td>
                    <RegionBadge region={a.region} />
                  </td>
                  <td className="numeric text-[13px]">{a.noctuas}</td>
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
