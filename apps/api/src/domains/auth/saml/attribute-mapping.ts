/**
 * SAML attribute mapping — translate a validated IdP assertion into the fields
 * D2D needs to provision / match a User.
 *
 * SECURITY: this is the privilege-assignment surface for SSO. Two hard rules:
 *   1. An IdP can NEVER mint a `super_admin`. `clampRole` collapses anything
 *      outside `SSO_ASSIGNABLE_ROLES` down to the default (`viewer`), so a
 *      misconfigured or hostile IdP cannot escalate.
 *   2. Roles are only ASSIGNED on first-provision. On a returning user the
 *      caller MUST NOT mutate the stored role from the assertion (handled in
 *      service.ts) — otherwise an IdP could demote/promote an existing admin.
 *
 * Pure + dependency-free (type-only Prisma import) so it unit-tests in
 * isolation without a DB or a real SAML library.
 */
import type { PlatformRole } from '@prisma/client';

/**
 * Roles an external IdP is permitted to grant via SSO. `super_admin` is
 * deliberately excluded — that role is D2D-internal and only minted through
 * the operator console with a hardware key.
 */
export const SSO_ASSIGNABLE_ROLES: ReadonlySet<PlatformRole> = new Set<PlatformRole>([
  'viewer',
  'auditor',
  'accountant',
  'knocker',
  'inside_sales',
  'manager',
  'org_admin',
]);

/** Least-privilege default when the assertion carries no usable role. */
export const SSO_DEFAULT_ROLE: PlatformRole = 'viewer';

/**
 * Per-org mapping config (stored in `SsoConfiguration.attributeMappingJson`).
 * `email` / `givenName` / `familyName` are the SAML attribute NAMES the IdP
 * emits. `role` is the optional attribute name carrying the role; `roleMap`
 * translates raw IdP role strings → D2D role strings before clamping.
 */
export interface SamlAttributeMapping {
  email: string;
  givenName: string;
  familyName: string;
  role?: string;
  roleMap?: Record<string, string>;
}

/** A node-saml Profile is a bag of unknown-typed attributes. */
export type SamlProfileLike = Record<string, unknown>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Coerce an unknown SAML attribute value to a trimmed non-empty string.
 * SAML attributes arrive as `string | string[] | unknown`; multi-valued
 * attributes take the first non-empty entry.
 */
export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        const t = item.trim();
        if (t.length > 0) return t;
      }
    }
  }
  return undefined;
}

/**
 * Collapse a candidate role string to a safe `PlatformRole`. Anything not in
 * `SSO_ASSIGNABLE_ROLES` (including `super_admin`, unknown strings, undefined)
 * becomes `SSO_DEFAULT_ROLE`. This is the escalation guard.
 */
export function clampRole(candidate: string | undefined): PlatformRole {
  if (candidate && SSO_ASSIGNABLE_ROLES.has(candidate as PlatformRole)) {
    return candidate as PlatformRole;
  }
  return SSO_DEFAULT_ROLE;
}

/**
 * Resolve the user's email from the assertion. Precedence:
 *   1. The mapped attribute (`mapping.email`)
 *   2. Well-known SAML keys `email` / `mail`
 *   3. The NameID, but only if it is itself an email address
 * Throws if none is found — an email is mandatory to key the User.
 * Always lower-cased so it matches the deterministic emailDigest.
 */
export function resolveEmail(profile: SamlProfileLike, mapping: SamlAttributeMapping): string {
  const fromMapped = asString(profile[mapping.email]);
  const fromWellKnown = asString(profile.email) ?? asString(profile.mail);
  const nameId = asString(profile.nameID);
  const fromNameId = nameId && EMAIL_RE.test(nameId) ? nameId : undefined;

  const email = fromMapped ?? fromWellKnown ?? fromNameId;
  if (!email || !EMAIL_RE.test(email)) {
    throw new Error('SAML assertion did not contain a usable email address');
  }
  return email.toLowerCase();
}

/**
 * Resolve the D2D role for a FIRST-TIME provision. Reads the mapped role
 * attribute, optionally translates it through `roleMap`, then clamps. Returns
 * `SSO_DEFAULT_ROLE` when no role attribute is configured or present.
 */
export function resolveRole(profile: SamlProfileLike, mapping: SamlAttributeMapping): PlatformRole {
  if (!mapping.role) return SSO_DEFAULT_ROLE;
  const raw = asString(profile[mapping.role]);
  if (!raw) return SSO_DEFAULT_ROLE;
  const translated = mapping.roleMap?.[raw] ?? raw;
  return clampRole(translated);
}

/** The shape consumed by JIT provisioning / matching. */
export interface MappedSamlUser {
  email: string;
  givenName: string;
  familyName: string;
  role: PlatformRole;
}

/**
 * Map a validated SAML profile to the User fields. Names fall back to the
 * email local-part so the NOT-NULL `givenName` / `familyName` columns always
 * get a non-empty value even from a minimal assertion.
 */
export function mapSamlAttributes(
  profile: SamlProfileLike,
  mapping: SamlAttributeMapping,
): MappedSamlUser {
  const email = resolveEmail(profile, mapping);
  const localPart = email.slice(0, email.indexOf('@')) || email;
  const givenName = asString(profile[mapping.givenName]) ?? localPart;
  const familyName = asString(profile[mapping.familyName]) ?? localPart;
  const role = resolveRole(profile, mapping);
  return { email, givenName, familyName, role };
}
