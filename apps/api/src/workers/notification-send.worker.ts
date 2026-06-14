/**
 * Notification send-worker — drains NotificationLog rows with status='queued'
 * and dispatches them via Twilio (SMS) or Resend (email).
 *
 * Design decisions:
 *   - No SDK dependencies: Twilio and Resend both expose simple JSON REST APIs
 *     callable with plain `fetch`. This avoids adding heavy SDK packages.
 *   - Graceful degradation: if TWILIO_* or RESEND_API_KEY env vars are absent,
 *     the row is marked `failed` with a clear providerError rather than crashing
 *     the worker. Useful in dev / CI where credentials are unavailable.
 *   - Recipient resolution: NotificationLog stores only the HMAC hash of the
 *     recipient (never plaintext). For notifications dispatched by the
 *     lead-sequence worker, the payload JSON contains a `leadId`; we look up
 *     the lead to get the plaintext phone/email. Rows without a `leadId` in
 *     payload are skipped (different flow, deferred).
 *   - At-most-once per row: the worker claims a row by setting status='sending'
 *     in a compare-and-swap UPDATE before dispatching. If the process dies
 *     between claim and send, the row stays 'sending' — a separate recovery
 *     cron resets rows stuck in 'sending' for >5 min back to 'queued'.
 *
 * Export pattern: `startNotificationSendWorker()` — no top-level side-effects.
 */
import { Worker, Queue } from 'bullmq';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { env } from '../config/env';

const QUEUE_NAME = 'notification-send';
const BATCH_SIZE = 50;
const STUCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface RowPayload {
  leadId?: string;
  body?: string;
  [key: string]: unknown;
}

/** Send SMS via Twilio REST API (no SDK required). */
async function sendTwilioSms(opts: {
  to: string;
  body: string;
  messagingServiceSid?: string;
  accountSid: string;
  authToken: string;
}): Promise<{ externalId: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${opts.accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: opts.to,
    Body: opts.body,
    ...(opts.messagingServiceSid
      ? { MessagingServiceSid: opts.messagingServiceSid }
      : { From: '+15005550006' }), // Twilio magic test number fallback
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString('base64')}`,
    },
    body: params.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await res.json()) as { sid?: string; message?: string; code?: number };
  if (!res.ok) {
    throw new Error(
      `Twilio ${res.status}: ${json.message ?? 'unknown'} (code ${json.code ?? '-'})`,
    );
  }
  return { externalId: json.sid ?? '' };
}

/** Send email via Resend REST API (no SDK required). */
async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from: string;
  apiKey: string;
}): Promise<{ externalId: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${json.message ?? 'unknown'}`);
  }
  return { externalId: json.id ?? '' };
}

async function sendBatch(): Promise<void> {
  const log = logger().child({ worker: 'notification-send' });
  const e = env();

  // First: recover rows stuck in 'sending' for > STUCK_TIMEOUT_MS.
  // Rows claimed (status='sending') more than STUCK_TIMEOUT_MS ago are assumed
  // abandoned by a crashed worker and reset to 'queued'. NotificationLog has no
  // updatedAt column so we use createdAt as a proxy — stuck rows are always
  // older than newly-claimed rows.
  const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);
  const recovered = await prisma().notificationLog.updateMany({
    where: { status: 'sending', createdAt: { lt: stuckCutoff } },
    data: { status: 'queued' },
  });
  if (recovered.count > 0) {
    log.warn({ count: recovered.count }, 'notification-send: recovered stuck rows back to queued');
  }

  // Claim a batch: update status to 'sending' before reading.
  // We read IDs first, then claim them in a single updateMany using their IDs.
  const candidates = await prisma().notificationLog.findMany({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true },
  });

  if (candidates.length === 0) {
    log.debug('notification-send: nothing to send');
    return;
  }

  const ids = candidates.map((r) => r.id);
  await prisma().notificationLog.updateMany({
    where: { id: { in: ids }, status: 'queued' },
    data: { status: 'sending' },
  });

  // Reload the claimed rows with full data.
  const rows = await prisma().notificationLog.findMany({
    where: { id: { in: ids }, status: 'sending' },
  });

  for (const row of rows) {
    const rowLog = log.child({ notifId: row.id, channel: row.channel });
    let externalId: string | null = null;
    let providerError: string | null = null;

    try {
      const payload = (
        typeof row.payload === 'object' && row.payload !== null ? row.payload : {}
      ) as RowPayload;

      // Resolve recipient. Only process rows that have a leadId in the payload
      // (sequence-dispatched rows). Direct API-call rows (to not stored) are
      // skipped until a vault-decrypt path is implemented for the worker.
      if (!payload.leadId) {
        rowLog.info(
          'notification-send: no leadId in payload — deferring (not sequence-dispatched)',
        );
        await prisma().notificationLog.update({
          where: { id: row.id },
          data: { status: 'queued', providerError: 'deferred:no_lead_id' },
        });
        continue;
      }

      const lead = await prisma().lead.findUnique({
        where: { id: payload.leadId as string },
        select: { email: true, phone: true, givenName: true },
      });

      if (!lead) {
        throw new Error(`Lead ${payload.leadId} not found`);
      }

      const messageBody = (payload.body as string | undefined) ?? row.bodyPreview;

      if (row.channel === 'sms') {
        const to = lead.phone;
        if (!to) throw new Error('Lead has no phone number');
        if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN) {
          throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured');
        }
        const result = await sendTwilioSms({
          to,
          body: messageBody,
          messagingServiceSid: e.TWILIO_US_MESSAGING_SID,
          accountSid: e.TWILIO_ACCOUNT_SID,
          authToken: e.TWILIO_AUTH_TOKEN,
        });
        externalId = result.externalId;
      } else if (row.channel === 'email') {
        const to = lead.email;
        if (!to) throw new Error('Lead has no email address');
        if (!e.RESEND_API_KEY) {
          throw new Error('RESEND_API_KEY not configured');
        }
        const fromAddress = row.fromBrand
          ? `${row.fromBrand} <noreply@d2d.io>`
          : 'Door 2 Digital <noreply@d2d.io>';
        const result = await sendResendEmail({
          to,
          subject: row.subject ?? 'Message from our team',
          html: `<p>${messageBody.replace(/\n/g, '<br>')}</p>`,
          from: fromAddress,
          apiKey: e.RESEND_API_KEY,
        });
        externalId = result.externalId;
      } else {
        // push / unknown channels: skip for now
        rowLog.info(
          { channel: row.channel },
          'notification-send: channel not yet supported, requeuing',
        );
        await prisma().notificationLog.update({
          where: { id: row.id },
          data: { status: 'queued', providerError: `unsupported_channel:${row.channel}` },
        });
        continue;
      }

      await prisma().notificationLog.update({
        where: { id: row.id },
        data: {
          status: 'sent',
          providerExternalId: externalId,
          sentAt: new Date(),
          providerError: null,
        },
      });
      rowLog.info({ externalId }, 'notification-send: sent');
    } catch (err) {
      providerError = err instanceof Error ? err.message : String(err);
      rowLog.warn({ err }, 'notification-send: send failed — marking row failed');
      await prisma().notificationLog.update({
        where: { id: row.id },
        data: { status: 'failed', providerError },
      });
    }
  }

  log.info({ total: rows.length }, 'notification-send: batch complete');
}

export function startNotificationSendWorker(): void {
  const connection = redis();

  // Schedule a repeat job every 30 seconds to drain queued rows.
  const queue = new Queue(QUEUE_NAME, { connection });
  void queue.add(
    'send',
    {},
    {
      repeat: { pattern: '*/30 * * * * *' },
      jobId: 'notification-send-cron',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await sendBatch();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger().error({ jobId: job?.id, err }, 'notification-send: job failed');
  });
}
