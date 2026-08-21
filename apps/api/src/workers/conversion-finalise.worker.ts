/**
 * Conversion-finalise worker — assigns receipt numbers to donation conversions
 * and fires the outbound webhook for every finalised conversion.
 *
 * This worker is driven by jobs pushed into the `conversion-finalise` queue
 * by `createConversion`. It is NOT a cron worker — each job corresponds to
 * one conversion that needs finalisation after the payment gateway has
 * confirmed the transaction (paymentExternalId is set).
 *
 * Processing steps per job:
 *   1. Load the conversion with its donation (if any) and check whether a
 *      WebhookDelivery already exists for this conversionId event — if so,
 *      skip to avoid double-firing.
 *   2. If donation.receiptNumber is null, generate and assign one:
 *      RCT-{year}-{orgId.slice(-4).toUpperCase()}-{6-char random base-36 uppercase}
 *   3. Enqueue the webhook delivery via `enqueueWebhookDelivery`.
 *   4. Write an append-only AuditEvent `conversion.finalised`.
 *
 * Idempotency: if receipt number already exists AND a webhook delivery row
 * already exists for this conversionId, the job exits gracefully without
 * writing any rows.
 *
 * Export pattern: `startConversionFinaliseWorker()` — no top-level side-effects.
 */
import { randomBytes } from 'node:crypto';
import { Worker } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import {} from '@d2d/shared-utils';
import { AuditService } from '../domains/audit/service';
import { enqueueWebhookDelivery } from '../domains/webhook/service';
import type { RegionCode } from '@prisma/client';

const QUEUE_NAME = 'conversion-finalise';

export interface ConversionFinalisePayload {
  conversionId: string;
  orgId: string;
  regionCode: string;
}

/** Generate the receipt-number random suffix: 6 uppercase base-36 chars. */
function receiptSuffix(): string {
  return randomBytes(4).readUInt32BE(0).toString(36).slice(0, 6).toUpperCase().padEnd(6, '0');
}

async function finaliseConversion(payload: ConversionFinalisePayload): Promise<void> {
  const log = logger().child({ worker: 'conversion-finalise', conversionId: payload.conversionId });

  const conv = await prisma().conversion.findUnique({
    where: { id: payload.conversionId },
    include: { donation: true },
  });

  if (!conv) {
    log.warn(
      { conversionId: payload.conversionId },
      'conversion-finalise: conversion not found — skipping',
    );
    return;
  }

  // Check whether we've already fired a webhook delivery for this conversion
  // event. `eventId` on WebhookDelivery is the conversionId (set by enqueueWebhookDelivery).
  const existingDelivery = await prisma().webhookDelivery.findFirst({
    where: { eventId: payload.conversionId },
    select: { id: true },
  });

  const isDonation = conv.type === 'donation_recurring' || conv.type === 'donation_oneoff';

  const alreadyHasReceipt = isDonation
    ? conv.donation !== null && conv.donation.receiptNumber !== null
    : true; // non-donation conversions don't need receipt numbers

  if (alreadyHasReceipt && existingDelivery) {
    log.info(
      { conversionId: payload.conversionId },
      'conversion-finalise: already finalised — skipping',
    );
    return;
  }

  // Assign receipt number for donation conversions that don't have one yet.
  let receiptNumber: string | null = conv.donation?.receiptNumber ?? null;

  if (isDonation && conv.donation && receiptNumber === null) {
    const year = new Date().getUTCFullYear();
    const orgSuffix = payload.orgId.slice(-4).toUpperCase();
    receiptNumber = `RCT-${year}-${orgSuffix}-${receiptSuffix()}`;

    await prisma().donation.update({
      where: { id: conv.donation.id },
      data: { receiptNumber },
    });

    log.info(
      { conversionId: payload.conversionId, receiptNumber },
      'conversion-finalise: receipt number assigned',
    );
  }

  // Fire the webhook (no-op when org has no active endpoints).
  await enqueueWebhookDelivery({
    orgId: payload.orgId,
    eventType: 'conversion.created',
    eventId: payload.conversionId,
    payload: {
      conversionId: conv.id,
      type: conv.type,
      attributionSource: conv.attributionSource,
      amountCents: conv.amountCents.toString(),
      currency: conv.currency,
      signedAt: conv.signedAt?.toISOString() ?? null,
      receiptNumber: receiptNumber ?? null,
    },
  });

  // Write audit event inside a transaction so the chain hash is consistent.
  await prisma().$transaction(async (tx) => {
    await AuditService.recordEvent(tx, {
      orgId: payload.orgId,
      regionCode: payload.regionCode as RegionCode,
      actorUserId: null,
      action: 'conversion.finalised',
      resourceType: 'Conversion',
      resourceId: payload.conversionId,
      afterJson: {
        receiptNumber: receiptNumber ?? null,
        webhookEnqueued: true,
        type: conv.type,
        amountCents: conv.amountCents.toString(),
      },
    });
  });

  log.info(
    { conversionId: payload.conversionId, receiptNumber, webhookEnqueued: true },
    'conversion-finalise: done',
  );
}

export function startConversionFinaliseWorker(): void {
  const connection = redis();

  const worker = new Worker<ConversionFinalisePayload>(
    QUEUE_NAME,
    async (job) => {
      await finaliseConversion(job.data);
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error(
      { jobId: job?.id, conversionId: job?.data?.conversionId, err },
      'conversion-finalise: job failed',
    );
  });

  worker.on('completed', (job) => {
    logger()
      .child({ worker: 'conversion-finalise' })
      .debug({ jobId: job.id }, 'conversion-finalise: job completed');
  });
}
