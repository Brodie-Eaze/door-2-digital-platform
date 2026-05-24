/**
 * Webhook-domain Zod schemas — endpoint registration + delivery list filters.
 */
import { z } from 'zod';
import { cursorPageQuerySchema, webhookEventTypeSchema } from '@d2d/shared-types';

export const createWebhookEndpointRequestSchema = z
  .object({
    url: z.string().url(),
    eventTypes: z.array(webhookEventTypeSchema).min(1).max(50),
    description: z.string().max(500).optional(),
    secretRotationDays: z.number().int().min(7).max(365).default(90),
  })
  .strict();
export type CreateWebhookEndpointRequest = z.infer<typeof createWebhookEndpointRequestSchema>;

export const updateWebhookEndpointRequestSchema = z
  .object({
    url: z.string().url().optional(),
    eventTypes: z.array(webhookEventTypeSchema).min(1).max(50).optional(),
    status: z.enum(['active', 'paused']).optional(),
  })
  .strict();
export type UpdateWebhookEndpointRequest = z.infer<typeof updateWebhookEndpointRequestSchema>;

export const listWebhookEndpointsQuerySchema = cursorPageQuerySchema.extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
});
export type ListWebhookEndpointsQuery = z.infer<typeof listWebhookEndpointsQuerySchema>;

export const listWebhookDeliveriesQuerySchema = cursorPageQuerySchema.extend({
  status: z.enum(['pending', 'delivered', 'failed', 'dlq']).optional(),
});
export type ListWebhookDeliveriesQuery = z.infer<typeof listWebhookDeliveriesQuerySchema>;
