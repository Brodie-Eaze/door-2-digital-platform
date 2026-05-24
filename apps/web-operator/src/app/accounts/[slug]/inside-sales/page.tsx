import { Banner } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  return (
    <AccountShell accountSlug={params.slug} pageTitle="inside-sales">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">inside-sales</span> for this account — full screen wired
            in the previous build (web-org/inside-sales). Being merged into this account workspace.
          </span>
        </Banner>
      </div>
    </AccountShell>
  );
}
