/*
 * PlatformTour — the definitive "everything a business gets" walkthrough. Each
 * module a customer org receives is a section: value copy + a capability
 * checklist + a live, on-brand mockup of the actual surface. Grouped by area,
 * alternating layout for rhythm, with a sticky-ish anchor index up top.
 * Server component; Reveal handles scroll choreography.
 */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from '@d2d/ui-web';
import { SiteContainer, Eyebrow } from '@/components/site';
import {
  Frame,
  CommandCentreMock,
  TerritoryMock,
  KnockerPhoneMock,
  DialerMock,
  LeadJourneyMock,
  MarketingMock,
  ConversionsMock,
  CommissionsMock,
  PayoutsMock,
  ComplianceMock,
  AuditMock,
  ReportsMock,
  PartnerPortalMock,
  SettingsMock,
} from '@/components/ModuleMocks';

type Module = {
  id: string;
  group: string;
  title: string;
  lede: string;
  bullets: string[];
  path?: string; // browser frame path; absent → render mock bare (phone)
  mock: ReactNode;
};

const MODULES: Module[] = [
  {
    id: 'command-centre',
    group: 'Field operations',
    title: 'Command Centre',
    lede: 'A live operating picture of every crew in the field — knocks landing in real time, roster on shift, and anomaly detection that tells you where to send people next.',
    bullets: [
      'Live knock feed + rep pins on a real map',
      'On-shift roster with clock-in / break state',
      'AI anomalies: hot territories, idle crews, missed callbacks',
      'Cross-territory KPIs updating within 2 seconds',
    ],
    path: 'app.door2digital.io/command',
    mock: <CommandCentreMock />,
  },
  {
    id: 'territories',
    group: 'Field operations',
    title: 'Territory intelligence',
    lede: 'Draw turf on a real map, see predicted conversion before you knock. Census + SEIFA demographics drive a propensity heatmap so crews work the doors most likely to convert.',
    bullets: [
      'PostGIS polygons with snap-to-street draw tools',
      'ACS / SEIFA propensity heatmap (H3 hex-bin)',
      'Turf assignment + split + crew allocation',
      'Predicted conversion + median income per cell',
    ],
    path: 'app.door2digital.io/territories',
    mock: <TerritoryMock />,
  },
  {
    id: 'knocker-app',
    group: 'Field operations',
    title: 'Knocker iOS app',
    lede: 'The native field app your reps carry. Offline-first by design — four taps from map to a recorded knock, with GPS, photo, signature and fraud signals on every record.',
    bullets: [
      'Offline queue — reconciles idempotently on reconnect',
      'One-thumb disposition + 3-field warm lead capture',
      'Biometric re-auth · App Attest / Play Integrity',
      'Charity-signed authority letter on the badge screen',
    ],
    mock: <KnockerPhoneMock />,
  },
  {
    id: 'crm',
    group: 'CRM & inside sales',
    title: 'CRM + inside-sales dialer',
    lede: 'Interested-at-the-door leads route straight to the call centre with full doorstep context. A soft-phone cockpit, pitch scripts, sequences and a prioritised queue keep closers moving.',
    bullets: [
      'Soft-phone dialer with call logging + disposition',
      'Pipeline kanban · sequences · smart lists',
      'AI lead scores + time-in-stage warnings',
      'Queue prioritised by propensity',
    ],
    path: 'app.door2digital.io/dialer',
    mock: <DialerMock />,
  },
  {
    id: 'lead-journey',
    group: 'CRM & inside sales',
    title: 'Lead journey — knock to converted',
    lede: 'Every touch on one timeline: the doorstep that started it, the call, the email, the appointment, the conversion. Nothing is re-keyed and nothing is lost.',
    bullets: [
      'Unified timeline across door, call, SMS, email',
      'Consent record + attached knocks attached inline',
      'Door attribution preserved end-to-end',
      'Full activity history per lead',
    ],
    path: 'app.door2digital.io/leads/ld_8f2',
    mock: <LeadJourneyMock />,
  },
  {
    id: 'marketing',
    group: 'Marketing & retargeting',
    title: 'AI Marketing Studio',
    lede: 'Knocked-not-converted becomes a hashed audience across Meta, Google and TikTok. Generate on-brand creative, run brand-safety gates, and watch the click come back as a tagged lead.',
    bullets: [
      'AI copy + image + video with provenance / C2PA',
      'Brand-safety + legal-hold gates before publish',
      'Hashed custom audiences across 3 ad networks',
      'Retargeting roundtrip closes the attribution loop',
    ],
    path: 'app.door2digital.io/marketing',
    mock: <MarketingMock />,
  },
  {
    id: 'conversions',
    group: 'Conversions & money',
    title: 'Conversions — donation or sale',
    lede: 'One polymorphic conversion models a recurring gift and a one-shot commercial sale alike. Each carries a single attribution source — the source of truth for every dollar.',
    bullets: [
      'Recurring + one-off donations with tax receipts',
      'Commercial sale + installer scheduling handoff',
      'attributionSource drives the billing bucket',
      'Idempotent finalisation — never double-charges',
    ],
    path: 'app.door2digital.io/conversions',
    mock: <ConversionsMock />,
  },
  {
    id: 'commissions',
    group: 'Conversions & money',
    title: 'Commissions',
    lede: 'Per-knock, per-sale and hybrid plans with crew-leader overrides, accruing daily. The rake bucket that recorded the conversion is the same one that pays the rep.',
    bullets: [
      'Per-knock / per-sale / hybrid plan DSL',
      'Crew-leader override calculations',
      'Daily accrual with full audit',
      'Door 15% · inside-sales 10% · retargeting 5%',
    ],
    path: 'app.door2digital.io/commissions',
    mock: <CommissionsMock />,
  },
  {
    id: 'payouts',
    group: 'Conversions & money',
    title: 'Payouts — instruct, never auto-debit',
    lede: 'A payout run generates a NACHA / CSV instruction file. The platform instructs; a human approves and sends. Money movement is always a human decision.',
    bullets: [
      'Fortnightly / monthly batch generation',
      'NACHA · CSV · region-specific formats',
      'WebAuthn-gated approval',
      'Never auto-debits (ADR-0019)',
    ],
    path: 'app.door2digital.io/payouts',
    mock: <PayoutsMock />,
  },
  {
    id: 'compliance',
    group: 'Compliance & trust',
    title: 'Compliance engine',
    lede: 'Campaigns only deliver to states where the paid-solicitor registration has cleared. Cooling-off, DNC/DNK scrub and consent capture are enforced in code at the point of action.',
    bullets: [
      'Table-driven state-clearance gate',
      'Cooling-off timers block payout until the window closes',
      'DNC + DNK scrub (FTC + FCC + state) nightly',
      'TCPA written consent, timestamped + retained',
    ],
    path: 'app.door2digital.io/compliance',
    mock: <ComplianceMock />,
  },
  {
    id: 'audit',
    group: 'Compliance & trust',
    title: 'Immutable audit + PII vault',
    lede: 'Every mutation writes a hash-chained audit event in the same transaction, shipped to S3 Object Lock for seven years. PII is envelope-encrypted with dual-control just-in-time unmask.',
    bullets: [
      'Hash-chained, Merkle-replayed in CI',
      '7-year S3 Object-Lock retention, per-region chain',
      'PII envelope encryption + searchable SIV digests',
      'Dual-control JIT unmask — every reveal audited',
    ],
    path: 'app.door2digital.io/audit',
    mock: <AuditMock />,
  },
  {
    id: 'reports',
    group: 'Analytics',
    title: 'Reports & analytics',
    lede: 'The full funnel, instrumented — knocks to leads to appointments to conversions — plus saved reports, scheduled exports and leaderboards your crews actually compete on.',
    bullets: [
      'Funnel + cohort + conversion analytics',
      'Saved reports + scheduled exports',
      'Live leaderboards',
      'ROAS attributed back to the door',
    ],
    path: 'app.door2digital.io/reports',
    mock: <ReportsMock />,
  },
  {
    id: 'partner-portal',
    group: 'Enterprise',
    title: 'Client portal',
    lede: 'A white-label portal your client logs into: their invoices with bucketed rake, payout statements, conversion reporting and per-state compliance status — self-service, always current.',
    bullets: [
      'Invoices with platform fee + per-bucket rake',
      'Payout statements + conversion reports',
      'Per-state compliance + clearance status',
      'Their brand, their domain',
    ],
    path: 'portal.client.door2digital.io',
    mock: <PartnerPortalMock />,
  },
  {
    id: 'enterprise',
    group: 'Enterprise',
    title: 'SSO, white-label & roles',
    lede: 'Enterprise table-stakes on day one: SAML SSO into your IdP, your brand baked into the apps, eight platform roles behind row-level tenant isolation, and an optional dedicated database.',
    bullets: [
      'SAML 2.0 — Okta, Azure AD, Google, generic IdP',
      'White-label brand on web + mobile builds',
      '8-role RBAC + ABAC, WebAuthn for sensitive actions',
      'Dedicated single-tenant database option',
    ],
    path: 'app.door2digital.io/settings',
    mock: <SettingsMock />,
  },
];

const GROUPS = [
  'Field operations',
  'CRM & inside sales',
  'Marketing & retargeting',
  'Conversions & money',
  'Compliance & trust',
  'Analytics',
  'Enterprise',
];

export function PlatformTour(): JSX.Element {
  return (
    <div>
      {/* Anchor index */}
      <div className="border-b border-line bg-surface">
        <SiteContainer className="py-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
              Jump to
            </span>
            {MODULES.map((m) => (
              <a
                key={m.id}
                href={`#${m.id}`}
                className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-line2 hover:text-ink"
              >
                {m.title}
              </a>
            ))}
          </div>
        </SiteContainer>
      </div>

      {MODULES.map((m, i) => {
        const reversed = i % 2 === 1;
        const groupFirst = MODULES.findIndex((x) => x.group === m.group) === i;
        return (
          <section
            key={m.id}
            id={m.id}
            className={`scroll-mt-20 border-b border-line py-14 sm:py-16 ${i % 2 === 1 ? 'bg-surface' : 'bg-paper'}`}
          >
            <SiteContainer>
              <Reveal>
                <div
                  className={`grid items-center gap-10 lg:grid-cols-2 ${reversed ? 'lg:[&>*:first-child]:order-2' : ''}`}
                >
                  <div>
                    {groupFirst ? (
                      <div className="mb-2">
                        <Eyebrow>{m.group}</Eyebrow>
                      </div>
                    ) : (
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                        {m.group}
                      </div>
                    )}
                    <h3 className="text-[24px] font-semibold leading-tight tracking-tight text-ink sm:text-[28px]">
                      {m.title}
                    </h3>
                    <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted">{m.lede}</p>
                    <ul className="mt-5 space-y-2.5">
                      {m.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accent">
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span className="text-[13px] leading-relaxed text-ink2">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>{m.path ? <Frame path={m.path}>{m.mock}</Frame> : m.mock}</div>
                </div>
              </Reveal>
            </SiteContainer>
          </section>
        );
      })}
    </div>
  );
}

export { GROUPS };
