import { Banner } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

export default function Page(): JSX.Element {
  return (
    <PlatformShell pageTitle="compliance/state-clearance">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">See parent page · drill-down view scaffolded.</span>
        </Banner>
      </div>
    </PlatformShell>
  );
}
