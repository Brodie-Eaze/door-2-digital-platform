/**
 * Notification-domain Zod schemas — sms / email / push request bodies +
 * list filter.
 */
import { z } from 'zod';
import { cursorPageQuerySchema, idSchema, regionCodeSchema } from '@d2d/shared-types';

export const sendSmsRequestSchema = z
  .object({
    to: z.string().regex(/^\+[1-9]\d{6,14}$/, 'must be E.164 (+CCNXXXXXXXXX)'),
    body: z.string().min(1).max(1600),
    regionCode: regionCodeSchema.optional(),
    leadId: idSchema.optional(),
  })
  .strict();
export type SendSmsRequest = z.infer<typeof sendSmsRequestSchema>;

export const sendEmailRequestSchema = z
  .object({
    to: z.string().email(),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(50_000),
    fromBrand: z.string().min(1).max(80).optional(),
    leadId: idSchema.optional(),
  })
  .strict();
export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>;

export const sendPushRequestSchema = z
  .object({
    deviceId: z.string().min(8).max(200),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(500),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type SendPushRequest = z.infer<typeof sendPushRequestSchema>;

export const listNotificationsQuerySchema = cursorPageQuerySchema.extend({
  channel: z.enum(['sms', 'email', 'push']).optional(),
  status: z.enum(['queued', 'sent', 'failed', 'bounced']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
