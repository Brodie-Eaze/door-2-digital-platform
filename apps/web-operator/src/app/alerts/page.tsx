import { Banner } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

export default function AlertsPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Alerts">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">Alerts surface scaffolded. Full impl in Phase 1.4.</span>
        </Banner>
      </div>
    </PlatformShell>
  );
}
