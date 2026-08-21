/**
 * Lead-routing worker — assigns unassigned `new` leads to inside-sales users
 * by workload (fewest open leads), with alphabetical `id` as a tie-breaker.
 *
 * Queue name: `lead-routing`
 * Cron repeat: every 5 minutes ('*\/5 * * * *')
 *
 * What it does per run:
 *   1. Fetches up to 50 `new` leads with `assignedToId IS NULL`, ordered by
 *      `createdAt ASC` (oldest first).
 *   2. Groups them by org. For each org, loads all Users with
 *      `role='inside_sales' AND status='active'`.
 *   3. Computes open-lead workload per user: count of leads in
 *      (new, contacted, qualified, appointment_set) assigned to them.
 *   4. Assigns each lead to the user with the lowest workload; ties broken by
 *      smallest `id` alphabetically.
 *   5. Emits a `lead_routing.assigned` AuditEvent per lead.
 *   6. Logs a run summary: { routed, skipped, orgCount }.
 *
 * If an org has no active inside_sales users the leads are skipped (not
 * errored) and a warning is logged.
 *
 * Export pattern: `startLeadRoutingWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { LeadStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { AuditService } from '../domains/audit/service';
import type { RegionCode } from '@prisma/client';

const QUEUE_NAME = 'lead-routing';
const BATCH_SIZE = 50;

/** Lead statuses that count toward a user's open workload. */
const OPEN_STATUSES: LeadStatus[] = [
  LeadStatus.new,
  LeadStatus.contacted,
  LeadStatus.qualified,
  LeadStatus.appointment_set,
];

interface LeadRow {
  id: string;
  orgId: string;
  regionCode: RegionCode;
}

interface UserRow {
  id: string;
  orgId: string;
}

async function runRouting(): Promise<void> {
  const log = logger().child({ worker: 'lead-routing' });

  // 1. Fetch the oldest unassigned new leads.
  const leads = await prisma().lead.findMany({
    where: {
      status: 'new',
      assignedToId: null,
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: {
      id: true,
      orgId: true,
      regionCode: true,
    },
  });

  if (leads.length === 0) {
    log.debug('lead-routing: no unassigned leads — nothing to do');
    return;
  }

  // Group leads by org so we only query users once per org.
  const leadsByOrg = new Map<string, LeadRow[]>();
  for (const lead of leads) {
    const bucket = leadsByOrg.get(lead.orgId) ?? [];
    bucket.push(lead as LeadRow);
    leadsByOrg.set(lead.orgId, bucket);
  }

  let routed = 0;
  let skipped = 0;
  const orgCount = leadsByOrg.size;

  // Batch the two per-org READS out of the loop (was an N+1 that fired a user
  // findMany + a workload groupBy for EVERY org, every 5-minute run — thousands
  // of queries at scale). One findMany for all orgs' inside-sales users, one
  // groupBy for all their open-lead workloads; the loop reads from maps.
  const allOrgIds = [...leadsByOrg.keys()];
  const allUsers = await prisma().user.findMany({
    where: { orgId: { in: allOrgIds }, role: 'inside_sales', status: 'active' },
    select: { id: true, orgId: true },
  });
  const usersByOrg = new Map<string, UserRow[]>();
  for (const u of allUsers) {
    const b = usersByOrg.get(u.orgId) ?? [];
    b.push(u);
    usersByOrg.set(u.orgId, b);
  }
  const allUserIds = allUsers.map((u) => u.id);
  const workloadRows = allUserIds.length
    ? await prisma().lead.groupBy({
        by: ['orgId', 'assignedToId'],
        where: {
          orgId: { in: allOrgIds },
          assignedToId: { in: allUserIds },
          status: { in: OPEN_STATUSES },
        },
        _count: { _all: true },
      })
    : [];
  const workloadByOrg = new Map<string, Map<string, number>>();
  for (const row of workloadRows) {
    if (!row.assignedToId) continue;
    const m = workloadByOrg.get(row.orgId) ?? new Map<string, number>();
    m.set(row.assignedToId, row._count._all);
    workloadByOrg.set(row.orgId, m);
  }

  for (const [orgId, orgLeads] of leadsByOrg) {
    const users = usersByOrg.get(orgId) ?? [];

    if (users.length === 0) {
      log.warn(
        { orgId, count: orgLeads.length },
        'lead-routing: no active inside_sales users — skipping org leads',
      );
      skipped += orgLeads.length;
      continue;
    }

    // Workload for each user (open leads already assigned), from the batch.
    const orgWorkload = workloadByOrg.get(orgId);
    const workload = new Map<string, number>();
    for (const u of users) {
      workload.set(u.id, orgWorkload?.get(u.id) ?? 0);
    }

    // 4. Route each lead to the user with the lowest workload (tie: smallest id).
    for (const lead of orgLeads) {
      // Sort users by (workload ASC, id ASC) to pick the best candidate.
      const sorted = [...users].sort((a: UserRow, b: UserRow) => {
        const wa = workload.get(a.id) ?? 0;
        const wb = workload.get(b.id) ?? 0;
        if (wa !== wb) return wa - wb;
        return a.id < b.id ? -1 : 1;
      });

      const assignee = sorted[0];
      if (!assignee) {
        skipped++;
        continue;
      }

      const workloadAtAssignment = workload.get(assignee.id) ?? 0;

      // 5. Update the lead.
      await prisma().$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: lead.id },
          data: { assignedToId: assignee.id },
        });

        // 6. Emit audit event per lead.
        await AuditService.recordEvent(tx, {
          orgId,
          regionCode: lead.regionCode,
          actorUserId: null,
          action: 'lead_routing.assigned',
          resourceType: 'Lead',
          resourceId: lead.id,
          afterJson: {
            assignedToId: assignee.id,
            workloadAtAssignment,
          },
        });
      });

      // Increment in-memory workload so subsequent assignments in the same
      // run reflect the just-made assignment without another DB round-trip.
      workload.set(assignee.id, workloadAtAssignment + 1);

      routed++;
    }
  }

  // 8. Run summary.
  log.info({ routed, skipped, orgCount }, 'lead-routing: run complete');
}

export function startLeadRoutingWorker(): void {
  const connection = redis();

  const queue = new Queue(QUEUE_NAME, { connection });
  // Cron: every 5 minutes.
  void queue.add(
    'route',
    {},
    {
      repeat: { pattern: '*/5 * * * *' },
      jobId: 'lead-routing-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runRouting();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'lead-routing: job failed');
  });
}
