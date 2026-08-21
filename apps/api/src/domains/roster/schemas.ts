/**
 * Roster-domain Zod schemas — shift creation + clock-in/out request bodies.
 *
 * `weekStart` is the ISO date of the roster week's Monday ("YYYY-MM-DD");
 * `day` indexes that week (0 = Mon … 6 = Sun); `start`/`end`/`lunch` are
 * wall-clock "HH:MM" strings rendered in the rep's local TZ by the native app.
 */
import { z } from 'zod';
import { idSchema } from '@d2d/shared-types';

/** "YYYY-MM-DD" calendar date (no time component). */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date "YYYY-MM-DD"');

/** "HH:MM" 24-hour wall-clock time. */
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be "HH:MM" 24-hour time');

/** "HH:MM-HH:MM" lunch window. */
const lunchSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, 'must be "HH:MM-HH:MM"');

export const createShiftRequestSchema = z
  .object({
    userId: idSchema,
    territoryId: idSchema.optional(),
    weekStart: isoDateSchema,
    day: z.number().int().min(0).max(6),
    start: hhmmSchema,
    end: hhmmSchema,
    lunch: lunchSchema.optional(),
    account: z.string().min(1).max(120).optional(),
    territory: z.string().min(1).max(120).optional(),
  })
  .strict();
export type CreateShiftRequest = z.infer<typeof createShiftRequestSchema>;

export const clockInRequestSchema = z
  .object({
    latitude: z.number().gte(-90).lte(90).optional(),
    longitude: z.number().gte(-180).lte(180).optional(),
    deviceId: z.string().min(1).max(200),
    appVersion: z.string().min(1).max(40).optional(),
    osVersion: z.string().min(1).max(40).optional(),
    attestationToken: z.string().min(1).max(4096).optional(),
  })
  .strict();
export type ClockInRequest = z.infer<typeof clockInRequestSchema>;

export const clockOutRequestSchema = z.object({}).strict();
export type ClockOutRequest = z.infer<typeof clockOutRequestSchema>;
