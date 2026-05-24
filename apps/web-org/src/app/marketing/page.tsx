import { Banner } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import Link from 'next/link';

export default function CampaignsPage(): JSX.Element {
  return (
    <OrgShell pageTitle="Campaigns">
      <div className="max-w-[1400px] space-y-4">
        <Banner tone="info">
          <span className="text-[13px]">
            Campaigns list — full implementation Phase 1.2. For now, see the live{' '}
            <Link href="/marketing/studio" className="text-accent font-medium underline">
              AI Marketing Studio
            </Link>
            .
          </span>
        </Banner>
      </div>
    </OrgShell>
  );
}
