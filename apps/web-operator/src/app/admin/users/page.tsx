'use client';

import { ShieldCheck, UserPlus } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

type Role = 'super_admin' | 'ops_admin' | 'support' | 'read_only';
type UserStatus = 'active' | 'invited' | 'suspended';

interface OperatorUser {
  id: string;
  /** Initials only — PII rail: no full names rendered in the console. */
  initials: string;
  emailHint: string;
  role: Role;
  lastActive: string;
  status: UserStatus;
}

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super admin',
  ops_admin: 'Ops admin',
  support: 'Support',
  read_only: 'Read only',
};

const ROLES: Role[] = ['super_admin', 'ops_admin', 'support', 'read_only'];

const USERS: OperatorUser[] = [
  { id: 'u_be', initials: 'BE', emailHint: 'b•••@door2digital.io', role: 'super_admin', lastActive: '2m ago', status: 'active' },
  { id: 'u_jl', initials: 'JL', emailHint: 'j•••@door2digital.io', role: 'ops_admin', lastActive: '41m ago', status: 'active' },
  { id: 'u_mn', initials: 'MN', emailHint: 'm•••@door2digital.io', role: 'ops_admin', lastActive: '3h ago', status: 'active' },
  { id: 'u_rk', initials: 'RK', emailHint: 'r•••@door2digital.io', role: 'support', lastActive: '1d ago', status: 'active' },
  { id: 'u_ta', initials: 'TA', emailHint: 't•••@door2digital.io', role: 'support', lastActive: 'never', status: 'invited' },
  { id: 'u_pv', initials: 'PV', emailHint: 'p•••@door2digital.io', role: 'read_only', lastActive: '6d ago', status: 'active' },
  { id: 'u_sd', initials: 'SD', emailHint: 's•••@door2digital.io', role: 'read_only', lastActive: '22d ago', status: 'suspended' },
];

function roleTone(role: Role): 'success' | 'info' | 'muted' {
  if (role === 'super_admin') return 'success';
  if (role === 'ops_admin') return 'info';
  return 'muted';
}

function statusPill(status: UserStatus): JSX.Element {
  if (status === 'invited') return <StatusPill tone="warn">Invited</StatusPill>;
  if (status === 'suspended') return <StatusPill tone="danger">Suspended</StatusPill>;
  return <StatusPill tone="success">Active</StatusPill>;
}

export default function UsersPage(): JSX.Element {
  const active = USERS.filter((u) => u.status === 'active').length;
  const admins = USERS.filter((u) => u.role === 'super_admin' || u.role === 'ops_admin').length;
  const pending = USERS.filter((u) => u.status === 'invited').length;

  const cycleRole = (u: OperatorUser): void => {
    const next = ROLES[(ROLES.indexOf(u.role) + 1) % ROLES.length]!;
    toast.info(
      `Change ${u.initials} from ${ROLE_LABEL[u.role]} → ${ROLE_LABEL[next]} — RBAC writes are audit-logged and land in Phase 1.4`,
    );
  };

  return (
    <OperatorShell pageTitle="Operator users & RBAC">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="shrink-0 text-accent" />
            <span className="text-[13px]">
              <strong>Initials-only directory.</strong> Per the PII rail, operator full names and
              full emails are masked in the console. Identity resolution requires the audit-logged
              user-detail view.
            </span>
          </div>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Operator users" value={String(USERS.length)} hint="across all roles" />
          <KpiCard label="Active now" value={String(active)} delta="+1 this week" deltaTone="positive" />
          <KpiCard label="Privileged (admin)" value={String(admins)} hint="super + ops admin" />
          <KpiCard label="Pending invites" value={String(pending)} hint="awaiting acceptance" />
        </div>

        <Section
          title="Operator directory"
          subtitle="Demo data — live RBAC + SSO directory sync lands in Phase 1.4."
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                variant="primary"
                size="sm"
                leftIcon={<UserPlus size={14} />}
                onClick={() => toast.info('Invite operator — directory writes land in Phase 1.4')}
              >
                Invite operator
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last active</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accentSoft text-accent text-[11px] font-semibold">
                        {u.initials}
                      </span>
                      <span className="mono text-[11px] text-muted">{u.id}</span>
                    </div>
                  </td>
                  <td className="mono text-[11px] text-muted">{u.emailHint}</td>
                  <td>
                    <StatusPill tone={roleTone(u.role)}>{ROLE_LABEL[u.role]}</StatusPill>
                  </td>
                  <td className="text-[12px] text-muted">{u.lastActive}</td>
                  <td>{statusPill(u.status)}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => cycleRole(u)}>
                      Change role
                    </Button>
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
