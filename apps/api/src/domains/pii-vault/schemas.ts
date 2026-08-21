/**
 * PII Vault Zod schemas — unmask request, approval, reveal.
 */
import { z } from 'zod';

export const unmaskRowTypeSchema = z.enum(['Lead', 'Donation', 'Sale', 'Conversion']);
export const unmaskFieldSchema = z.enum(['email', 'phone', 'address', 'fullName', 'paymentLast4']);

export const unmaskRequestInputSchema = z
  .object({
    rowType: unmaskRowTypeSchema,
    rowId: z.string().min(20).max(120),
    fields: z.array(unmaskFieldSchema).min(1).max(5),
    justification: z.string().min(10).max(500),
  })
  .strict();
export type UnmaskRequestInput = z.infer<typeof unmaskRequestInputSchema>;

export const unmaskApproveInputSchema = z
  .object({
    approved: z.boolean().default(true),
    note: z.string().max(500).optional(),
  })
  .strict();
export type UnmaskApproveInput = z.infer<typeof unmaskApproveInputSchema>;

export const unmaskRevealInputSchema = z
  .object({
    grantToken: z.string().min(20).max(120),
  })
  .strict();
export type UnmaskRevealInput = z.infer<typeof unmaskRevealInputSchema>;

/** Shape of an AES-256-GCM vault blob (all fields base64-encoded). */
const encryptedFieldSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  dekWrapped: z.string().min(1),
  dekIv: z.string().min(1),
  dekAuthTag: z.string().min(1),
  aad: z.string().min(1),
  digest: z.string().min(1),
});

/**
 * Operator-tier direct decryption — super_admin only, every call audited.
 * Bypasses the dual-control JIT unmask flow; intended for bulk ops / support
 * tooling only. The (rowType, rowId) pair must match the AAD baked into the
 * vault blob or decryption will fail with an auth-tag mismatch.
 */
export const directDecryptInputSchema = z
  .object({
    rowType: unmaskRowTypeSchema,
    rowId: z.string().min(20).max(120),
    vaultBlob: encryptedFieldSchema,
    reason: z.string().min(10).max(500),
  })
  .strict();
export type DirectDecryptInput = z.infer<typeof directDecryptInputSchema>;
