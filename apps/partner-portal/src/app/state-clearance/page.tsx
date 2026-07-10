import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { solicitorLabel, solicitorTone } from '@/lib/status';
import {
  CLIENT,
  STATE_REGISTRATIONS,
  type StateRegistration,
  fmtDate,
  stateCounts,
} from '@/lib/portal-data';

/** Sort: approved first, then submitted, pending, expired; alpha within. */
const ORDER: Record<StateRegistration['status'], number> = {
  approved: 0,
  submitted: 1,
  pending: 2,
  expired: 3,
};

export default function StateClearancePage(): JSX.Element {
  const counts = stateCounts();
  const totalBond = STATE_REGISTRATIONS.reduce((sum, r) => sum + r.bondCents, 0n);
  const rows = [...STATE_REGISTRATIONS].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );

  return (
    <PortalShell pageTitle="State clearance">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="font-medium text-ink">Campaigns deliver only to approved states.</span>{' '}
          <span className="text-ink2">
            D2D registers as a paid solicitor in each state on the client&rsquo;s behalf. This gate
            is enforced in code — a campaign cannot target a state until its registration is{' '}
            <span className="font-medium">approved</span> and unexpired.
          </span>
        </Banner>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Approved" value={counts.approved} hint="delivering now" />
          <KpiCard label="Submitted" value={counts.submitted} hint="awaiting approval" />
          <KpiCard label="In prep" value={counts.pending} hint="filing with counsel" />
          <KpiCard
            label="Bond posted"
            value={<Money cents={totalBond} region={CLIENT.region} />}
            hint="across all filings"
            animate={false}
          />
        </div>

        <Section
          title="Paid-solicitor registration matrix"
          subtitle="One row per state. Door and inside-sales conversions can only be billed where D2D holds an active registration."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>State</th>
                <th>Status</th>
                <th>Registration #</th>
                <th>Filed</th>
                <th>Approved</th>
                <th>Expires</th>
                <th className="text-right">Bond</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.state}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="tag shrink-0">{r.state}</span>
                      <span className="font-medium text-ink">{r.name}</span>
                    </div>
                    {r.note && (
                      <div className="mt-1 text-[11px] text-muted max-w-[420px]">{r.note}</div>
                    )}
                  </td>
                  <td>
                    <StatusPill tone={solicitorTone(r.status)}>
                      {solicitorLabel(r.status)}
                    </StatusPill>
                  </td>
                  <td className="mono text-[12px] text-ink2">{r.registrationNumber ?? '—'}</td>
                  <td className="text-muted">{fmtDate(r.filedAt)}</td>
                  <td className="text-muted">{fmtDate(r.approvedAt)}</td>
                  <td className="text-muted">{fmtDate(r.expiresAt)}</td>
                  <td className="text-right">
                    <Money cents={r.bondCents} region={CLIENT.region} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="How the gate works"
          subtitle="The state-clearance engine is the platform's longest-pole compliance control."
        >
          <ol className="space-y-2.5 text-[13px] text-ink2">
            <li className="flex gap-3">
              <span className="tag shrink-0">1</span>
              <span>
                Counsel files a paid-solicitor registration for D2D, the operating entity, in each
                target state — most carry a surety bond, posted up front.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tag shrink-0">2</span>
              <span>
                When the state approves the filing, its registration flips to{' '}
                <span className="font-medium">approved</span> with an expiry one year out, and the
                state is added to the campaign&rsquo;s cleared set.
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
