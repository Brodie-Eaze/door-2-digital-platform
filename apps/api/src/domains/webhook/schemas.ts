/**
 * Webhook-domain Zod schemas — endpoint registration + delivery list filters.
 *
 * SEC-008: URL validation is enforced at two layers.
 *   1. The Zod schema only checks shape (`z.string().url()`) — easy to
 *      compose, returns a 400 problem on bad strings.
 *   2. The service layer runs `assertSafeWebhookUrl` before persisting,
 *      which enforces the SSRF allowlist: https-only, port 443, no
 *      RFC1918 / loopback / link-local / IPv6 ULA destinations. DNS
 *      resolution at registration time blocks metadata IPs (e.g.
 *      169.254.169.254) and private hosts dressed up in public-looking
 *      DNS names.
 *
 * We deliberately don't put the DNS check inside the Zod schema — async
 * refinements on Zod tie the whole route into the parser lifecycle and
 * complicate error wrapping. Keeping it in the service preserves clean
 * RFC 7807 errors via ProblemError.
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
