/**
 * Zod schemas for the SAML SSO surface — config upsert + the IdP ACS POST.
 * Single source of truth for validation at the route edge.
 */
import { z } from 'zod';
import { SsoProvider } from '@prisma/client';

/** Attribute-name mapping config (persisted to attributeMappingJson). */
export const samlAttributeMappingSchema = z.object({
  email: z.string().min(1),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  role: z.string().min(1).optional(),
  roleMap: z.record(z.string(), z.string()).optional(),
});

/**
 * Body for PUT /v1/auth/sso/:orgSlug/config. The IdP signing certificate is
 * supplied as PEM (or base64 DER) text; min length guards against an empty /
 * truncated paste. It is encrypted at rest via the PII vault before storage.
 */
export const upsertSsoConfigSchema = z.object({
  provider: z.nativeEnum(SsoProvider),
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  idpCertificate: z.string().min(40),
  attributeMapping: samlAttributeMappingSchema,
});

/**
 * Body the IdP POSTs to the ACS endpoint (application/x-www-form-urlencoded).
 * `z.string()` rejects array values (a malformed duplicate field), which is
 * the behaviour we want. RelayState is required — we always send a signed one.
 */
export const acsBodySchema = z.object({
  SAMLResponse: z.string().min(1),
  RelayState: z.string().min(1),
});

export type UpsertSsoConfigInput = z.infer<typeof upsertSsoConfigSchema>;
export type AcsBodyInput = z.infer<typeof acsBodySchema>;
