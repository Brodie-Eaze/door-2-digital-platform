'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Plus, X, Star, Pencil, Archive, PackageOpen } from 'lucide-react';
import { Banner, Button, Input, KpiCard, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { useAccountMeta } from '@/lib/use-account-meta';
import { firstRunSnapshot } from '@/lib/first-run';

// ────────────────────────────────────────────────────────────────────────────
// Live wire: GET/POST /api/orgs/[slug]/catalog + PATCH/DELETE /catalog/[id].
// This catalog is what the native Knocker app shows on the sign-up flow.
// `amountCents` is integer cents on the wire (4000 = $40); we present dollars.
// ────────────────────────────────────────────────────────────────────────────

type Frequency = 'monthly' | 'weekly' | 'once';
type OfferingVertical = 'charity' | 'commercial';

interface Offering {
  id: string;
  name: string;
  blurb: string;
  amountCents: number;
  frequency: Frequency;
  vertical: OfferingVertical;
  highlighted: boolean;
  sortOrder: number;
  active: boolean;
}

const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: '/ month',
  weekly: '/ week',
  once: 'one-off',
};

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export default function ServicesPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const meta = useAccountMeta(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  const defaultVertical: OfferingVertical =
    meta?.vertical === 'commercial' ? 'commercial' : 'charity';

  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Offering | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/catalog`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load the catalog — please retry.');
        setOfferings([]);
        return;
      }
      const data = (await res.json()) as { offerings: Offering[] };
      setOfferings(data.offerings);
    } catch {
      setLoadError('Could not load the catalog — please retry.');
      setOfferings([]);
    }
  }, [params.slug]);

  useEffect(() => {
    if (firstRun.isFirstRun) return;
    void load();
  }, [firstRun.isFirstRun, load]);

  async function archive(o: Offering): Promise<void> {
    try {
      const res = await fetch(
        `/api/orgs/${encodeURIComponent(params.slug)}/catalog/${encodeURIComponent(o.id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        toast.error('Could not archive — please retry.');
        return;
      }
      toast.success(`Archived "${o.name}"`);
      void load();
    } catch {
      toast.error('Network error — please retry.');
    }
  }

  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Services">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <Section title="Service catalog" subtitle="What the Knocker iOS sign-up flow offers">
            <div className="px-6 py-10 text-center text-[12px] text-muted">
              Finish onboarding this account to start building its catalog.
            </div>
          </Section>
        </div>
      </AccountShell>
    );
  }

  const rows = offerings ?? [];

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Services">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            These are the offerings a knocker signs a customer up to on the doorstep. The native
            Knocker iOS app fetches this catalog live — add, edit or archive here and the app
            updates.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Active offerings" value={rows.length} />
          <KpiCard
            label="Highlighted"
            value={rows.filter((o) => o.highlighted).length}
            hint="suggested tier"
          />
          <KpiCard
            label="Recurring"
            value={rows.filter((o) => o.frequency !== 'once').length}
            hint="monthly / weekly"
          />
        </div>

        <Section
          title="Service catalog"
          subtitle="Ordered as it appears in the Knocker iOS sign-up flow"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source={offerings ? 'live' : 'fixture'} />
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={13} />}
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
              >
                New offering
              </Button>
            </div>
          }
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
          ) : offerings === null ? (
            <div className="px-6 py-10 text-center text-[12px] text-muted">Loading catalog…</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <PackageOpen size={22} className="text-soft mx-auto mb-2" aria-hidden />
              <div className="text-[13px] font-semibold text-ink mb-1">No offerings yet</div>
              <div className="text-[12px] text-muted max-w-sm mx-auto">
                Add the first giving tier or product plan. It appears in the Knocker iOS sign-up
                flow as soon as you save.
              </div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Offering</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Vertical</th>
                  <th>Order</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {o.highlighted && (
                            <Star
                              size={12}
                              className="text-amber-500 shrink-0"
                              aria-label="Highlighted"
                            />
                          )}
                          <div>
                            <div className="text-[13px] font-medium text-ink">{o.name}</div>
                            {o.blurb && <div className="text-[11px] text-muted">{o.blurb}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="text-[13px] text-ink numeric">
                        {formatDollars(o.amountCents)}
                      </td>
                      <td className="text-[12px] text-muted">{FREQUENCY_LABEL[o.frequency]}</td>
                      <td>
                        <span className="tag capitalize">{o.vertical}</span>
                      </td>
                      <td className="text-[12px] text-soft numeric">{o.sortOrder}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(o);
                              setEditorOpen(true);
                            }}
                            aria-label={`Edit ${o.name}`}
                            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            <Pencil size={13} className="text-soft" aria-hidden />
                          </button>
                          <button
                            onClick={() => void archive(o)}
                            aria-label={`Archive ${o.name}`}
                            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                          >
                            <Archive size={13} className="text-rose-500" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      {editorOpen && (
        <OfferingEditor
          slug={params.slug}
          offering={editing}
          defaultVertical={defaultVertical}
          nextSortOrder={rows.length}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            void load();
          }}
        />
      )}
    </AccountShell>
  );
}

function OfferingEditor({
  slug,
  offering,
  defaultVertical,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  slug: string;
  offering: Offering | null;
  defaultVertical: OfferingVertical;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const isEdit = offering !== null;
  const [name, setName] = useState(offering?.name ?? '');
  const [blurb, setBlurb] = useState(offering?.blurb ?? '');
  const [amount, setAmount] = useState(offering ? String(offering.amountCents / 100) : '');
  const [frequency, setFrequency] = useState<Frequency>(offering?.frequency ?? 'monthly');
  const [vertical, setVertical] = useState<OfferingVertical>(offering?.vertical ?? defaultVertical);
  const [highlighted, setHighlighted] = useState(offering?.highlighted ?? false);
  const [sortOrder, setSortOrder] = useState(String(offering?.sortOrder ?? nextSortOrder));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const amountCents = Math.round(parseFloat(amount) * 100);
  const canSubmit = name.trim().length > 0 && Number.isFinite(amountCents) && amountCents > 0;

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (submitting || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const parsedSort = parseInt(sortOrder, 10);
      const payload = {
        name: name.trim(),
        blurb: blurb.trim() || undefined,
        amountCents,
        frequency,
        highlighted,
        sortOrder: Number.isFinite(parsedSort) ? parsedSort : 0,
        // vertical is immutable on edit (the PATCH schema omits it); only sent on create.
        ...(isEdit ? {} : { vertical }),
      };
      const url = isEdit
        ? `/api/orgs/${encodeURIComponent(slug)}/catalog/${encodeURIComponent(offering.id)}`
        : `/api/orgs/${encodeURIComponent(slug)}/catalog`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not save — please check the details.');
        return;
      }
      toast.success(isEdit ? 'Offering updated' : 'Offering created');
      onSaved();
    } catch {
      setError('Network error — please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit offering' : 'New offering'}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line2">
          <div className="text-[14px] font-semibold text-ink">
            {isEdit ? 'Edit offering' : 'New offering'}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={14} className="text-muted" aria-hidden />
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="p-5 space-y-3">
          <Input
            label="Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hope Plus"
            autoFocus
            required
          />
          <Input
            label="Blurb (optional)"
            name="blurb"
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Clean water for a family"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (USD)"
              name="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftSlot={<span className="text-[13px]">$</span>}
              required
            />
            <Field label="Frequency">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="w-full px-3 h-9 bg-surface border border-line rounded-lg text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="once">One-off</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vertical">
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as OfferingVertical)}
                disabled={isEdit}
                className="w-full px-3 h-9 bg-surface border border-line rounded-lg text-[13px] text-ink disabled:bg-paper disabled:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent"
              >
                <option value="charity">Charity</option>
                <option value="commercial">Commercial</option>
              </select>
            </Field>
            <Input
              label="Sort order"
              name="sortOrder"
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={highlighted}
              onChange={(e) => setHighlighted(e.target.checked)}
              className="w-4 h-4 rounded border-line2 text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
            />
            Highlight as the suggested / most-popular tier
          </label>
          {error && (
            <div className="text-[12px] text-danger" role="alert">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!canSubmit || submitting}
            >
              {isEdit ? 'Save changes' : 'Create offering'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="w-full">
      <div className="block text-[12px] font-medium text-ink tracking-tight mb-1">{label}</div>
      {children}
    </div>
  );
}
