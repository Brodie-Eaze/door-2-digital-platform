import { PartnerShell } from '@/components/PartnerShell';
import { Section, StatusPill, KpiCard } from '@d2d/ui-web';
import { STATE_CLEARANCES, type ClearanceStatus } from '@/lib/fixtures';

function statusTone(s: ClearanceStatus): 'success' | 'warn' | 'danger' | 'muted' {
  if (s === 'cleared') return 'success';
  if (s === 'pending') return 'warn';
  if (s === 'expired') return 'danger';
  return 'muted';
}

function statusLabel(s: ClearanceStatus): string {
  if (s === 'cleared') return 'Cleared';
  if (s === 'pending') return 'Pending';
  if (s === 'expired') return 'Expired';
  return 'Not filed';
}

export default function CompliancePage() {
  const cleared = STATE_CLEARANCES.filter((s) => s.status === 'cleared');
  const pending = STATE_CLEARANCES.filter((s) => s.status === 'pending');
  const notFiled = STATE_CLEARANCES.filter((s) => s.status === 'not_filed');

  return (
    <PartnerShell pageTitle="State clearances">
      <div className="space-y-6">
        <Section title="Paid-solicitor registration status">
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Cleared states" value={String(cleared.length)} hint="Campaigns live" />
            <KpiCard
              label="Pending approval"
              value={String(pending.length)}
              hint="Bond posted / filed"
            />
            <KpiCard label="Not yet filed" value={String(notFiled.length)} hint="Scheduled 2026" />
            <KpiCard
              label="Coverage"
              value={`${cleared.length}/${STATE_CLEARANCES.length}`}
              hint="of target states"
            />
          </div>
        </Section>

        <Section title="State matrix">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Cleared</th>
                  <th>Expires</th>
                  <th className="text-right">Bond</th>
                  <th>Registration #</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {STATE_CLEARANCES.map((sc) => (
                  <tr key={sc.code}>
                    <td className="font-medium">{sc.state}</td>
                    <td className="mono">{sc.code}</td>
                    <td>
                      <StatusPill tone={statusTone(sc.status)}>{statusLabel(sc.status)}</StatusPill>
                    </td>
                    <td className="text-muted">{sc.clearedDate ?? '—'}</td>
                    <td className="text-muted">{sc.expiresDate ?? '—'}</td>
                    <td className="text-right mono text-muted">
                      {sc.bondAmountDollars ? `$${sc.bondAmountDollars.toLocaleString()}` : '—'}
                    </td>
                    <td className="mono text-xs text-muted">{sc.registrationNumber ?? '—'}</td>
                    <td className="text-muted text-xs max-w-[200px]">{sc.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="About paid-solicitor compliance">
          <div className="card p-5 text-sm text-muted leading-relaxed max-w-3xl space-y-3">
            <p>
              Door 2 Digital operates as a paid solicitor on your behalf in each state where your
              campaigns run. State-level charitable solicitation registration is required before any
              door-to-door canvassing can commence in that state.
            </p>
            <p>
              <strong className="text-ink">Campaign delivery gate:</strong> the platform enforces a
              hard compliance check on every conversion attempt — if a state is not in{' '}
              <span className="mono text-xs">CLEARED</span> status, the knock is recorded but no
              conversion can be finalised for that address. This gate cannot be bypassed.
            </p>
            <p>
              <strong className="text-ink">Registration renewal:</strong> D2D counsel manages
              renewal 60 days before expiry. You will receive an email alert at 90 days and 30 days.
              A lapsed registration automatically suspends campaign delivery for that state.
            </p>
            <p>
              Questions about a specific state? Contact your D2D account manager or email{' '}
              <span className="text-accent">compliance@door2digital.io</span>.
            </p>
          </div>
        </Section>
      </div>
    </PartnerShell>
  );
}
