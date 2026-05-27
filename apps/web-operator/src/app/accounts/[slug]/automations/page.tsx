import { Zap } from 'lucide-react';
import { Banner, EmptyState } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Automations">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <EmptyState
            icon={Zap}
            title="No automations active."
            description="Automations are workflow primitives — small one-step rules. The full builder lives under Workflows. Start there for multi-step orchestration."
            primaryAction={{ label: 'Open workflows', href: `/accounts/${params.slug}/workflows` }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Automations">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">Automations</span> for this account — full screen wired
            in the previous build (web-org/automations). Being merged into this account workspace.
          </span>
        </Banner>
      </div>
    </AccountShell>
  );
}
