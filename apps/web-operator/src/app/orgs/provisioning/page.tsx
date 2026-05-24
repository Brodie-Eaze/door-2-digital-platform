import { Banner } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';

export default function Page(): JSX.Element {
  return (
    <OperatorShell pageTitle="orgs/provisioning">
      <div className="max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Scaffolded. Full implementation in the relevant phase.
          </span>
        </Banner>
      </div>
    </OperatorShell>
  );
}
