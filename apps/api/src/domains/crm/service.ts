/**
 * CRM Sequence service — create templates + enroll leads.
 *
 * After enrolling leads, immediately enqueues the first `lead-sequence` BullMQ
 * job for each new enrollment. Subsequent steps are scheduled by the worker
 * itself after each step completes.
 */
import type { RegionCode } from '@prisma/client';
import { Problems, ProblemError } from '@d2d/shared-utils';
import type { CreateSequenceRequest, EnrollSequenceRequest } from '@d2d/shared-types';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/service';
import { scheduleSequenceStep } from '../../workers/lead-sequence.worker';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface SequencePublic {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  steps: unknown[];
  status: string;
  createdAt: string;
}

export interface EnrollmentPublic {
  id: string;
  sequenceId: string;
  leadIds: string[];
  enrolledCount: number;
  skippedCount: number; // already-enrolled leads not re-enrolled
  status: string;
  startAt: string;
}

function toSequencePublic(row: {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  stepsJson: unknown;
  status: string;
  createdAt: Date;
}): SequencePublic {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    steps: Array.isArray(row.stepsJson) ? row.stepsJson : [],
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Generate a short prefixed ULID-style id. */
function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export async function createSequence(
  input: CreateSequenceRequest,
  actor: ActorContext,
): Promise<SequencePublic> {
  const id = genId('seq');
  const row = await prisma().$transaction(async (tx) => {
    const created = await tx.crmSequence.create({
      data: {
        id,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        name: input.name,
        description: input.description ?? null,
        stepsJson: input.steps as object[],
        status: 'active',
      },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'crm_sequence.created',
      resourceType: 'CrmSequence',
      resourceId: id,
      beforeJson: {},
      afterJson: { name: input.name, stepCount: input.steps.length },
    });
    return created;
  });
  return toSequencePublic(row);
}

export async function enrollLeadsInSequence(
  sequenceId: string,
  input: EnrollSequenceRequest,
  actor: ActorContext,
): Promise<EnrollmentPublic> {
  // Load + assert tenant scope on the sequence.
  const sequence = await prisma().crmSequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) throw new ProblemError(Problems.notFound('CrmSequence', sequenceId));
  if (sequence.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(sequence.orgId));
  }
  if (sequence.status !== 'active') {
    throw new ProblemError(Problems.conflict('Cannot enroll into an archived sequence'));
  }

  // Verify all leads belong to the same org (cross-tenant guard).
  const leads = await prisma().lead.findMany({
    where: { id: { in: input.leadIds }, orgId: actor.orgId },
    select: { id: true },
  });
  if (leads.length !== input.leadIds.length) {
    throw new ProblemError(Problems.validation('One or more lead IDs not found or not accessible'));
  }

  const startAt = input.startAt ? new Date(input.startAt) : new Date();

  // Upsert enrollments — skip already-enrolled leads (unique constraint).
  let enrolledCount = 0;
  let skippedCount = 0;
  const enrollmentIds: string[] = [];

  await prisma().$transaction(async (tx) => {
    for (const lead of leads) {
      const existing = await tx.crmSequenceEnrollment.findUnique({
        where: { sequenceId_leadId: { sequenceId, leadId: lead.id } },
      });
      if (existing) {
        skippedCount++;
        continue;
      }
      const enrollId = genId('enr');
      await tx.crmSequenceEnrollment.create({
        data: {
          id: enrollId,
          sequenceId,
          leadId: lead.id,
          orgId: actor.orgId,
          currentStep: 0,
          status: 'active',
          startAt,
        },
      });
      enrollmentIds.push(enrollId);
      enrolledCount++;
    }

    if (enrolledCount > 0) {
      await AuditService.recordEvent(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: actor.userId,
        action: 'crm_sequence.enrolled',
        resourceType: 'CrmSequence',
        resourceId: sequenceId,
        beforeJson: {},
        afterJson: {
          enrolledCount,
          skippedCount,
          leadIds: input.leadIds,
          startAt: startAt.toISOString(),
        },
      });
    }
  });

  // Enqueue the first step for every newly-created enrollment.
  // delayMs is the time until `startAt` from now (floor 0 — never negative).
  const firstStepDelayMs = Math.max(0, startAt.getTime() - Date.now());
  await Promise.all(
    enrollmentIds.map((eid) =>
      scheduleSequenceStep({ enrollmentId: eid, stepIndex: 0, delayMs: firstStepDelayMs }),
    ),
  );

  return {
    id: enrollmentIds[0] ?? '',
    sequenceId,
    leadIds: input.leadIds,
    enrolledCount,
    skippedCount,
    status: 'active',
    startAt: startAt.toISOString(),
  };
}
