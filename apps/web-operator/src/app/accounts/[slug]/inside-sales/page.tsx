import { Banner } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { InsideSalesEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Inside sales">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <InsideSalesEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Inside sales">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">Inside sales</span> for this account — full screen wired
            in the previous build (web-org/inside-sales). Being merged into this account workspace.
          </span>
        </Banner>
      </div>
    </AccountShell>
  );
}
