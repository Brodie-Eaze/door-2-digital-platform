import { OrgShell } from '@/components/OrgShell';
import { apiFetch, type LeadPublic, type PageResponse } from '@/lib/api';

const PIPELINE_STAGES = [
  { label: 'New', status: 'new' },
  { label: 'Contacted', status: 'contacted' },
  { label: 'Qualified', status: 'qualified' },
  { label: 'Appointment set', status: 'appointment_set' },
  { label: 'Converted', status: 'converted' },
] as const;

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function leadSource(lead: LeadPublic): string {
  return lead.sourceKnockId ? 'door' : 'unattributed';
}

export default async function PipelinePage(): Promise<JSX.Element> {
  const leadPage = await apiFetch<PageResponse<LeadPublic>>('/leads');
  const leads = leadPage.data;

  return (
    <OrgShell pageTitle="Pipeline">
      <div className="space-y-6 max-w-[1600px]">
        <div className="grid grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.status === stage.status);
            return (
              <div
                key={stage.status}
                className="card !p-0 flex flex-col"
                style={{ minHeight: 480 }}
              >
                <div className="px-4 py-3 border-b border-line2 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-ink tracking-tight">
                      {stage.label}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 numeric">
                      {stageLeads.length} leads
                    </div>
                  </div>
                  <span className="mono !w-6 !h-6 !text-[10px]">{stageLeads.length}</span>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-paper/40">
                  {stageLeads.slice(0, 4).map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-surface border border-line2 rounded-lg p-3 hover:shadow-sm transition"
                    >
                      <div className="text-[12px] font-medium text-ink truncate">
                        {lead.givenName} {lead.familyName}
                      </div>
                      <div className="text-[10px] text-muted truncate mt-0.5">
                        {lead.addressId
                          ? `Address ${shortId(lead.addressId)}`
                          : 'No address linked'}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="tag !text-[10px]">{leadSource(lead)}</span>
                        {lead.assignedToId && (
                          <span className="mono !w-5 !h-5 !text-[9px]">
                            {shortId(lead.assignedToId)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-[11px] text-soft text-center py-8">
                      No leads yet — they appear as knockers capture them in the field
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
        {leadPage.nextCursor && (
          <div className="text-[11px] text-muted">
            More leads are available after this first page.
          </div>
        )}
        <div className="text-[11px] text-muted">
          Drag-drop stage moves wire in Phase 1.3 via <code className="kbd">@dnd-kit</code> with
          optimistic rollback.
        </div>
      </div>
    </OrgShell>
  );
}
