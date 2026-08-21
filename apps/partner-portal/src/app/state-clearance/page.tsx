import { Banner, EmptyState, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { clearanceLabel, clearanceTone } from '@/lib/status';
import { apiFetch, getSession, type StateClearanceCell } from '@/lib/api';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const ORDER: Record<StateClearanceCell['status'], number> = {
  cleared: 0,
  pending_registration: 1,
  expired: 2,
};

export default async function StateClearancePage(): Promise<JSX.Element> {
  const { user, org } = await getSession();
  const { data } = await apiFetch<{ data: StateClearanceCell[] }>('/compliance/state-clearance');

  const counts = data.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { cleared: 0, expired: 0, pending_registration: 0 } as Record<
      StateClearanceCell['status'],
      number
    >,
  );
  const rows = [...data].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.state.localeCompare(b.state),
  );

  return (
    <PortalShell
      pageTitle="State clearance"
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="font-medium text-ink">Campaigns deliver only to approved states.</span>{' '}
          <span className="text-ink2">
            D2D registers as a paid solicitor in each state on the client&rsquo;s behalf. This gate
            is enforced in code — a campaign cannot target a state until its registration is{' '}
            <span className="font-medium">cleared</span> and unexpired.
          </span>
        </Banner>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KpiCard label="Cleared" value={counts.cleared} hint="delivering now" />
          <KpiCard label="Pending" value={counts.pending_registration} hint="registration filing" />
          <KpiCard label="Expired" value={counts.expired} hint="renewal needed" />
        </div>

        <Section
          title="Campaign × state clearance matrix"
          subtitle="One row per campaign and state your conversions can target."
          paddedBody={rows.length === 0}
        >
          {rows.length === 0 ? (
            <EmptyState
              title="No state clearances yet"
              description="Clearances appear here once D2D files and D2D's compliance team approves a paid-solicitor registration for a state your campaigns target."
            />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Cleared</th>
                  <th>Registration expires</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.campaignId}:${r.state}`}>
                    <td>
                      <span className="tag">{r.state}</span>
                    </td>
                    <td className="font-medium text-ink">{r.campaignName}</td>
                    <td>
                      <StatusPill tone={clearanceTone(r.status)}>
                        {clearanceLabel(r.status)}
                      </StatusPill>
                    </td>
                    <td className="text-muted">{fmtDate(r.clearedAt)}</td>
                    <td className="text-muted">{fmtDate(r.registrationExpiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="How the gate works"
          subtitle="The state-clearance engine is the platform's longest-pole compliance control."
        >
          <ol className="space-y-2.5 text-[13px] text-ink2">
            <li className="flex gap-3">
              <span className="tag shrink-0">1</span>
              <span>
                D2D counsel files a paid-solicitor registration for the operating entity in each
                target state — most carry a surety bond, posted up front.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tag shrink-0">2</span>
              <span>
                When the state approves the filing, the registration flips to{' '}
                <span className="font-medium">approved</span> and the state is added to the
                campaign&rsquo;s cleared set.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tag shrink-0">3</span>
              <span>
                Every delivery and conversion checks the cleared set first. An attempt to operate in
                an un-cleared or expired state is refused and written to the audit log — there is no
                manual override.
              </span>
            </li>
          </ol>
        </Section>
      </div>
    </PortalShell>
  );
}
