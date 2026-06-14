/**
 * Lead-sequence worker — executes one step at a time for each CRM sequence
 * enrollment, advancing `currentStep` and scheduling the next step with a
 * BullMQ delayed job.
 *
 * Queue name: `lead-sequence`
 * Job payload: `{ enrollmentId: string; stepIndex: number }`
 *
 * Step schema (from CrmSequence.stepsJson):
 *   { order: number; channel: 'email'|'sms'; delayHours: number; body?: string; templateId?: string }
 *
 * Invariants:
 *   - Idempotency guard: skip if enrollment.currentStep !== job.stepIndex.
 *     This means a replayed or stale job is a no-op rather than a double-send.
 *   - Notification dispatch writes a NotificationLog row (status='queued').
 *     An external send-worker (Twilio/Resend) picks those rows up; this worker
 *     never calls a provider API directly.
 *   - All DB mutations (currentStep advance + audit event) happen in one
 *     transaction. The next-step job is added AFTER the transaction commits so
 *     we never schedule a future step that references uncommitted state.
 *
 * Export pattern: `startLeadSequenceWorker()` rather than top-level side-effects
 * so test environments without real Redis can import without crashing.
 */
import { createHmac } from 'node:crypto';
import { Worker, Queue } from 'bullmq';
import type { Prisma, RegionCode } from '@prisma/client';
import { newId } from '@d2d/shared-utils';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { AuditService } from '../domains/audit/service';

export const LEAD_SEQUENCE_QUEUE = 'lead-sequence';

export interface LeadSequenceJobPayload {
  enrollmentId: string;
  stepIndex: number;
}

/** Shape of one step inside CrmSequence.stepsJson */
interface SequenceStep {
  order: number;
  channel: 'email' | 'sms';
  delayHours: number;
  body?: string;
  subject?: string;
  templateId?: string;
}

let _queue: Queue | null = null;

/** Returns the singleton producer queue. Call this from outside the worker. */
export function getLeadSequenceQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(LEAD_SEQUENCE_QUEUE, { connection: redis() });
  }
  return _queue;
}

/**
 * Enqueue a sequence step job.
 *
 * `delayMs` defaults to 0 (immediate). Use `step.delayHours * 3600 * 1000` for
 * non-first steps.
 */
export async function scheduleSequenceStep(opts: {
  enrollmentId: string;
  stepIndex: number;
  delayMs?: number;
}): Promise<void> {
  const payload: LeadSequenceJobPayload = {
    enrollmentId: opts.enrollmentId,
    stepIndex: opts.stepIndex,
  };
  await getLeadSequenceQueue().add('step', payload, {
    delay: opts.delayMs ?? 0,
    jobId: `seq:${opts.enrollmentId}:step:${opts.stepIndex}`,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  });
}

function hashRecipient(channel: 'email' | 'sms', recipient: string): string {
  return createHmac('sha256', env().PII_HASH_SECRET)
    .update(`${channel}:${recipient.trim().toLowerCase()}`)
    .digest('hex');
}

function previewOf(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length <= 200 ? oneLine : `${oneLine.slice(0, 197)}...`;
}

async function processStep(payload: LeadSequenceJobPayload): Promise<void> {
  const log = logger().child({
    worker: 'lead-sequence',
    enrollmentId: payload.enrollmentId,
    stepIndex: payload.stepIndex,
  });

  // Load enrollment with sequence + lead in one round-trip.
  const enrollment = await prisma().crmSequenceEnrollment.findUnique({
    where: { id: payload.enrollmentId },
    include: {
      sequence: true,
      lead: {
        select: {
          id: true,
          orgId: true,
          regionCode: true,
          email: true,
          phone: true,
          givenName: true,
        },
      },
    },
  });

  if (!enrollment) {
    log.warn('lead-sequence: enrollment not found — skipping');
    return;
  }

  // Skip if enrollment was paused, completed, or cancelled.
  if (enrollment.status !== 'active') {
    log.info({ status: enrollment.status }, 'lead-sequence: enrollment not active — skipping');
    return;
  }

  // Idempotency guard: only process the expected step.
  if (enrollment.currentStep !== payload.stepIndex) {
    log.info(
      { currentStep: enrollment.currentStep, expected: payload.stepIndex },
      'lead-sequence: currentStep mismatch — stale job, skipping',
    );
    return;
  }

  // Parse + sort steps.
  const rawSteps = Array.isArray(enrollment.sequence.stepsJson)
    ? (enrollment.sequence.stepsJson as unknown as SequenceStep[])
    : [];
  const steps = [...rawSteps].sort((a, b) => a.order - b.order);

  const step = steps[payload.stepIndex];
  if (!step) {
    log.warn(
      { stepIndex: payload.stepIndex, totalSteps: steps.length },
      'lead-sequence: step index out of range',
    );
    return;
  }

  const lead = enrollment.lead;

  // Resolve recipient from lead plaintext PII (vault-decrypted path deferred
  // until WebAuthn hardware-key gate is implemented for system actors).
  let recipient: string | null = null;
  if (step.channel === 'email') {
    recipient = lead.email ?? null;
  } else if (step.channel === 'sms') {
    recipient = lead.phone ?? null;
  }

  if (!recipient) {
    log.warn(
      { channel: step.channel, leadId: lead.id },
      'lead-sequence: lead has no recipient for this channel — skipping step but advancing',
    );
  }

  const orgId = enrollment.orgId;
  const regionCode = lead.regionCode as RegionCode;
  const isLastStep = payload.stepIndex >= steps.length - 1;

  // Write notification log row + advance enrollment in one transaction.
  await prisma().$transaction(async (tx) => {
    // Dispatch notification (if we have a recipient).
    if (recipient) {
      const notifId = newId('nlg');
      const body = step.body ?? `You have a message from our team, ${lead.givenName}.`;
      const recipientHash = hashRecipient(step.channel, recipient);

      await (tx as Prisma.TransactionClient).notificationLog.create({
        data: {
          id: notifId,
          orgId,
          regionCode,
          channel: step.channel,
          recipientHash,
          subject: step.channel === 'email' ? (step.subject ?? 'Message from our team') : null,
          bodyPreview: previewOf(body),
          fromBrand: null,
          status: 'queued',
          payload: {
            enrollmentId: enrollment.id,
            sequenceId: enrollment.sequenceId,
            leadId: lead.id,
            stepIndex: payload.stepIndex,
            ...(step.templateId && { templateId: step.templateId }),
            // Full body stored in payload so the send-worker can read it without a
            // round-trip back to the sequence definition.
            body,
          } as Prisma.InputJsonValue,
        },
      });

      await AuditService.recordEvent(tx, {
        orgId,
        regionCode,
        actorUserId: null, // system actor
        action: `crm_sequence.step_dispatched`,
        resourceType: 'CrmSequenceEnrollment',
        resourceId: enrollment.id,
        afterJson: {
          stepIndex: payload.stepIndex,
          channel: step.channel,
          notifId,
          recipientHash,
        },
      });
    }

    // Advance currentStep.
    const nextStep = payload.stepIndex + 1;
    const newStatus = isLastStep ? 'completed' : 'active';

    await (tx as Prisma.TransactionClient).crmSequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStep: nextStep,
        status: newStatus,
        ...(isLastStep && { completedAt: new Date() }),
      },
    });

    if (isLastStep) {
      await AuditService.recordEvent(tx, {
        orgId,
        regionCode,
        actorUserId: null,
        action: 'crm_sequence.completed',
        resourceType: 'CrmSequenceEnrollment',
        resourceId: enrollment.id,
        afterJson: { totalSteps: steps.length },
      });
    }
  });

  log.info(
    { stepIndex: payload.stepIndex, channel: step.channel, isLastStep },
    'lead-sequence: step processed',
  );

  // Schedule the next step AFTER the transaction commits.
  if (!isLastStep) {
    const nextStepDef = steps[payload.stepIndex + 1];
    const delayMs = Math.max(0, (nextStepDef?.delayHours ?? 0) * 3600 * 1000);
    await scheduleSequenceStep({
      enrollmentId: enrollment.id,
      stepIndex: payload.stepIndex + 1,
      delayMs,
    });
    log.info({ nextStep: payload.stepIndex + 1, delayMs }, 'lead-sequence: next step scheduled');
  }
}

export function startLeadSequenceWorker(): void {
  const connection = redis();

  const worker = new Worker(
    LEAD_SEQUENCE_QUEUE,
    async (job) => {
      const payload = job.data as LeadSequenceJobPayload;
      await processStep(payload);
    },
    {
      connection,
      // Concurrency of 5: sequence steps are DB-bound and mostly independent
      // across enrollments, so modest parallelism is safe.
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, data: job?.data, err }, 'lead-sequence: job failed');
  });

  worker.on('completed', (job) => {
    logger().debug({ jobId: job.id }, 'lead-sequence: job completed');
  });
}
