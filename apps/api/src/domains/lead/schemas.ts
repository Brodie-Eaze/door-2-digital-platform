/**
 * Lead-domain Zod schemas.
 *
 * PII fields (givenName, familyName, email, phone) flow through as
 * plaintext for the moment — Agent 15 wraps them in the pii-vault.
 */
import { z } from 'zod';
import {
  idSchema,
  verticalSchema,
  leadStatusSchema,
  consentChannelSchema,
  cursorPageQuerySchema,
} from '@d2d/shared-types';

export const createLeadRequestSchema = z
  .object({
    sourceKnockId: idSchema.optional(),
    addressId: idSchema.optional(),
    vertical: verticalSchema,
    campaignId: idSchema.optional(),
    assignedToId: idSchema.optional(),
    givenName: z.string().min(1).max(200),
    familyName: z.string().min(1).max(200),
    email: z.string().email().toLowerCase().max(320).optional(),
    phone: z.string().max(50).optional(),
    consentChannels: z.array(consentChannelSchema).optional(),
    notes: z.string().max(4000).optional(),
  })
  .strict();
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>;

export const updateLeadRequestSchema = z
  .object({
    status: leadStatusSchema.optional(),
    assignedToId: idSchema.optional(),
  })
  .strict();
export type UpdateLeadRequest = z.infer<typeof updateLeadRequestSchema>;

export const assignLeadRequestSchema = z
  .object({
    userId: idSchema,
    reason: z.string().max(500).optional(),
  })
  .strict();
export type AssignLeadRequest = z.infer<typeof assignLeadRequestSchema>;

export const leadActivityRequestSchema = z
  .object({
    type: z.enum(['call', 'sms', 'email', 'note', 'sequence_step']),
    outcome: z.string().max(200).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type LeadActivityRequest = z.infer<typeof leadActivityRequestSchema>;

export const listLeadsQuerySchema = cursorPageQuerySchema.extend({
  status: leadStatusSchema.optional(),
  assignedToId: idSchema.optional(),
  vertical: verticalSchema.optional(),
  campaignId: idSchema.optional(),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
