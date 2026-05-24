import { Banner } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';

export default function Page(): JSX.Element {
  return (
    <OperatorShell pageTitle="compliance/state-clearance">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">See parent page · drill-down view scaffolded.</span>
        </Banner>
      </div>
    </OperatorShell>
  );
}
