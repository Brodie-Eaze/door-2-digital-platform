import { KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { apiFetch, type PageResponse, type UserPublic } from '@/lib/api';

function initials(user: UserPublic): string {
  return `${user.givenName.charAt(0)}${user.familyName.charAt(0) || user.givenName.charAt(1) || 'U'}`
    .toUpperCase()
    .slice(0, 2);
}

function statusTone(status: string): 'success' | 'warn' | 'muted' {
  if (status === 'active') return 'success';
  if (status === 'invited') return 'warn';
  return 'muted';
}

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toISOString().slice(0, 10);
}

export default async function KnockersPage(): Promise<JSX.Element> {
  const userPage = await apiFetch<PageResponse<UserPublic>>('/users?role=knocker');
  const knockers = userPage.data;
  const active = knockers.filter((knocker) => knocker.status === 'active');
  const invited = knockers.filter((knocker) => knocker.status === 'invited');
  const archived = knockers.filter((knocker) => knocker.status === 'archived');

  return (
    <OrgShell pageTitle="Knockers">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Active today"
            value={active.length}
            hint={`${knockers.length} on roster`}
            animate={false}
          />
          <KpiCard
            label="Invited"
            value={invited.length}
            hint="pending activation"
            animate={false}
          />
          <KpiCard label="Archived" value={archived.length} animate={false} />
          <KpiCard
            label="More available"
            value={userPage.nextCursor ? 'Yes' : 'No'}
            animate={false}
          />
        </div>

        <Section
          title="Today's roster"
          subtitle="Knocker users from the org roster"
          paddedBody={false}
        >
          {knockers.length === 0 ? (
            <div className="text-[12px] text-muted p-5">
              No knockers yet — they appear when org admins invite field reps.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Region</th>
                  <th>Manager</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {knockers.map((knocker) => (
                  <tr key={knocker.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{initials(knocker)}</span>
                        <span className="text-[13px] text-ink">
                          {knocker.givenName} {knocker.familyName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(knocker.status)}>{knocker.status}</StatusPill>
                    </td>
                    <td>
                      <span className="text-[12px] text-muted">{knocker.email}</span>
                    </td>
                    <td>
                      <span className="mono !w-7 !h-5 !text-[10px]">{knocker.regionCode}</span>
                    </td>
                    <td className="text-[12px] text-muted">
                      {knocker.managerId ? knocker.managerId : '—'}
                    </td>
                    <td className="text-[12px] text-muted numeric">
                      {formatDate(knocker.lastLoginAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </OrgShell>
  );
}
