import { Banner } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  return (
    <AccountShell accountSlug={params.slug} pageTitle="marketing-studio">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">marketing-studio</span> for this account — full screen
            wired in the previous build (web-org/marketing-studio). Being merged into this account
            workspace.
          </span>
        </Banner>
      </div>
    </AccountShell>
  );
}
