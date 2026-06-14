/**
 * Notification routes — Phase 1.3 real (queue path).
 *
 *   POST  /v1/notifications/sms                send SMS (E.164 required) — org_admin|manager
 *   POST  /v1/notifications/email              send email
 *   POST  /v1/notifications/push               push notification — super_admin only
 *   GET   /v1/notifications                    list (cursor-paginated, filters)
 *
 * Phase 1.2 worker landing target: actual provider dispatch. For now we
 * persist a NotificationLog row (status='queued') and return 202.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { listInbox, listNotifications, sendEmail, sendPush, sendSms } from './service';
import {
  listNotificationsQuerySchema,
  sendEmailRequestSchema,
  sendPushRequestSchema,
  sendSmsRequestSchema,
} from './schemas';

const SMS_ROLES = new Set(['super_admin', 'org_admin', 'manager']);
const EMAIL_ROLES = new Set(['super_admin', 'org_admin', 'manager']);
const PUSH_ROLES = new Set(['super_admin']);

function requireRole(role: string, allowed: Set<string>): void {
  if (!allowed.has(role)) {
    throw new ProblemError(Problems.forbidden('Role not permitted for this notification channel'));
  }
}

export async function registerNotification(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'notification', status: 'live', phase: '1.3' }));

  // POST /v1/notifications/sms
  app.post('/sms', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, SMS_ROLES);
    const body = sendSmsRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const notification = await sendSms(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 202, body: { notification } };
      },
    });
  });

  // POST /v1/notifications/email
  app.post('/email', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, EMAIL_ROLES);
    const body = sendEmailRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const notification = await sendEmail(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 202, body: { notification } };
      },
    });
  });

  // POST /v1/notifications/push
  app.post('/push', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, PUSH_ROLES);
    const body = sendPushRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const notification = await sendPush(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 202, body: { notification } };
      },
    });
  });

  // GET /v1/notifications/inbox — authed user's inbox (native Knocker app)
  app.get('/inbox', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const messages = await listInbox({
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(messages);
  });

  // GET /v1/notifications
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listNotificationsQuerySchema.parse(req.query);
    const result = await listNotifications(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });
}
