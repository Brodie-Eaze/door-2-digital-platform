import { DollarSign } from 'lucide-react';
import { Banner, EmptyState } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Commissions">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <EmptyState
            icon={DollarSign}
            title="No commission ledger yet."
            description="Commission lines accrue as conversions land — door 15% / inside 10% / retargeting 5% by default, configurable per knocker or campaign."
            primaryAction={{ label: 'Onboard knockers', href: `/accounts/${params.slug}/knockers` }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Commissions">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">Commissions</span> for this account — full screen wired
            in the previous build (web-org/commissions). Being merged into this account workspace.
          </span>
        </Banner>
      </div>
    </AccountShell>
  );
}
