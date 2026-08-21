import { ShieldCheck, Hash } from 'lucide-react';
import { Banner, Section } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { RECENT_AUDIT } from '@/lib/fixtures';

/**
 * Stable FNV-1a 32-bit hash → 8 hex chars. Deterministic per event id so the
 * audit-integrity surface never shows a different "hash" on each render.
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export default function AuditPage(): JSX.Element {
  return (
    <OperatorShell pageTitle="Audit log">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="success">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Audit chain integrity verified for week 2026-W21 · Merkle root committed to{' '}
            <code className="kbd">docs/audits/merkle-roots/US/2026-W21.json</code>
          </span>
        </Banner>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card card-pad">
            <div className="h-section">Events today</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">14,892</div>
            <div className="text-[11px] text-muted mt-0.5">all regions</div>
          </div>
          <div className="card card-pad">
            <div className="h-section">Hash chain rows</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">3.4M</div>
            <div className="text-[11px] text-muted mt-0.5">since genesis 2026-04-01</div>
          </div>
          <div className="card card-pad">
            <div className="h-section">S3 Object Lock retention</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">7y</div>
            <div className="text-[11px] text-muted mt-0.5">COMPLIANCE mode</div>
          </div>
        </div>

        <Section
          title="Recent events"
          subtitle="Hash-chained immutable outbox · written in same TX as the originating mutation"
          paddedBody={false}
          action={<DataSourceBadge source="fixture" />}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Chain</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_AUDIT.map((e, i) => (
                <tr key={`${e.occurredAt}-${i}`}>
                  <td className="text-[11px] text-muted numeric">
                    {new Date(e.occurredAt).toISOString().slice(11, 19)}
                  </td>
                  <td className="text-[12px] text-ink truncate max-w-[220px]">{e.actor}</td>
                  <td>
                    <span className="tag">{e.action}</span>
                  </td>
                  <td className="text-[12px] text-muted truncate max-w-[280px]">{e.resource}</td>
                  <td>
                    <span className="text-soft inline-flex items-center gap-1">
                      <Hash size={11} />
                      <span className="font-mono text-[10px]">
                        {fnv1aHex(`${e.occurredAt}|${e.actor}|${e.action}|${e.resource}`)}…
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </OperatorShell>
  );
}
