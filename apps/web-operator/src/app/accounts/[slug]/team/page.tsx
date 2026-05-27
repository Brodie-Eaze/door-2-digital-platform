import { Plus } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { TeamEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';

const TEAM = [
  {
    name: 'Sarah Harris',
    role: 'org_admin',
    status: 'Online',
    online: true,
    email: 'sarah@hopeforward.org',
  },
  {
    name: 'Brodie',
    role: 'super_admin',
    status: 'Online',
    online: true,
    email: 'brodie@door2digital.com',
  },
  {
    name: 'Jordan Mosley',
    role: 'knocker',
    status: 'On shift',
    online: true,
    email: 'jordan@door2digital.com',
  },
  {
    name: 'Jada Davis',
    role: 'knocker',
    status: 'On shift',
    online: true,
    email: 'jada@door2digital.com',
  },
  {
    name: 'Aaliyah Reed',
    role: 'knocker',
    status: 'On shift',
    online: true,
    email: 'aaliyah@door2digital.com',
  },
  {
    name: 'Tomás Mendez',
    role: 'inside_sales',
    status: 'Online',
    online: true,
    email: 'tomas@door2digital.com',
  },
  {
    name: 'Asha Mehta',
    role: 'inside_sales',
    status: 'Away',
    online: false,
    email: 'asha@door2digital.com',
  },
  {
    name: 'Devon Russell',
    role: 'knocker',
    status: 'Idle',
    online: false,
    email: 'devon@door2digital.com',
  },
  {
    name: 'Mira Chen',
    role: 'accountant',
    status: 'Offline',
    online: false,
    email: 'mira@hopeforward.org',
  },
];

export default function TeamPage({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
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
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Team">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Every user has a role with scoped permissions. Knockers see only their leads. Sales reps
            see their queue. Admins see everything. SSO-federated for enterprise.
          </span>
        </Banner>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Team members"
            value={TEAM.length}
            hint={`${TEAM.filter((t) => t.online).length} online now`}
          />
          <KpiCard label="Knockers" value={TEAM.filter((t) => t.role === 'knocker').length} />
          <KpiCard
            label="Inside sales"
            value={TEAM.filter((t) => t.role === 'inside_sales').length}
          />
          <KpiCard
            label="Admin / finance"
            value={
              TEAM.filter((t) => ['org_admin', 'super_admin', 'accountant'].includes(t.role)).length
            }
          />
        </div>
        <Section
          title="Team roster"
          subtitle="Click any member to manage role + permissions"
          paddedBody={false}
          action={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
              Invite
            </Button>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {TEAM.map((m) => (
                <tr key={m.email}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="mono relative">
                        {m.name
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')}
                        {m.online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-surface" />
                        )}
                      </span>
                      <span className="text-[13px] text-ink">{m.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="tag capitalize">{m.role.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        m.status === 'Online' || m.status === 'On shift'
                          ? 'success'
                          : m.status === 'Away'
                            ? 'warn'
                            : 'muted'
                      }
                    >
                      {m.status}
                    </StatusPill>
                  </td>
                  <td className="text-[12px] text-muted">{m.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </AccountShell>
  );
}
