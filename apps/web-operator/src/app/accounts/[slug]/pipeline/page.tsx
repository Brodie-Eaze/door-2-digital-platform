'use client';

import { useState, type DragEvent } from 'react';
import { Banner, Money, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { accountData, PIPELINE_STAGES, type LeadRow } from '@/lib/account-fixtures';

export default function PipelinePage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, leads: initial } = accountData(params.slug);
  const [leads, setLeads] = useState<LeadRow[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);

  if (!account)
    return (
      <AccountShell accountSlug={params.slug}>
        <div>Not found</div>
      </AccountShell>
    );

  function onDragStart(id: string): (e: DragEvent) => void {
    return (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setDragId(id);
    };
  }

  function onDragOver(stage: LeadRow['status']): (e: DragEvent) => void {
    return (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setHoverStage(stage);
    };
  }

  function onDrop(stage: LeadRow['status']): (e: DragEvent) => void {
    return (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: stage } : l)));
      }
      setDragId(null);
      setHoverStage(null);
    };
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Pipeline">
      <div className="space-y-6 max-w-[1600px]">
        <Banner tone="success">
          <span className="text-[13px]">
            <span className="font-semibold">Live drag-drop demo.</span> Pick up any card and drop it
            in another column to move the lead through your sales process. State persists locally.
          </span>
        </Banner>

        <div className="grid grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((s) => {
            const stageLeads = leads.filter((l) => l.status === s.status);
            const isHover = hoverStage === s.status;
            return (
              <div
                key={s.status}
                onDragOver={onDragOver(s.status)}
                onDragLeave={() => setHoverStage(null)}
                onDrop={onDrop(s.status)}
                className={`card !p-0 flex flex-col transition ${
                  isHover ? 'ring-2 ring-accent shadow-md' : ''
                }`}
                style={{ minHeight: 540 }}
              >
                <div className="px-4 py-3 border-b border-line2">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-ink tracking-tight">
                      {s.stage}
                    </div>
                    <span className="mono !w-6 !h-6 !text-[10px]">{stageLeads.length}</span>
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{s.description}</div>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-paper/40">
                  {stageLeads.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={onDragStart(l.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setHoverStage(null);
                      }}
                      className={`bg-surface border border-line2 rounded-lg p-3 transition cursor-grab active:cursor-grabbing hover:shadow-md ${
                        dragId === l.id ? 'opacity-50 scale-95' : ''
                      }`}
                    >
                      <div className="text-[12px] font-medium text-ink truncate">{l.name}</div>
                      <div className="text-[10px] text-muted truncate mt-0.5">{l.address}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="tag !text-[10px]">{l.source.replace('_', ' ')}</span>
                        <span
                          className={`text-[9px] font-medium uppercase tracking-wider ${
                            l.tier === 'high'
                              ? 'text-success'
                              : l.tier === 'low'
                                ? 'text-soft'
                                : 'text-muted'
                          }`}
                        >
                          {l.tier}
                        </span>
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-[11px] text-soft text-center py-8 border border-dashed border-line2 rounded-lg">
                      Drop leads here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Section
          title="What just happened"
          subtitle="Every drag-drop in production is audit-logged + sequence-rescheduled"
        >
          <div className="text-[13px] text-muted">
            In production, moving a lead to a new stage fires{' '}
            <code className="kbd">POST /v1/leads/:id/transitions</code>, writes a same-TX audit row,
            advances the multi-touch sequence (e.g. a lead moved to "Qualified" auto-enrolls in the
            closer sequence), and updates the
            <code className="kbd">Org.aiBudgetCents</code> rake projection.
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
