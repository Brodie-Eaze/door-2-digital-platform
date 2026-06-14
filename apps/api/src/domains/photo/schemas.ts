/**
 * Photo-domain Zod schemas — KnockPhoto capture + list.
 *
 * The native Knocker app takes a picture of every property it knocks and POSTs
 * it here as base64 (the dev blob path). This is the core data-company capture:
 * collect and hold all of it. The image bytes never round-trip through the JSON
 * list/metadata endpoints — only `GET /:id/raw` streams the binary back.
 *
 * `orgId` / `userId` / `regionCode` are taken from the authenticated principal
 * (see service + routes) and are NEVER accepted from the body — the wire shape
 * here deliberately has no place to put them.
 */
import { z } from 'zod';

/** Content types we accept for a captured property photo (dev path). */
export const photoContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
export type PhotoContentType = z.infer<typeof photoContentTypeSchema>;

export const createPhotoRequestSchema = z
  .object({
    // The app generates a client-side knock UUID at knock-time; the server
    // Knock id (knk_*) is filled in later once the knock batch reconciles.
    clientKnockId: z.string().min(1).max(200).optional(),
    knockId: z.string().min(1).max(200).optional(),
    // ISO-8601 capture timestamp from the device.
    capturedAt: z.string().datetime(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    // PII — captured address context for the property.
    addressLine: z.string().min(1).max(500).optional(),
    contentType: photoContentTypeSchema.optional(),
    // The raw image, base64-encoded (dev path). Prod swaps this for an S3
    // presigned PUT and a `storageKey` confirmation (see BlobStore seam).
    imageBase64: z.string().min(1),
  })
  .strict();
export type CreatePhotoRequest = z.infer<typeof createPhotoRequestSchema>;

/**
 * List filter — narrow by the knock the photo belongs to (client or server id)
 * or a `since` watermark. Metadata only; never returns bytes. Cursor cap 100.
 */
export const listPhotosQuerySchema = z
  .object({
    clientKnockId: z.string().min(1).max(200).optional(),
    knockId: z.string().min(1).max(200).optional(),
    since: z.string().datetime().optional(),
    cursor: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().positive().max(100).default(100),
  })
  .strict();
export type ListPhotosQuery = z.infer<typeof listPhotosQuerySchema>;
