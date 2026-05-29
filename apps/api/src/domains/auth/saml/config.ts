/**
 * SAML SP configuration assembly.
 *
 * Derives the SP entityId + ACS URL from SAML_SP_BASE_URL (so they're stable
 * and match what we publish in SP metadata to the IdP), and constructs a
 * node-saml `SAML` instance per org from the stored SsoConfiguration.
 *
 * The IdP signing certificate is encrypted at rest via the PII vault with the
 * AAD bound to the SsoConfiguration row id — co-located here so encrypt and
 * decrypt always use the same (rowType, rowId) and the AAD check holds.
 */
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import type { SsoConfiguration } from '@prisma/client';
import { env } from '../../../config/env';
import { PiiVaultService, type EncryptedField } from '../../pii-vault/service';

const PII_ROW_TYPE = 'SsoConfiguration';

/** Public origin of THIS API (no trailing slash). */
export function spBaseUrl(): string {
  return env().SAML_SP_BASE_URL.replace(/\/+$/, '');
}

/** SP entityId published to the IdP — also serves the SP metadata document. */
export function entityIdFor(slug: string): string {
  return `${spBaseUrl()}/v1/auth/sso/${slug}/metadata`;
}

/** Assertion Consumer Service URL the IdP POSTs the SAMLResponse to. */
export function acsUrlFor(slug: string): string {
  return `${spBaseUrl()}/v1/auth/sso/${slug}/acs`;
}

/**
 * Encrypt an IdP certificate (PEM/DER text) for storage. Returns the
 * JSON-stringified EncryptedField to persist in `certificateKey`.
 */
export function encryptIdpCert(configId: string, pem: string): string {
  const field = PiiVaultService.encryptForRow(PII_ROW_TYPE, configId, pem);
  return JSON.stringify(field);
}

/** Decrypt the stored IdP certificate back to PEM/DER text. */
export function decryptIdpCert(config: Pick<SsoConfiguration, 'id' | 'certificateKey'>): string {
  const field = JSON.parse(config.certificateKey) as EncryptedField;
  return PiiVaultService.decrypt(field, PII_ROW_TYPE, config.id);
}

/**
 * Build a per-org node-saml SAML instance.
 *
 * Security posture:
 *   - `wantAssertionsSigned: true` — the assertion MUST be signed.
 *   - `wantAuthnResponseSigned: false` — many IdPs (Okta default) sign only
 *     the assertion, not the response envelope. Assertion signing is the part
 *     that authenticates the subject, so this is safe and broadly compatible.
 *   - `idpIssuer` is verified against the assertion's Issuer.
 *   - `audience` pinned to our SP entityId so an assertion minted for another
 *     SP is rejected.
 *   - `validateInResponseTo: never` (stateless SP; see relay-state.ts note).
 */
export function buildSaml(config: SsoConfiguration, slug: string): SAML {
  const idpCert = decryptIdpCert(config);
  return new SAML({
    callbackUrl: acsUrlFor(slug),
    entryPoint: config.ssoUrl,
    issuer: entityIdFor(slug),
    idpCert,
    idpIssuer: config.entityId,
    audience: entityIdFor(slug),
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.never,
    acceptedClockSkewMs: 5000,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  });
}
