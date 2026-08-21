/**
 * Demo fixtures — static seed data so the operator console renders
 * realistic content without a backend. Replace with API calls in Phase 1.1.
 *
 * PILOT / ORGS / STATE_CLEARANCE / RECENT_AUDIT were removed once /orgs,
 * /orgs/[slug], /compliance, /compliance/state-clearance, and /audit were
 * wired to live Prisma reads (no fixture fallback on those surfaces
 * anymore). ANOMALIES + KPIS remain — /overview still falls back to them
 * when the DB is unreachable.
 */
import { hqRollup, rollupFor } from './seed/kpis';

const HQ = hqRollup();

export const ANOMALIES = [
  {
    severity: 'critical' as const,
    title: 'Pilot-Charlie SSO/SAML metadata pending',
    description:
      'Required for go-live. Last follow-up with their IT admin: 2026-05-22. Escalate today.',
    timestamp: '1 day ago',
  },
  {
    severity: 'warning' as const,
    title: 'Paid-solicitor registration pending — CA, NY, IL',
    description:
      'Counsel filed 2026-05-12. ETAs: CA week 4, NY week 6, IL week 7. Campaigns blocked from those states until cleared.',
    timestamp: '12 days ago',
  },
  {
    severity: 'warning' as const,
    title: 'MiCamp Gateway sandbox credentials not received',
    description:
      'Kickoff call held 2026-05-20. Sandbox + recurring billing API access expected by EOW. Gates Phase 1.3.',
    timestamp: '3 days ago',
  },
  {
    severity: 'info' as const,
    title: 'SunHaven Solar trial — 3 days remaining',
    description: 'Conversion to paid plan recommended. Current usage: 31 conversions, 6 knockers.',
    timestamp: '2 hours ago',
  },
];

export const KPIS = {
  activeOrgs: 4,
  activeKnockers: HQ.totalReps,
  conversionsMTD: HQ.totalConvMTD,
  conversionsDelta: '+18.2%',
  revenueCentsMTD: HQ.totalRevenueCentsMTD,
  revenueDelta: '+22.4%',
  // Platform residual ≈ 1.05% of revenue. MiCamp ISO residuals (US only).
  processorResidualMTD:
    ((rollupFor('hope-forward').revenueCentsMTD + rollupFor('pestmax').revenueCentsMTD) * 105n) /
    10000n,
};
