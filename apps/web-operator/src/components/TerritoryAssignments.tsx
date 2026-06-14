'use client';

/**
 * TerritoryAssignments — the live "assign a knocker to a territory" control for
 * the per-account Territories page. Reads real Territory rows + their active
 * assignments from /api/orgs/[slug]/territories and writes via
 * POST/DELETE /api/orgs/[slug]/territories/[id]/assignments[/:aid].
 *
 * Assigning a knocker here makes the territory show on THAT knocker's iOS map
 * (GET /v1/territories/assigned). House-style only — reuses @d2d/ui-web + the
 * shared toast. Tenant scope is enforced in the BFF; this component just calls it.
 */
import { useCallback, useEffect, useState } from 'react';
import { MapPin, UserPlus, X, Compass } from 'lucide-react';
import { Button, Section, StatusPill } from '@d2d/ui-web';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

interface Assignment {
  id: string;
  userId: string;
  repName: string;
  initials: string;
  assignedAt: string;
  expiresAt: string | null;
}

interface TerritoryRow {
  id: string;
  name: string;
  vertical: string;
  status: string;
  assignments: Assignment[];
}

interface KnockerRow {
  id: string;
  givenName: string;
  familyName: string;
  initials: string;
  status: string;
}

export function TerritoryAssignments({ slug }: { slug: string }): JSX.Element | null {
  const [territories, setTerritories] = useState<TerritoryRow[] | null>(null);
  const [knockers, setKnockers] = useState<KnockerRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<TerritoryRow | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const [tRes, kRes] = await Promise.all([
        fetch(`/api/orgs/${encodeURIComponent(slug)}/territories`, { credentials: 'include' }),
        fetch(`/api/orgs/${encodeURIComponent(slug)}/knockers`, { credentials: 'include' }),
      ]);
      if (!tRes.ok) {
        setLoadError('Could not load territory assignments — please retry.');
        setTerritories([]);
        return;
      }
      const tData = (await tRes.json()) as { territories: TerritoryRow[] };
      setTerritories(tData.territories);
      if (kRes.ok) {
        const kData = (await kRes.json()) as { knockers: KnockerRow[] };
        setKnockers(kData.knockers.filter((k) => k.status !== 'archived'));
      }
    } catch {
      setLoadError('Could not load territory assignments — please retry.');
      setTerritories([]);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(territoryId: string, userId: string): Promise<void> {
    try {
      const res = await fetch(
        `/api/orgs/${encodeURIComponent(slug)}/territories/${encodeURIComponent(territoryId)}/assignments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        toast.error(body?.detail ?? 'Could not assign — please retry.');
        return;
      }
      toast.success('Knocker assigned — it’s now on their map');
      setAssignFor(null);
      void load();
    } catch {
      toast.error('Network error — please retry.');
    }
  }

  async function revoke(territoryId: string, assignmentId: string): Promise<void> {
    try {
      const res = await fetch(
        `/api/orgs/${encodeURIComponent(slug)}/territories/${encodeURIComponent(territoryId)}/assignments/${encodeURIComponent(assignmentId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        toast.error('Could not revoke — please retry.');
        return;
      }
      toast.success('Assignment revoked');
      void load();
    } catch {
      toast.error('Network error — please retry.');
    }
  }

  // No real territory rows for this account → keep the page's fixture heatmap
  // as the only territory surface; rendering an empty live section would just
  // be noise.
  if (territories !== null && territories.length === 0 && !loadError) {
    return null;
  }

  return (
    <>
      <Section
        title="Knocker territory assignments"
        subtitle="Assign a knocker to a territory so it shows on their Knocker iOS map"
        paddedBody={false}
        action={<DataSourceBadge source={territories ? 'live' : 'fixture'} />}
      >
        {loadError ? (
          <div className="px-6 py-8 text-center">
            <div className="text-[13px] text-ink mb-2" role="alert">
              {loadError}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : territories === null ? (
          <div className="px-6 py-10 text-center text-[12px] text-muted">Loading territories…</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Territory</th>
                <th>Status</th>
                <th>Assigned knockers</th>
                <th className="text-right">Assign</th>
              </tr>
            </thead>
            <tbody>
              {territories.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Compass size={12} className="text-soft shrink-0" aria-hidden />
                      <span className="text-[13px] font-medium text-ink">{t.name}</span>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={t.status === 'active' ? 'success' : 'muted'}>
                      {t.status}
                    </StatusPill>
                  </td>
                  <td>
                    {t.assignments.length === 0 ? (
                      <span className="text-[12px] text-soft">Unassigned</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.assignments.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full bg-paper border border-line2 text-[11px] text-ink"
                          >
                            <span className="mono !text-[9px]">{a.initials}</span>
                            {a.repName}
                            <button
                              onClick={() => void revoke(t.id, a.id)}
                              aria-label={`Revoke ${a.repName} from ${t.name}`}
                              className="w-4 h-4 rounded-full hover:bg-line2 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                            >
                              <X size={10} className="text-rose-500" aria-hidden />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<UserPlus size={12} />}
                        onClick={() => setAssignFor(t)}
                      >
                        Assign knocker
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {assignFor && (
        <AssignKnockerModal
          territory={assignFor}
          knockers={knockers}
          onClose={() => setAssignFor(null)}
          onAssign={(userId) => void assign(assignFor.id, userId)}
        />
      )}
    </>
  );
}

function AssignKnockerModal({
  territory,
  knockers,
  onClose,
  onAssign,
}: {
  territory: TerritoryRow;
  knockers: KnockerRow[];
  onClose: () => void;
  onAssign: (userId: string) => void;
}): JSX.Element {
  const assignedIds = new Set(territory.assignments.map((a) => a.userId));
  const available = knockers.filter((k) => !assignedIds.has(k.id));
  const [userId, setUserId] = useState(available[0]?.id ?? '');

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Assign knocker to ${territory.name}`}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line2">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-accent" aria-hidden />
            <div className="text-[14px] font-semibold text-ink">Assign to {territory.name}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={14} className="text-muted" aria-hidden />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {available.length === 0 ? (
            <div className="text-[12px] text-muted">
              {knockers.length === 0
                ? 'No knockers on this account yet — invite one from the Team page first.'
                : 'Every knocker is already assigned to this territory.'}
            </div>
          ) : (
            <div className="w-full">
              <label
                htmlFor="assign-knocker"
                className="block text-[12px] font-medium text-ink tracking-tight mb-1"
              >
                Knocker
              </label>
              <select
                id="assign-knocker"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 h-9 bg-surface border border-line rounded-lg text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent"
              >
                {available.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.initials} · {k.givenName} {k.familyName}
                    {k.status === 'invited' ? ' (invited)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={available.length === 0 || !userId}
              onClick={() => onAssign(userId)}
            >
              Assign
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
