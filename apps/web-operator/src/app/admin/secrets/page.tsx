'use client';

import { Eye, KeyRound, RotateCw, ShieldAlert } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

type SecretStatus = 'active' | 'rotation_due' | 'expiring';

interface SecretRef {
  id: string;
  name: string;
  scope: string;
  provider: string;
  /** Masked preview only — NEVER the plaintext value. */
  masked: string;
  lastRotated: string;
  rotationDays: number;
  status: SecretStatus;
}

const SECRETS: SecretRef[] = [
  { id: 'sec_micamp', name: 'MICAMP_ISO_API_KEY', scope: 'platform', provider: 'MiCamp', masked: 'mcp_live_••••••••••3f9a', lastRotated: '2026-05-02', rotationDays: 90, status: 'active' },
  { id: 'sec_stripe', name: 'STRIPE_SECRET_KEY', scope: 'platform', provider: 'Stripe', masked: 'sk_live_••••••••••71kP', lastRotated: '2026-04-18', rotationDays: 90, status: 'active' },
  { id: 'sec_crs', name: 'CRS_CREDIT_API_TOKEN', scope: 'platform', provider: 'CRS Credit API', masked: 'crs_••••••••••••a204', lastRotated: '2026-03-01', rotationDays: 90, status: 'rotation_due' },
  { id: 'sec_twilio', name: 'TWILIO_AUTH_TOKEN', scope: 'org:hope-forward', provider: 'Twilio', masked: '••••••••••••••e8b1', lastRotated: '2026-05-28', rotationDays: 60, status: 'active' },
  { id: 'sec_maps', name: 'MAPBOX_ACCESS_TOKEN', scope: 'platform', provider: 'Mapbox', masked: 'pk.••••••••••••.9Qz2', lastRotated: '2026-02-14', rotationDays: 180, status: 'expiring' },
  { id: 'sec_webhook', name: 'WEBHOOK_SIGNING_SECRET', scope: 'platform', provider: 'Internal', masked: 'whsec_••••••••••dd4c', lastRotated: '2026-05-20', rotationDays: 90, status: 'active' },
  { id: 'sec_db', name: 'DATABASE_ENCRYPTION_KEY', scope: 'platform', provider: 'AWS KMS', masked: 'arn:aws:kms:••••6f2e', lastRotated: '2026-01-10', rotationDays: 365, status: 'active' },
];

function statusPill(status: SecretStatus): JSX.Element {
  if (status === 'rotation_due') return <StatusPill tone="warn">Rotation due</StatusPill>;
  if (status === 'expiring') return <StatusPill tone="danger">Expiring soon</StatusPill>;
  return <StatusPill tone="success">Active</StatusPill>;
}

export default function SecretsPage(): JSX.Element {
  const rotationDue = SECRETS.filter((s) => s.status !== 'active').length;

  const onReveal = (s: SecretRef): void => {
    toast.error(
      `Reveal blocked for ${s.name} — plaintext secrets are never rendered in the console. Retrieval requires dual-control approval + a hardware key against the vault.`,
    );
  };

  const onRotate = (s: SecretRef): void => {
    toast.info(
      `Rotate ${s.name} — rotation is dual-control. Open a change ticket; a second operator must co-sign before the vault issues a new credential.`,
    );
  };

  return (
    <OperatorShell pageTitle="Secrets inventory">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="danger">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="shrink-0 text-danger" />
            <span className="text-[13px]">
              <strong>Masked references only.</strong> This console never displays plaintext secret
              values. Reveal and Rotate are dual-control operations that require real vault
              credentials — they are intentionally not faked here.
            </span>
          </div>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Tracked secrets" value={String(SECRETS.length)} hint="across all scopes" />
          <KpiCard label="Rotation due" value={String(rotationDue)} delta={rotationDue > 0 ? `${rotationDue} need attention` : 'all current'} deltaTone={rotationDue > 0 ? 'negative' : 'positive'} />
          <KpiCard label="Vault backend" value="AWS Secrets Mgr" hint="KMS-encrypted at rest" />
          <KpiCard label="Plaintext reads" value="0" hint="dual-control enforced" />
        </div>

        <Section
          title="Secret references"
          subtitle="Demo data — live vault wiring (AWS Secrets Manager + dual-control) lands in Phase 1.4."
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<KeyRound size={14} />}
                onClick={() =>
                  toast.info('Register a new secret — provisioning requires real vault credentials and a dual-control approval in Phase 1.4')
                }
              >
                Register secret
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Secret</th>
                <th>Provider</th>
                <th>Scope</th>
                <th>Value (masked)</th>
                <th>Last rotated</th>
                <th>Policy</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SECRETS.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{s.name}</span>
                  </td>
                  <td className="text-[13px] text-ink">{s.provider}</td>
                  <td>
                    <span className="pill pill-muted">{s.scope}</span>
                  </td>
                  <td className="mono text-[11px] text-muted">{s.masked}</td>
                  <td className="text-[12px] text-muted">{s.lastRotated}</td>
                  <td className="numeric text-[12px] text-muted">{s.rotationDays}d</td>
                  <td>{statusPill(s.status)}</td>
                  <td>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="ghost" size="sm" leftIcon={<Eye size={13} />} onClick={() => onReveal(s)}>
                        Reveal
                      </Button>
                      <Button variant="secondary" size="sm" leftIcon={<RotateCw size={13} />} onClick={() => onRotate(s)}>
                        Rotate
                      </Button>
                    </div>
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
