/**
 * Voice-domain Zod schemas — door-conversation recording CAPTURE scaffold.
 *
 * SAFETY: the upload body REQUIRES `consentObtained === true` (the route
 * enforces it again as a hard gate). `audioBase64` is the dev-path inline
 * payload — prod swaps to an S3 presigned PUT (see service BlobStore comment),
 * at which point this field is replaced by a returned upload URL.
 */
import { z } from 'zod';
import { cursorPageQuerySchema, idSchema } from '@d2d/shared-types';

export const createVoiceRecordingRequestSchema = z
  .object({
    clientKnockId: z.string().min(1).max(200).optional(),
    knockId: idSchema.optional(),
    capturedAt: z.string().datetime(),
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
    // ALL-PARTY-CONSENT legal risk (see service.ts file header). Schema accepts
    // a plain boolean so the route can return the PRECISE 422
    // voice-consent-required Problem when it is not true (a schema-level literal
    // would surface as a generic 400 validation error instead).
    consentObtained: z.boolean(),
    // Dev path: base64-encoded m4a audio. Prod = S3 presigned PUT (no inline blob).
    audioBase64: z.string().min(1),
  })
  .strict();
export type CreateVoiceRecordingRequest = z.infer<typeof createVoiceRecordingRequestSchema>;

export const listVoiceRecordingsQuerySchema = cursorPageQuerySchema.extend({
  knockId: idSchema.optional(),
  status: z.enum(['pending', 'processing', 'done', 'failed', 'skipped']).optional(),
});
export type ListVoiceRecordingsQuery = z.infer<typeof listVoiceRecordingsQuerySchema>;
