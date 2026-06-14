'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Copy, Check, Mail, UserPlus } from 'lucide-react';
import { Banner, Button, Input, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { TeamEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { firstRunSnapshot } from '@/lib/first-run';

// ────────────────────────────────────────────────────────────────────────────
// Live wire: GET/POST /api/orgs/[slug]/knockers. The BFF resolves slug → org +
// authorizes the session, so this list is tenant-scoped to THIS account only.
// PII: the route never returns plaintext email — it's masked there.
// ────────────────────────────────────────────────────────────────────────────

interface ApiKnocker {
  id: string;
  givenName: string;
  familyName: string;
  initials: string;
  email: string; // masked
  status: string; // 'invited' | 'active' | 'suspended'
  createdAt: string;
  lastLoginAt: string | null;
}

interface InviteResult {
  user: { id: string; givenName: string; familyName: string; initials: string; email: string };
  inviteToken: string;
  inviteExpiresAt: string;
}

function statusTone(status: string): 'success' | 'warn' | 'muted' {
  if (status === 'active') return 'success';
  if (status === 'invited') return 'warn';
  return 'muted';
}

function statusLabel(status: string): string {
  if (status === 'active') return 'Active';
  if (status === 'invited') return 'Invited';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TeamPage({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  const [knockers, setKnockers] = useState<ApiKnocker[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/knockers`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load the team — please retry.');
        setKnockers([]);
        return;
      }
      const data = (await res.json()) as { knockers: ApiKnocker[] };
      setKnockers(data.knockers);
    } catch {
      setLoadError('Could not load the team — please retry.');
      setKnockers([]);
    }
  }, [params.slug]);

  useEffect(() => {
    if (firstRun.isFirstRun) return;
    void load();
  }, [firstRun.isFirstRun, load]);

  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Team">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <TeamEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const rows = knockers ?? [];
  const activeCount = rows.filter((k) => k.status === 'active').length;
  const invitedCount = rows.filter((k) => k.status === 'invited').length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Team">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Invite a knocker to give them a Knocker iOS login. They receive a set-password link, set
            a password, and appear here as <span className="font-semibold">Active</span>. Knockers
            see only their own leads, shifts, and assigned territories.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard
            label="Knockers"
            value={rows.length}
            hint={`${activeCount} active`}
          />
          <KpiCard label="Active logins" value={activeCount} />
          <KpiCard
            label="Pending invites"
            value={invitedCount}
            hint={invitedCount > 0 ? 'awaiting set-password' : 'all accepted'}
          />
        </div>

        <Section
          title="Knockers"
          subtitle="Every knocker with a Knocker iOS login for this account"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source={knockers ? 'live' : 'fixture'} />
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={13} />}
                onClick={() => setInviteOpen(true)}
              >
                Invite knocker
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
          ) : knockers === null ? (
            <div className="px-6 py-10 text-center text-[12px] text-muted">Loading knockers…</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <UserPlus size={22} className="text-soft mx-auto mb-2" aria-hidden />
              <div className="text-[13px] font-semibold text-ink mb-1">No knockers yet</div>
              <div className="text-[12px] text-muted max-w-sm mx-auto">
                Invite your first knocker to give them a Knocker iOS login. They&apos;ll show up here
                once they accept.
              </div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Knocker</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{m.initials}</span>
                        <span className="text-[13px] text-ink">
                          {m.givenName} {m.familyName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(m.status)}>{statusLabel(m.status)}</StatusPill>
                    </td>
                    <td className="text-[12px] text-muted">{m.email}</td>
                    <td className="text-[12px] text-soft">
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      {inviteOpen && (
        <InviteKnockerModal
          slug={params.slug}
          onClose={() => setInviteOpen(false)}
          onInvited={() => void load()}
        />
      )}
    </AccountShell>
  );
}

function InviteKnockerModal({
  slug,
  onClose,
  onInvited,
}: {
  slug: string;
  onClose: () => void;
  onInvited: () => void;
}): JSX.Element {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The link the manager sends; the iOS app / web accept-invite page reads the
  // token and POSTs it + a password to /v1/users/accept-invite.
  const inviteLink = result
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${encodeURIComponent(result.inviteToken)}`
    : '';

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(slug)}/knockers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          givenName: givenName.trim(),
          familyName: familyName.trim(),
          email: email.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not send the invite — please check the details.');
        return;
      }
      const data = (await res.json()) as InviteResult;
      setResult(data);
      onInvited();
      toast.success('Invite created — copy the link to send it');
    } catch {
      setError('Network error — please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the link manually');
    }
  }

  const canSubmit =
    givenName.trim().length > 0 && familyName.trim().length > 0 && /.+@.+\..+/.test(email.trim());

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Invite knocker"
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line2">
          <div className="flex items-center gap-2">
            <UserPlus size={14} className="text-accent" aria-hidden />
            <div className="text-[14px] font-semibold text-ink">Invite knocker</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={14} className="text-muted" aria-hidden />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-[13px] text-ink">
              <Check size={15} className="text-emerald-500" aria-hidden />
              Invite created for{' '}
              <span className="font-semibold">
                {result.user.givenName} {result.user.familyName}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                Set-password link · send this to the knocker
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] bg-paper border border-line2 rounded-lg px-3 py-2 text-ink break-all">
                  {inviteLink}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={copied ? <Check size={13} /> : <Copy size={13} />}
                  onClick={() => void copyLink()}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="text-[11px] text-muted">
                Expires {new Date(result.inviteExpiresAt).toLocaleString()}. The knocker sets a
                password to activate their Knocker iOS login.
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                name="givenName"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                autoFocus
                required
              />
              <Input
                label="Last name"
                name="familyName"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
              />
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftSlot={<Mail size={13} aria-hidden />}
              required
            />
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
                Send invite
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
