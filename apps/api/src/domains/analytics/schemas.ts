/**
 * Analytics-domain Zod schemas — the warehouse outbox read/export surface.
 *
 *   GET /v1/analytics/events   cursor-paginated flat event stream (filters)
 *   GET /v1/analytics/export   NDJSON drain of UNSHIPPED events (warehouse sink)
 *
 * These are READ contracts only — analytics events are append-only and are
 * written by other domains via `emitAnalyticsEvent` (see service.ts), never via
 * an HTTP body. So there is no create/update request schema here on purpose.
 */
import { z } from 'zod';

/**
 * GET /events query. Cursor pagination caps at 500 (vs the shared 200 default)
 * because the data team pulls this in larger pages than the operator UIs do.
 * `eventType` filters to one stream; `since` is an ISO-8601 lower bound on
 * `occurredAt` for incremental polling.
 */
export const listEventsQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    eventType: z.string().min(1).max(64).optional(),
    since: z.string().datetime().optional(),
  })
  .strict();
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

/**
 * GET /export query. `limit` caps the at-least-once drain batch so a single
 * pull (and the tenantTx that marks rows shipped) stays bounded. Default 5000,
 * hard cap 5000 — the warehouse sink loops until it gets an empty batch.
 */
export const exportQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(5000).default(5000),
    eventType: z.string().min(1).max(64).optional(),
  })
  .strict();
export type ExportQuery = z.infer<typeof exportQuerySchema>;
