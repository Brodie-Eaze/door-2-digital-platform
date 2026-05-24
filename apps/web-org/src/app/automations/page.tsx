import { Banner, KpiCard } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';

export default function AutomationsPage(): JSX.Element {
  return (
    <OrgShell pageTitle="Automations">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            <span className="font-semibold">Automations</span> surface scaffolded in Phase 0. Full
            implementation ships in the relevant phase per the master plan. Components, design
            tokens, and data model are ready — engineers wire fixtures + API calls when this domain
            comes up the queue.
          </span>
        </Banner>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Placeholder" value="—" hint="Phase 1.x" />
          <KpiCard label="Placeholder" value="—" hint="Phase 1.x" />
          <KpiCard label="Placeholder" value="—" hint="Phase 1.x" />
          <KpiCard label="Placeholder" value="—" hint="Phase 1.x" />
        </div>
      </div>
    </OrgShell>
  );
}
