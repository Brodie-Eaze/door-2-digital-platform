import { Money } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { LEADS, PIPELINE_STAGES } from '@/lib/fixtures';

export default function PipelinePage(): JSX.Element {
  return (
    <OrgShell pageTitle="Pipeline">
      <div className="space-y-6 max-w-[1600px]">
        <div className="grid grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((s) => {
            const stageLeads = LEADS.filter(
              (l) => l.status === s.stage.toLowerCase().replace(' ', '_'),
            );
            return (
              <div key={s.stage} className="card !p-0 flex flex-col" style={{ minHeight: 480 }}>
                <div className="px-4 py-3 border-b border-line2 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-ink tracking-tight">
                      {s.stage}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 numeric">
                      {s.count} · <Money cents={s.valueCents} region="US" />
                    </div>
                  </div>
                  <span className="mono !w-6 !h-6 !text-[10px]">{s.count}</span>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-paper/40">
                  {stageLeads.slice(0, 4).map((l) => (
                    <div
                      key={l.name}
                      className="bg-surface border border-line2 rounded-lg p-3 hover:shadow-sm transition"
                    >
                      <div className="text-[12px] font-medium text-ink truncate">{l.name}</div>
                      <div className="text-[10px] text-muted truncate mt-0.5">{l.address}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="tag !text-[10px]">{l.source.replace('_', ' ')}</span>
                        {l.assignee && (
                          <span className="mono !w-5 !h-5 !text-[9px]">{l.assignee}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-[11px] text-soft text-center py-8">
                      No leads in this stage yet
                    </div>
                  )}
                  {stageLeads.length > 4 && (
                    <div className="text-[11px] text-muted text-center py-2">
                      + {stageLeads.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-muted">
          Drag-drop stage moves wire in Phase 1.3 via <code className="kbd">@dnd-kit</code> with
          optimistic rollback.
        </div>
      </div>
    </OrgShell>
  );
}
