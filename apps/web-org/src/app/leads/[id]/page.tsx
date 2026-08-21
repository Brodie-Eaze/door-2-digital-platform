import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { apiFetch, type LeadDetailResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { lead } = await apiFetch<LeadDetailResponse>(`/leads/${id}`);

  return (
    <OrgShell pageTitle="Lead">
      <div className="max-w-[860px] space-y-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
        >
          <ChevronLeft size={14} /> All leads
        </Link>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[16px] font-semibold text-ink">
                {lead.givenName} {lead.familyName}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                <StatusPill tone="info">{lead.status}</StatusPill>
                <span>{lead.vertical}</span>
                <span>· {lead.regionCode}</span>
              </div>
            </div>
            <div className="text-right text-[11px] text-muted">
              <div>Created {formatWhen(lead.createdAt)}</div>
              <div>Updated {formatWhen(lead.updatedAt)}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <div className="text-muted uppercase tracking-wide text-[10px]">Phone</div>
              <div className="text-ink font-mono">{lead.phone ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted uppercase tracking-wide text-[10px]">Email</div>
              <div className="text-ink font-mono">{lead.email ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted uppercase tracking-wide text-[10px]">Assigned to</div>
              <div className="text-ink">{lead.assignedToId ?? 'Unassigned'}</div>
            </div>
            <div>
              <div className="text-muted uppercase tracking-wide text-[10px]">Source knock</div>
              <div className="text-ink">{lead.sourceKnockId ?? 'Not from a knock'}</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[13px] font-semibold text-ink mb-3">Activity</div>
          {lead.activities.length === 0 ? (
            <div className="text-[12px] text-muted">
              No activity yet — calls, texts and notes appear here as the team works this lead.
            </div>
          ) : (
            <ol className="space-y-3">
              {lead.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-[12px]">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-ink">
                      <span className="font-medium">{a.type}</span>
                      {a.outcome ? <span className="text-muted"> · {a.outcome}</span> : null}
                    </div>
                    <div className="text-[11px] text-muted">{formatWhen(a.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </OrgShell>
  );
}
