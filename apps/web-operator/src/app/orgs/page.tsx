import Link from 'next/link';
import { ChevronRight, Building2 } from 'lucide-react';
import { Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { ORGS } from '@/lib/fixtures';

export default function OrgsPage(): JSX.Element {
  return (
    <OperatorShell pageTitle="Client orgs">
      <div className="space-y-6 max-w-[1280px]">
        <Section
          title={`${ORGS.length} client orgs`}
          subtitle="Pilot-Charlie launches Sept 15. Two adjacent trials onboarded for product validation."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Vertical</th>
                <th>Region</th>
                <th>Plan</th>
                <th>Knockers</th>
                <th>MTD conv.</th>
                <th>MTD revenue</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ORGS.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center">
                        <Building2 size={14} className="text-ink" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">{o.name}</div>
                        <div className="text-[11px] text-muted truncate">{o.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] capitalize text-muted">{o.vertical}</td>
                  <td>
                    <RegionBadge region={o.region as 'US' | 'AU' | 'SG'} />
                  </td>
                  <td>
                    <span className="tag">{o.plan}</span>
                  </td>
                  <td className="numeric text-[13px]">{o.knockers}</td>
                  <td className="numeric text-[13px]">{o.conversionsMTD.toLocaleString()}</td>
                  <td>
                    <Money cents={o.revenueCentsMTD} region="US" />
                  </td>
                  <td>
                    <StatusPill tone={o.health === 'healthy' ? 'success' : 'warn'}>
                      {o.health === 'healthy' ? 'Healthy' : 'Attention'}
                    </StatusPill>
                  </td>
                  <td className="text-right">
                    {o.slug === 'pilot-charlie' && (
                      <Link
                        href={`/orgs/${o.slug}`}
                        className="text-soft hover:text-ink transition inline-flex items-center"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </OperatorShell>
  );
}
