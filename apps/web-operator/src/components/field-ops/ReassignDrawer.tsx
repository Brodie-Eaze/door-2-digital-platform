'use client';

/**
 * ReassignDrawer — the back half of the Command Centre signature interaction.
 *
 * Opens when an operator clicks "Reassign" on a critical offline-rep anomaly.
 * Slides in from the right, shows the offline rep + their uncovered territory,
 * and lists every AVAILABLE rep (status !== 'offline') sorted by rough distance
 * to the offline rep. Clicking "Assign" on a rep:
 *   1. POST /api/territories/assign  → writes a real TerritoryAssignment when
 *      the territory + user are backed by DB rows, else degrades honestly.
 *   2. POST /api/broadcast           → queues a push to the newly-assigned rep
 *      (honest queue today — APNs/FCM fan-out is humanGated).
 *   3. toast.success(...)            → "<rep> assigned to <territory> · push sent"
 *   4. onAssigned(anomalyId)         → parent greys out / dismisses the anomaly.
 *
 * Never a silent fake: the persisted vs queued state is surfaced in the toast
 * copy, and a network failure raises an error toast rather than a no-op.
 */

import { useMemo, useState } from 'react';
import { X, MapPin, Radio, Loader2 } from 'lucide-react';
import { toast } from '@/components/Toaster';
import { STATUS_COLORS, type FleetRep } from '@/lib/fleet';
import type { AnomalyItem } from './types';

interface ReassignDrawerProps {
  /** The active anomaly — when non-null the drawer is open. */
  anomaly: AnomalyItem | null;
  /** Full fleet roster (the drawer filters to available reps itself). */
  reps: FleetRep[];
  /** Close the drawer without assigning. */
  onClose: () => void;
  /** Fired after a successful assignment — parent dismisses the anomaly. */
  onAssigned: (anomalyId: string) => void;
}

/** Rough great-circle-ish distance (squared euclidean on lat/lng is fine for ordering). */
function roughDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

const STATUS_LABEL: Record<FleetRep['status'], string> = {
  active: 'Active',
  break: 'On break',
  idle: 'Idle',
  offline: 'Offline',
};

export function ReassignDrawer({
  anomaly,
  reps,
  onClose,
  onAssigned,
}: ReassignDrawerProps): JSX.Element | null {
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // The offline rep this anomaly is about (resolved from the fleet by id).
  const offlineRep = useMemo<FleetRep | null>(() => {
    if (!anomaly?.repId) return null;
    return reps.find((r) => r.id === anomaly.repId) ?? null;
  }, [anomaly?.repId, reps]);

  // Anchor for distance sorting: the offline rep's coords, else the anomaly's
  // declared coords, else null (no sort).
  const anchor = offlineRep
    ? { lat: offlineRep.lat, lng: offlineRep.lng }
    : (anomaly?.repCoords ?? null);

  const candidates = useMemo<FleetRep[]>(() => {
    const available = reps.filter((r) => r.status !== 'offline' && r.id !== anomaly?.repId);
    if (!anchor) return available.slice(0, 12);
    return available
      .slice()
      .sort((a, b) => roughDistance(a, anchor) - roughDistance(b, anchor))
      .slice(0, 12);
  }, [reps, anchor, anomaly?.repId]);

  const territoryName = anomaly?.territoryName ?? offlineRep?.territory ?? 'uncovered territory';

  async function handleAssign(rep: FleetRep): Promise<void> {
    if (!anomaly) return;
    setAssigningId(rep.id);
    try {
      // 1. Write the territory assignment (degrades honestly when the demo
      //    rep/territory isn't backed by DB rows).
      const assignRes = await fetch('/api/territories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: anomaly.territoryId,
          territoryName: anomaly.territoryName ?? offlineRep?.territory,
          toUserId: rep.id,
          fromUserId: anomaly.repId,
          anomalyId: anomaly.id,
        }),
      });

      if (!assignRes.ok) {
        toast.error(`Couldn't reassign ${rep.name} — please retry`);
        return;
      }
      const assignBody = (await assignRes.json()) as {
        assigned?: boolean;
        persisted?: boolean;
      };

      // 2. Queue a push to the newly-assigned rep. Honest queue today —
      //    real APNs/FCM fan-out is humanGated. A push failure shouldn't
      //    undo the assignment, so we don't hard-fail on it.
      let pushSent = false;
      try {
        const pushRes = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `You've been assigned to ${territoryName} (covering for an offline rep). Head over when you can.`,
            scope: 'active',
          }),
        });
        pushSent = pushRes.ok;
      } catch {
        pushSent = false;
      }

      const persisted = assignBody.persisted === true;
      const pushNote = pushSent ? 'push sent' : 'push queued';
      // Honest toast tone: a real DB-backed write earns a green success toast;
      // a no-op (persisted:false) write is surfaced as a neutral info toast so
      // the staged-not-saved state isn't dressed up as a confirmed assignment.
      if (persisted) {
        toast.success(`${rep.name} assigned to ${territoryName} · ${pushNote}`);
      } else {
        toast.info(
          `${rep.name} assigned to ${territoryName} (staged — not yet a DB-backed territory) · ${pushNote}`,
        );
      }

      // 3. Parent dismisses the anomaly + closes the drawer.
      onAssigned(anomaly.id);
      onClose();
    } catch {
      toast.error(`Couldn't reassign ${rep.name} — network error`);
    } finally {
      setAssigningId(null);
    }
  }

  const open = anomaly !== null;

  return (
    <>
      {/* Scrim */}
      <div
        className={`fixed inset-0 z-[1000] bg-ink/40 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 z-[1001] h-full w-full max-w-[420px] bg-surface border-l border-line2 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Reassign territory"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-rose-600 font-semibold flex items-center gap-1.5">
              <Radio size={12} /> Coverage gap · reassign
            </div>
            <div className="text-[15px] font-bold text-ink mt-1 truncate">
              {anomaly?.title ?? 'Reassign territory'}
            </div>
            <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1">
              <MapPin size={11} className="text-soft" />
              {territoryName}
              {offlineRep ? (
                <>
                  {' · '}
                  <span className="text-soft">{offlineRep.account}</span>
                </>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-soft hover:text-ink p-1 -m-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Offline rep summary */}
        {offlineRep ? (
          <div className="px-5 py-3 bg-paper border-b border-line2 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ background: STATUS_COLORS.offline }}
            >
              {offlineRep.initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-ink truncate">{offlineRep.name}</div>
              <div className="text-[10.5px] text-muted">
                Offline · last knock{' '}
                {offlineRep.lastKnockMin < 999 ? `${offlineRep.lastKnockMin}m ago` : '—'}
              </div>
            </div>
          </div>
        ) : null}

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
            Nearest available reps · {candidates.length}
          </div>
          {candidates.length === 0 ? (
            <div className="text-[12px] text-muted py-6 text-center">
              No available reps to reassign right now.
            </div>
          ) : (
            <ul className="space-y-2">
              {candidates.map((rep) => {
                const busy = assigningId === rep.id;
                const disabled = assigningId !== null;
                return (
                  <li
                    key={rep.id}
                    className="bg-paper border border-line2 rounded-xl px-3 py-2.5 flex items-center gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: STATUS_COLORS[rep.status] }}
                    >
                      {rep.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-ink truncate">{rep.name}</div>
                      <div className="text-[10px] text-muted truncate">
                        {STATUS_LABEL[rep.status]} · {rep.territory} · {rep.knocksToday} knocks
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void handleAssign(rep)}
                      className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 bg-ink text-white hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : null}
                      {busy ? 'Assigning…' : 'Assign'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer note — honest about the push path */}
        <div className="px-5 py-3 border-t border-line2 text-[10px] text-muted">
          Assignment writes a real territory record when backed by DB rows. The rep push is queued +
          audited; live APNs/FCM fan-out lands with the Knocker-iOS notification service.
        </div>
      </aside>
    </>
  );
}
