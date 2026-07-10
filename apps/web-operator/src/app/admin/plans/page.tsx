import { Banner } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

export default function Page(): JSX.Element {
  return (
    <PlatformShell pageTitle="admin/plans">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Scaffolded. Full implementation in the relevant phase.
          </span>
        </Banner>
      </div>
    </PlatformShell>
  );
}
