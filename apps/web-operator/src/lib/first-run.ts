/**
 * First-run detection + milestone builders for newly onboarded accounts.
 *
 * Sprint C contract: an account is "first run" when its slug isn't a known
 * demo seed (i.e. an org-admin just provisioned it via `/onboard-account`
 * and we have no rollup history yet). In production this would be derived
 * from the org's `firstActivityAt`, MTD conversions, and roster count — for
 * the demo we use the absence of a seed config as the deterministic proxy.
 *
 * The four demo accounts (hope-forward, world-vision, pestmax,
 * gold-coast-hospital) NEVER hit first-run mode — they always render with
 * sprint B's populated fixtures. This is intentional: empty states must not
 * regress the realism work shipped in sprint B.
 */

import { ACCOUNT_SEEDS } from './seed/kpis';
import { getAccount } from './accounts';

export interface FirstRunSnapshot {
  /** Is this an account we have no fixture seed for? */
  isFirstRun: boolean;
  /** Did `getAccount(slug)` return a record from the static fleet? */
  hasAccount: boolean;
  /** Convenience getter for the underlying static account record. */
  accountName: string;
  accountSlug: string;
}

/**
 * Check whether the given slug should render in first-run mode.
 * Returns a snapshot rather than a bare boolean so callers can decide
 * between "first-run UX" and "404 / not-found UX" without re-querying.
 */
export function firstRunSnapshot(slug: string): FirstRunSnapshot {
  const account = getAccount(slug);
  const seeded = Object.prototype.hasOwnProperty.call(ACCOUNT_SEEDS, slug);
  // If the slug isn't in the static fleet AND isn't seeded, we treat it as
  // a brand-new tenant. (A live tenant fetched from the DB would land here
  // until we wire up DB-backed rollups in Phase 1.2.)
  const isFirstRun = !account || !seeded;
  return {
    isFirstRun,
    hasAccount: Boolean(account),
    accountName: account?.shortName ?? prettifySlug(slug),
    accountSlug: slug,
  };
}

function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((p) => (p.length === 0 ? p : p[0]!.toUpperCase() + p.slice(1)))
    .join(' ');
}

export interface FirstRunMilestoneSeed {
  id: string;
  label: string;
  hint?: string;
  progress: number;
  counter?: { current: number; target: number };
  cta?: { label: string; href?: string; onClick?: () => void };
}

/**
 * Standard first-run milestones for `/today`. Sprint C anchors three:
 *   1. Onboard knockers (target 10)
 *   2. Draw a territory
 *   3. Run a campaign
 * For a freshly onboarded account all three sit at 0 — caller may pass
 * computed progress later when those signals exist server-side.
 */
export function defaultFirstRunMilestones(slug: string): FirstRunMilestoneSeed[] {
  const base = `/accounts/${slug}`;
  return [
    {
      id: 'onboard-knockers',
      label: 'Onboard your first 10 knockers',
      hint: 'Invite reps via email or install the Knocker iOS app on a field device.',
      progress: 0,
      counter: { current: 0, target: 10 },
      cta: { label: 'Open knockers', href: `${base}/knockers` },
    },
    {
      id: 'draw-territory',
      label: 'Draw your first territory',
      hint: 'Polygon the streets your reps will work. Mesh blocks + heatmap layered on top.',
      progress: 0,
      cta: { label: 'Open territories', href: `${base}/territories` },
    },
    {
      id: 'first-campaign',
      label: 'Launch your first campaign',
      hint: 'Pair retargeting with door reps so a Knocker conversation has air cover.',
      progress: 0,
      cta: { label: 'Open Marketing Studio', href: `${base}/marketing-studio` },
    },
  ];
}
