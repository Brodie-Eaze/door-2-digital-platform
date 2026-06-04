import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import {
  BILLING_PERIODS,
  CLIENT,
  CURRENT_PERIOD,
  PLATFORM_FEE_CENTS,
  fmtDate,
  grossCents,
  netRemittanceCents,
  totalRakeCents,
} from '@/lib/portal-data';

/** Remittance status → pill tone + label (local; not exported from ui-web). */
function remittanceTone(status: 'pending' | 'settled'): 'success' | 'info' {
  return status === 'settled' ? 'success' : 'info';
}
function remittanceLabel(status: 'pending' | 'settled'): string {
  return status === 'settled' ? 'Settled' : 'Pending';
}

export default function PayoutsPage(): JSX.Element {
  const settled = BILLING_PERIODS.filter((p) => p.remittanceStatus === 'settled');
  const remittedToDate = settled.reduce((sum, p) => sum + netRemittanceCents(p), 0n);
  const pending = BILLING_PERIODS.filter((p) => p.remittanceStatus === 'pending').reduce(
    (sum, p) => sum + netRemittanceCents(p),
    0n,
  );

  // Current-period waterfall, computed (never hand-typed).
  const cGross = grossCents(CURRENT_PERIOD);
  const cRake = totalRakeCents(CURRENT_PERIOD);
  const cProcessing = CURRENT_PERIOD.processingFeeCents;
  const cNet = netRemittanceCents(CURRENT_PERIOD);

  return (
    <PortalShell pageTitle="Payout statements">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Remitted to date"
            value={<Money cents={remittedToDate} region={CLIENT.region} />}
            hint={`${settled.length} periods settled`}
            animate={false}
          />
          <KpiCard
            label="Pending remittance"
            value={<Money cents={pending} region={CLIENT.region} />}
            hint={CURRENT_PERIOD.label}
            animate={false}
          />
          <KpiCard
            label="Net to gross"
            value={CURRENT_PERIOD ? `${((Number(cNet) / Number(cGross)) * 100).toFixed(1)}%` : '—'}
            hint="share of gross remitted"
          />
        </div>

        {/* Current period waterfall — where the money goes */}
        <Section
          title={`Remittance waterfall — ${CURRENT_PERIOD.label}`}
          subtitle="Gross conversions collected, less D2D rake, the platform fee, and processing — the remainder is remitted to the client."
          paddedBody={false}
        >
          <table className="tbl">
            <tbody>
              <tr>
                <td className="font-medium text-ink">Gross conversion value</td>
                <td className="text-[12px] text-muted">
                  All attribution buckets, settled in period
                </td>
                <td className="text-right font-medium text-ink">
                  <Money cents={cGross} region={CLIENT.region} />
                </td>
              </tr>
              <tr>
                <td className="text-ink2">Less · D2D rake</td>
                <td className="text-[12px] text-muted">Per-bucket take on conversions</td>
                <td className="text-right text-ink2">
                  − <Money cents={cRake} region={CLIENT.region} />
                </td>
              </tr>
              <tr>
                <td className="text-ink2">Less · platform fee</td>
                <td className="text-[12px] text-muted">Flat monthly access</td>
                <td className="text-right text-ink2">
                  − <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} />
                </td>
              </tr>
              <tr>
                <td className="text-ink2">Less · processing</td>
                <td className="text-[12px] text-muted">MiCamp card + ACH, reconciled at close</td>
                <td className="text-right text-ink2">
                  − <Money cents={cProcessing} region={CLIENT.region} />
                </td>
              </tr>
              <tr className="border-t-2 border-line bg-paper">
                <td className="font-semibold text-ink">Net remitted to {CLIENT.tradingName}</td>
                <td className="text-[12px] text-muted">
                  <StatusPill tone={remittanceTone(CURRENT_PERIOD.remittanceStatus)}>
                    {remittanceLabel(CURRENT_PERIOD.remittanceStatus)}
                  </StatusPill>
                </td>
                <td className="text-right font-semibold text-ink text-[15px]">
                  <Money cents={cNet} region={CLIENT.region} />
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* History */}
        <Section
          title="Remittance history"
          subtitle="Net funds remitted to the client each period, after all D2D fees and processing."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-right">Gross</th>
                <th className="text-right">D2D rake</th>
                <th className="text-right">Platform fee</th>
                <th className="text-right">Processing</th>
                <th className="text-right">Net remitted</th>
                <th className="text-right">Settled</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_PERIODS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-ink">{p.label}</div>
                    <div className="text-[11px] text-muted mono">{p.id}</div>
                  </td>
                  <td className="text-right">
                    <Money cents={grossCents(p)} region={CLIENT.region} />
                  </td>
                  <td className="text-right text-muted">
                    <Money cents={totalRakeCents(p)} region={CLIENT.region} />
                  </td>
                  <td className="text-right text-muted">
                    <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} />
                  </td>
                  <td className="text-right text-muted">
                    <Money cents={p.processingFeeCents} region={CLIENT.region} />
                  </td>
                  <td className="text-right font-semibold text-ink">
                    <Money cents={netRemittanceCents(p)} region={CLIENT.region} />
                  </td>
                  <td className="text-right text-muted">{fmtDate(p.remittanceSettledAt)}</td>
                  <td className="text-right">
                    <StatusPill tone={remittanceTone(p.remittanceStatus)}>
                      {remittanceLabel(p.remittanceStatus)}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <p className="text-[11px] text-muted leading-relaxed max-w-[760px]">
          Remittance is the net of gross conversion value minus the D2D rake, the flat platform fee,
          and payment processing. Processing is estimated for the open period and reconciled to the
          MiCamp settlement file at period close, so the final settled figure may move by a few
          cents. D2D instructs payouts; it never auto-debits the client account.
        </p>
      </div>
    </PortalShell>
  );
}
