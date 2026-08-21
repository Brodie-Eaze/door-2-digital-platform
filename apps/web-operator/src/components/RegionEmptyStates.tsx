'use client';

/**
 * Region-surface empty states (regions/au/*, regions/sg/*). Mirrors
 * PlatformEmptyStates.tsx: small 'use client' leaves so a Lucide icon
 * reference never has to cross a Server → Client Component prop boundary.
 *
 * Some of these are "will never have a live feed" states rather than
 * "empty until the first row lands" — e.g. there is no Stripe
 * webhook-event log or payment-mandate table in the schema at all, so
 * PaymentFeedEmpty / MandatesEmpty / CohortRetentionEmpty read as
 * "not configured" rather than "nothing here yet". That distinction is
 * called out in each description per the true-source law: an honest
 * absence beats an invented one.
 */

import { ShieldCheck, Clock, Webhook, Repeat2, MapPinned } from 'lucide-react';
import { EmptyState } from '@d2d/ui-web';

export function RegistrationsEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="No paid-solicitor filings on record for this region."
      description="State/regulator registrations appear here the moment counsel files a PaidSolicitorRegistration row. Until then, campaigns cannot deliver to any address in this region."
      variant="default"
    />
  );
}

export function CoolingOffEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Clock}
      title="No cooling-off windows currently open."
      description="Computed live from each conversion's signed date + the statutory window — this fills the moment a new conversion lands in this region."
      variant="default"
    />
  );
}

export function PaymentFeedEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Webhook}
      title="No live payment event feed configured."
      description="The schema has no Stripe webhook-event log — conversion volume below is real, but a per-event stream isn't wired yet."
      variant="default"
    />
  );
}

export function MandatesEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Repeat2}
      title="No recurring-mandate ledger configured."
      description="There is no BPAY/PayTo/PayNow mandate table in the schema yet — recurring status below is derived from Donation rows, not a mandate feed."
      variant="default"
    />
  );
}

export function CohortRetentionEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Repeat2}
      title="Cohort retention analytics not built yet."
      description="Sign-up-month donor retention isn't computed anywhere in the platform — this fills in once that aggregate ships, not before."
      variant="default"
    />
  );
}

export function RegionTerritoryEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={MapPinned}
      title="No territories scored for this region yet."
      description="Territory + PropensityScore rows appear here as soon as a manager draws a canvass area and the propensity model runs for this region."
      variant="default"
    />
  );
}
