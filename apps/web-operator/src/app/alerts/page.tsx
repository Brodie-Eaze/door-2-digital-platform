import { Banner } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';

export default function AlertsPage(): JSX.Element {
  return (
    <OperatorShell pageTitle="Alerts">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">Alerts surface scaffolded. Full impl in Phase 1.4.</span>
        </Banner>
      </div>
    </OperatorShell>
  );
}
