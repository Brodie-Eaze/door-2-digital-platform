'use client';

import { use } from 'react';

import { ShieldCheck, AlertTriangle, FileText, KeyRound, RefreshCw } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { ComplianceEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { getAccount, type Account } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

/**
 * Stable FNV-1a 32-bit hex of a string. Deterministic per input — used to
 * derive a fixed-looking Merkle root for the demo audit-chain surface so the
 * integrity display never changes per render (never Math.random).
 */
function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Build a stable 64-hex-char pseudo Merkle root from the account slug. */
function stableMerkleRoot(slug: string): string {
  let out = '';
  let seed = slug;
  while (out.length < 64) {
    const chunk = fnv1aHex(seed);
    out += chunk;
    seed = `${seed}:${chunk}`;
  }
  return `0x${out.slice(0, 64)}`;
}

interface RegistrationRow {
  jurisdiction: string;
  status: 'approved' | 'submitted' | 'pending';
  filed: string;
  expires: string;
  bond: string;
  regNumber: string;
}

function buildRegistrations(account: Account): RegistrationRow[] {
  if (account.region === 'AU') {
    // ACNC + state regulators (Fundraising NSW etc.)
    return [
      {
        jurisdiction: 'ACNC (federal)',
        status: 'approved',
        filed: '2025-09-12',
        expires: '2027-09-12',
        bond: 'n/a',
        regNumber: 'ACN-9482-114',
      },
      {
        jurisdiction: 'Fundraising NSW',
        status: 'approved',
        filed: '2025-10-04',
        expires: '2026-10-04',
        bond: 'A$20,000',
        regNumber: 'CFN-25-118',
      },
      {
        jurisdiction: 'Consumer Affairs VIC',
        status: 'approved',
        filed: '2025-10-14',
        expires: '2026-10-14',
        bond: 'A$15,000',
        regNumber: 'F-25-04412',
      },
      {
        jurisdiction: 'OFT QLD',
        status: 'approved',
        filed: '2025-11-02',
        expires: '2026-11-02',
        bond: 'A$10,000',
        regNumber: 'QFC-25-844',
      },
      {
        jurisdiction: 'Consumer Protection WA',
        status: account.slug === 'world-vision' ? 'approved' : 'submitted',
        filed: '2026-04-18',
        expires: '2027-04-18',
        bond: 'A$10,000',
        regNumber: account.slug === 'world-vision' ? 'WAC-26-118' : '—',
      },
      {
        jurisdiction: 'CBS SA',
        status: 'pending',
        filed: '—',
        expires: '—',
        bond: 'A$8,000',
        regNumber: '—',
      },
    ];
  }
  if (account.region === 'SG') {
    return [
      {
        jurisdiction: 'Commissioner of Charities (SG)',
        status: 'approved',
        filed: '2025-12-04',
        expires: '2027-12-04',
        bond: 'n/a',
        regNumber: 'COC-SG-25-118',
      },
      {
        jurisdiction: 'PDPC notification',
        status: 'approved',
        filed: '2025-12-04',
        expires: '—',
        bond: 'n/a',
        regNumber: 'PDPC-SG-25-918',
      },
    ];
  }
  // US — paid solicitor registrations per state
  const base: RegistrationRow[] = [
    {
      jurisdiction: 'TX (Texas)',
      status: 'approved',
      filed: '2025-08-04',
      expires: '2026-08-04',
      bond: '$25,000',
      regNumber: 'TX-PS-25-9118',
    },
    {
      jurisdiction: 'CA (California)',
      status: 'submitted',
      filed: '2026-03-12',
      expires: '—',
      bond: '$25,000',
      regNumber: '—',
    },
    {
      jurisdiction: 'NY (New York)',
      status: 'submitted',
      filed: '2026-03-14',
      expires: '—',
      bond: '$25,000',
      regNumber: '—',
    },
    {
      jurisdiction: 'FL (Florida)',
      status: 'approved',
      filed: '2025-10-22',
      expires: '2026-10-22',
      bond: '$50,000',
      regNumber: 'FL-CH-44182',
    },
    {
      jurisdiction: 'AZ (Arizona)',
      status: 'approved',
      filed: '2025-11-04',
      expires: '2026-11-04',
      bond: '$10,000',
      regNumber: 'AZ-SOL-9241',
    },
    {
      jurisdiction: 'GA (Georgia)',
      status: 'approved',
      filed: '2025-11-12',
      expires: '2026-11-12',
      bond: '$10,000',
      regNumber: 'GA-PS-8841',
    },
    {
      jurisdiction: 'IL (Illinois)',
      status: 'pending',
      filed: '—',
      expires: '—',
      bond: '$25,000',
      regNumber: '—',
    },
    {
      jurisdiction: 'NC (North Carolina)',
      status: 'pending',
      filed: '—',
      expires: '—',
      bond: '$10,000',
      regNumber: '—',
    },
  ];
  // Commercial pest control (PestMax) doesn't need paid-solicitor regs — show contractor licenses instead
  if (account.vertical === 'commercial') {
    return [
      {
        jurisdiction: 'TX SPCS license',
        status: 'approved',
        filed: '2025-07-04',
        expires: '2026-07-04',
        bond: '$25,000',
        regNumber: 'TX-SPCS-44188',
      },
      {
        jurisdiction: 'AZ OPM license',
        status: 'approved',
        filed: '2025-09-12',
        expires: '2026-09-12',
        bond: '$10,000',
        regNumber: 'AZ-OPM-9118',
      },
      {
        jurisdiction: 'CA SPCB license',
        status: 'submitted',
        filed: '2026-04-04',
        expires: '—',
        bond: '$15,000',
        regNumber: '—',
      },
    ];
  }
  return base;
}

function regulatorName(region: 'AU' | 'US' | 'SG', vertical: string): string {
  if (region === 'AU') return 'state regulators (ACNC + Fundraising NSW/VIC/QLD/WA)';
  if (region === 'SG') return 'Commissioner of Charities (COC)';
  if (vertical === 'commercial') return 'state contractor licensing boards';
  return 'state attorneys general (paid-solicitor registrations)';
}

function sectionLabel(region: 'AU' | 'US' | 'SG', vertical: string): string {
  if (region === 'AU') return 'AU charity registrations';
  if (region === 'SG') return 'SG charity registrations';
  if (vertical === 'commercial') return 'Contractor licenses';
  return 'Paid-solicitor registrations';
}

export default function AccountCompliancePage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Compliance">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <ComplianceEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const regs = buildRegistrations(account);
  const cleared = regs.filter((r) => r.status === 'approved').length;
  const pending = regs.filter((r) => r.status !== 'approved').length;

  // Stable, deterministic pseudo Merkle root for the demo audit-chain surface.
  const fakeHash = stableMerkleRoot(account.slug);

  const dncFreshness = account.health === 'attention' ? 18 : 4;
  const auditEvents7d = Math.round(account.knockers * 24 * 7 * 0.12);
  const dnkAddresses = Math.round(account.knockers * 2.4);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Compliance">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone={pending > 0 ? 'warn' : 'info'}>
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            <span>
              {account.shortName} can only campaign in jurisdictions where its filing is{' '}
              <span className="font-semibold">approved</span>. Enforced server-side via{' '}
              <code className="kbd">CampaignStateClearance</code> per ADR-0014. Filings managed with{' '}
              {regulatorName(account.region, account.vertical)}.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label={account.region === 'US' ? 'States cleared' : 'Jurisdictions cleared'}
            value={`${cleared} / ${regs.length}`}
            delta={cleared > 4 ? '+1 this month' : undefined}
            deltaTone="positive"
          />
          <KpiCard
            label="Pending applications"
            value={pending}
            hint={pending > 0 ? 'counsel-managed' : 'all current'}
            deltaTone={pending > 0 ? 'negative' : 'positive'}
          />
          <KpiCard
            label="DNC scrub freshness"
            value={`${dncFreshness}h ago`}
            hint={dncFreshness < 12 ? 'within SLA' : 'sync overdue'}
            deltaTone={dncFreshness < 12 ? 'positive' : 'negative'}
          />
          <KpiCard
            label="Audit events 7d"
            value={auditEvents7d.toLocaleString()}
            delta="+8%"
            deltaTone="positive"
            hint="all sealed"
          />
        </div>

        <Section
          title={sectionLabel(account.region, account.vertical)}
          subtitle={`${regs.length} jurisdictions tracked · counsel: Bastion ${account.region}`}
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileText size={13} />}
                onClick={() =>
                  toast.info('File new registration — filing workflow wiring lands in Phase 1.2')
                }
              >
                File new
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>Status</th>
                <th>Filed</th>
                <th>Expires</th>
                <th>Bond</th>
                <th>Reg #</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => {
                const tone: 'success' | 'info' | 'warn' =
                  r.status === 'approved' ? 'success' : r.status === 'submitted' ? 'info' : 'warn';
                return (
                  <tr key={r.jurisdiction}>
                    <td>
                      <div className="text-[13px] font-medium text-ink">{r.jurisdiction}</div>
                    </td>
                    <td>
                      <StatusPill tone={tone}>
                        {r.status === 'approved'
                          ? 'Approved'
                          : r.status === 'submitted'
                            ? 'Submitted'
                            : 'Pending'}
                      </StatusPill>
                    </td>
                    <td className="text-[12px] text-muted numeric">{r.filed}</td>
                    <td className="text-[12px] text-muted numeric">{r.expires}</td>
                    <td className="text-[12px] text-ink numeric">{r.bond}</td>
                    <td className="text-[11px] text-soft mono !text-[10px]">{r.regNumber}</td>
                    <td>
                      <button
                        className="text-[11px] text-accent hover:underline"
                        onClick={() =>
                          toast.info(
                            `${r.jurisdiction} filing detail — document viewer wiring lands in Phase 1.2`,
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Consent & DNC" subtitle={`${account.region} privacy regime enforcement`}>
            <div className="space-y-3 text-[12px]">
              <Row
                label={
                  account.region === 'US'
                    ? 'National DNC list'
                    : account.region === 'AU'
                      ? 'AU Do Not Call register'
                      : 'SG DNC registry'
                }
                value={
                  <span className="flex items-center gap-2">
                    <span className="text-ink font-medium">2.4M numbers</span>
                    <StatusPill tone={dncFreshness < 12 ? 'success' : 'warn'}>
                      {dncFreshness}h fresh
                    </StatusPill>
                  </span>
                }
              />
              <Row
                label="Do Not Knock list (this account)"
                value={
                  <span className="text-ink font-medium numeric">{dnkAddresses} addresses</span>
                }
              />
              <Row
                label="Last sync"
                value={
                  <span className="text-ink numeric">
                    2026-05-24 0{dncFreshness < 10 ? '4' : '0'}:00 UTC
                  </span>
                }
              />
              <Row
                label="TCPA consent capture"
                value={<StatusPill tone="success">100% conformance · 30d</StatusPill>}
              />
              <Row
                label={account.region === 'US' ? 'CCPA opt-outs' : 'Privacy Act requests'}
                value={
                  <span className="text-ink numeric">
                    {Math.max(0, Math.round(account.knockers * 0.05))} pending
                  </span>
                }
              />
              <div className="pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RefreshCw size={13} />}
                  onClick={() =>
                    toast.info('Force DNC re-sync — registry sync wiring lands in Phase 1.2')
                  }
                >
                  Force DNC re-sync now
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Audit chain" subtitle="Per ADR-0011 · tamper-evident Merkle log">
            <div className="space-y-3 text-[12px]">
              <Row
                label="Chain health"
                value={<StatusPill tone="success">Sealed · verified</StatusPill>}
              />
              <div>
                <div className="text-muted mb-1.5">Last Merkle root</div>
                <code className="block w-full text-[10px] text-ink bg-paper border border-line2 rounded p-2 mono break-all">
                  {fakeHash}
                </code>
              </div>
              <Row
                label="Last verified"
                value={<span className="text-ink numeric">2026-05-24 02:00 UTC</span>}
              />
              <Row
                label="Events sealed (lifetime)"
                value={
                  <span className="text-ink numeric font-medium">
                    {Math.round(account.knockers * 24 * 30 * 0.12).toLocaleString()}
                  </span>
                }
              />
              <Row
                label="Notarisation"
                value={
                  <span className="text-ink">
                    AWS QLDB ·{' '}
                    {account.region === 'US'
                      ? 'us-east-1'
                      : account.region === 'AU'
                        ? 'ap-southeast-2'
                        : 'ap-southeast-1'}
                  </span>
                }
              />
              <div className="pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<KeyRound size={13} />}
                  onClick={() =>
                    toast.info(
                      'Chain-proof export is a dual-control action — signed export wiring lands in Phase 1.2',
                    )
                  }
                >
                  Download chain proof
                </Button>
              </div>
            </div>
          </Section>
        </div>

        <Section title="Compliance notifications" subtitle="Last 30 days">
          <div className="space-y-2">
            {[
              ...(pending > 0
                ? [
                    {
                      icon: AlertTriangle,
                      tone: 'text-warn',
                      msg: `${pending} ${account.region === 'US' ? 'state' : 'jurisdiction'} ${pending === 1 ? 'registration' : 'registrations'} pending — ETA 4–6 weeks per counsel.`,
                    },
                  ]
                : []),
              {
                icon: ShieldCheck,
                tone: 'text-success',
                msg: `TCPA / consent capture verified — 100% conformance last 30d for ${account.shortName}.`,
              },
              {
                icon: ShieldCheck,
                tone: 'text-success',
                msg: `DNC list refresh completed 2026-05-24 0${dncFreshness < 10 ? '4' : '0'}:00 UTC — ${dnkAddresses} DNK addresses on file.`,
              },
              {
                icon: ShieldCheck,
                tone: 'text-success',
                msg: `Merkle audit chain sealed nightly — last root verified clean.`,
              },
              ...(account.health === 'attention'
                ? [
                    {
                      icon: AlertTriangle,
                      tone: 'text-warn',
                      msg: `Backup card on file expires in 18mo — recommend rotation before campaign Q3.`,
                    },
                  ]
                : []),
            ].map((n, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[13px] p-3 bg-paper rounded-lg border border-line2"
              >
                <n.icon size={14} className={`${n.tone} mt-0.5 shrink-0`} />
                <span className="text-ink">{n.msg}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
