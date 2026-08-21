'use client';

/**
 * Platform-level (cross-account) empty states — audit, orgs registry,
 * compliance, and billing. Mirrors AccountEmptyStates.tsx: these are small
 * 'use client' leaves so the icon component reference never has to cross a
 * Server → Client Component prop boundary (a Server Component page cannot
 * pass a Lucide icon function into `<EmptyState icon={...}/>` directly).
 */

import { ShieldCheck, Hash, Building2, CreditCard, Landmark } from 'lucide-react';
import { EmptyState } from '@d2d/ui-web';

export function AuditEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Hash}
      title="No audit events recorded yet."
      description="Every mutation across the platform writes a hash-chained row here in the same transaction as the change. This fills in the moment the first write happens."
      variant="default"
    />
  );
}

export function OrgsRegistryEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Building2}
      title="No client orgs onboarded."
      description="This is the platform-wide org registry. Onboard a business from Accounts to see it here."
      primaryAction={{ label: 'Onboard new business', href: '/onboard-account' }}
      variant="first-run"
    />
  );
}

export function StateClearanceEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="No paid-solicitor filings on record."
      description="State registrations appear here the moment counsel files a PaidSolicitorRegistration row. Until then, campaigns cannot deliver to any state."
      variant="default"
    />
  );
}

export function InvoicesEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={CreditCard}
      title="No invoices generated yet."
      description="The first monthly invoice generates on the 1st with platform fees and rakes itemised per org."
      variant="default"
    />
  );
}

export function ProcessorVolumeEmpty(): JSX.Element {
  return (
    <EmptyState
      icon={Landmark}
      title="No MiCamp-processed conversions yet."
      description="Processor volume and ISO residual populate once a conversion settles with paymentProvider = micamp."
      variant="default"
    />
  );
}
