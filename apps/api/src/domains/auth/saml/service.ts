/**
 * SAML 2.0 SSO service — SP-initiated login + per-org config management.
 *
 * Flow (SP-initiated):
 *   1. GET  /v1/auth/sso/:slug/start  → 302 to the IdP with a signed RelayState
 *   2. IdP authenticates the user, POSTs a signed SAMLResponse to the ACS
 *   3. POST /v1/auth/sso/:slug/acs    → validate, JIT match/provision, issue
 *      a normal D2D session (same issueTokens path as password login, so SSO
 *      sessions are indistinguishable downstream).
 *
 * Security invariants:
 *   - RelayState is HMAC-signed and bound to the org slug (CSRF/replay).
 *   - The assertion signature is verified by node-saml against the stored IdP
 *     cert (encrypted at rest in the PII vault).
 *   - Roles are clamped (`clampRole`) so an IdP can never mint super_admin;
 *     a RETURNING user's role is never mutated from the assertion.
 *   - emailDigest is globally unique → an email already bound to another org
 *     is rejected rather than cross-linked.
 */
import type {
  Org,
  SsoConfiguration,
  SsoProvider,
  User,
  Prisma,
  PlatformRole,
  RegionCode,
} from '@prisma/client';
import { Problems, ProblemError, emailDigest, newId } from '@d2d/shared-utils';
import { prisma, tenantPrismaTx, tenantTx } from '../../../config/db';
import { env } from '../../../config/env';
import { writeAudit } from '../../../shared/audit/write';
import { issueTokens, type IssueUser, type AuthSuccess } from '../service';
import { buildSaml, encryptIdpCert, entityIdFor, acsUrlFor } from './config';
import { signRelayState, verifyRelayState } from './relay-state';
import {
  mapSamlAttributes,
  type SamlAttributeMapping,
  type SamlProfileLike,
} from './attribute-mapping';
import type { UpsertSsoConfigInput } from './schemas';

/** Caller identity for config mutations (from req.principal). */
export interface SsoActor {
  userId: string;
  orgId: string;
  role: string;
  regionCode: string;
}

/** Config view safe to return over the API — NEVER includes the IdP cert. */
export interface SsoConfigPublic {
  orgId: string;
  slug: string;
  provider: SsoProvider;
  status: string;
  idpEntityId: string;
  ssoUrl: string;
  spEntityId: string;
  acsUrl: string;
  lastValidatedAt: Date | null;
}

/** Optional seam so ACS JIT logic is integration-testable without a real IdP. */
export interface AcsDeps {
  validate?: (
    config: SsoConfiguration,
    slug: string,
    samlResponse: string,
  ) => Promise<SamlProfileLike>;
}

/**
 * Flat row returned by the §4b SECURITY DEFINER resolver
 * `app_resolve_user_by_email_digest` (see ../service.ts / the preauth_resolvers
 * migration). SSO JIT match keys on the globally-unique emailDigest BEFORE any
 * org context exists, so a direct User read under d2d_app would deny-by-default
 * (orgId compared against a NULL GUC). The resolver runs as the table owner for
 * this one keyed lookup and hands back the owning orgId so the cross-org guard
 * still fires; we re-enter the belt with org.id for the provisioning write. The
 * resolver also returns passwordHash, which SSO never reads, so it is omitted
 * here — `$queryRaw` only narrows the columns we dereference. Enum columns
 * arrive as text and are re-narrowed when building the session user.
 */
interface ResolvedUserRow {
  id: string;
  orgId: string;
  role: string;
  regionCode: string;
  brandCode: string;
  email: string;
  givenName: string;
  familyName: string;
  status: string;
}

function toPublic(slug: string, cfg: SsoConfiguration): SsoConfigPublic {
  return {
    orgId: cfg.orgId,
    slug,
    provider: cfg.provider,
    status: cfg.status,
    idpEntityId: cfg.entityId,
    ssoUrl: cfg.ssoUrl,
    spEntityId: entityIdFor(slug),
    acsUrl: acsUrlFor(slug),
    lastValidatedAt: cfg.lastValidatedAt,
  };
}

function toIssueUser(u: User): IssueUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    orgId: u.orgId,
    regionCode: u.regionCode,
    brandCode: u.brandCode,
    givenName: u.givenName,
    familyName: u.familyName,
  };
}

/**
 * Load the org + its active SSO config by slug. 404 if no org/config; 403 if
 * the config has been revoked.
 */
export async function loadActiveConfig(
  slug: string,
): Promise<{ org: Org; config: SsoConfiguration }> {
  // Org is a control-plane table (no orgId, no RLS policy), so the public-slug
  // lookup is readable pre-auth even as the non-owner d2d_app role. SsoConfiguration
  // IS RLS-enabled, so it must be read through the belt with the org.id we just
  // derived from the slug — an `include: { ssoConfiguration }` here would return
  // null under d2d_app because no GUC is pinned before a session exists.
  const org = await prisma().org.findUnique({ where: { slug } });
  if (!org) {
    throw new ProblemError(Problems.notFound('SsoConfiguration', slug));
  }
  const config = await tenantPrismaTx(org.id).ssoConfiguration.findUnique({
    where: { orgId: org.id },
  });
  if (!config) {
    throw new ProblemError(Problems.notFound('SsoConfiguration', slug));
  }
  if (config.status === 'revoked') {
    throw new ProblemError(Problems.forbidden('SSO is revoked for this organization'));
  }
  return { org, config };
}

/**
 * Default SAMLResponse validator — real node-saml path. Throws on any
 * signature / structural / audience / clock failure.
 */
async function defaultValidate(
  config: SsoConfiguration,
  slug: string,
  samlResponse: string,
): Promise<SamlProfileLike> {
  const saml = buildSaml(config, slug);
  const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
  if (!profile) {
    throw new Error('SAML response did not yield a profile');
  }
  return profile as unknown as SamlProfileLike;
}

/**
 * Create or update the per-org SsoConfiguration. Authz: an admin of THIS org
 * ONLY — the target org MUST equal the actor's org. There is deliberately NO
 * `super_admin` cross-tenant bypass here: installing an attacker-controlled IdP
 * cert for a victim slug is full account takeover (SP-login as that org), so a
 * forgeable/over-broad super_admin must not be able to reach another tenant's
 * SSO config inline. A genuine platform-operator cross-tenant capability, if
 * ever needed, belongs in a distinct, audited, operator-only path — not a
 * role check spliced into this tenant-facing upsert. The IdP cert is encrypted
 * at rest; a 'revoked' status is never silently flipped back on by an upsert.
 */
export async function upsertSsoConfigurationBySlug(
  slug: string,
  input: UpsertSsoConfigInput,
  actor: SsoActor,
): Promise<SsoConfigPublic> {
  const org = await prisma().org.findUnique({ where: { slug } });
  if (!org) {
    throw new ProblemError(Problems.notFound('Org', slug));
  }
  // Tenant binding: the SSO config's target org MUST be the actor's own org.
  if (actor.orgId !== org.id) {
    throw new ProblemError(Problems.forbidden('Cannot configure SSO for another organization'));
  }

  // Read the current config (if any) through the belt. org.id is derived from the
  // public slug, not from the (possibly cross-org super_admin) actor, so this is
  // always the correct tenant; a bare include would read null under d2d_app.
  const existing = await tenantPrismaTx(org.id).ssoConfiguration.findUnique({
    where: { orgId: org.id },
  });

  // Reuse the existing row id so the cert AAD stays bound to the same row.
  const configId = existing?.id ?? newId('sso');
  const certificateKey = encryptIdpCert(configId, input.idpCertificate);
  const attributeMappingJson = input.attributeMapping as unknown as Prisma.InputJsonValue;
  const existingStatus = existing?.status;
  const status = existingStatus === 'revoked' ? 'revoked' : (existingStatus ?? 'pending');

  // GUC pinned to org.id so the upsert's WITH CHECK (and the Org/audit co-writes)
  // pass under d2d_app post-cutover.
  const saved = await tenantTx(org.id, async (tx) => {
    const cfg = await tx.ssoConfiguration.upsert({
      where: { orgId: org.id },
      create: {
        id: configId,
        orgId: org.id,
        provider: input.provider,
        entityId: input.entityId,
        ssoUrl: input.ssoUrl,
        certificateKey,
        attributeMappingJson,
        status,
      },
      update: {
        provider: input.provider,
        entityId: input.entityId,
        ssoUrl: input.ssoUrl,
        certificateKey,
        attributeMappingJson,
        status,
      },
    });
    await tx.org.update({ where: { id: org.id }, data: { ssoProvider: input.provider } });
    await writeAudit(tx, {
      orgId: org.id,
      regionCode: org.regionCode,
      actorUserId: actor.userId,
      action: 'auth.sso_config_upserted',
      resourceType: 'SsoConfiguration',
      resourceId: cfg.id,
      metadata: { provider: input.provider, entityId: input.entityId, ssoUrl: input.ssoUrl },
    });
    return cfg;
  });

  return toPublic(org.slug ?? slug, saved);
}

/** Public (cert-free) view of the SSO config, or null if not configured. */
export async function getSsoConfigPublic(slug: string): Promise<SsoConfigPublic | null> {
  const org = await prisma().org.findUnique({ where: { slug } });
  if (!org) return null;
  const config = await tenantPrismaTx(org.id).ssoConfiguration.findUnique({
    where: { orgId: org.id },
  });
  if (!config) return null;
  return toPublic(org.slug ?? slug, config);
}

/** Build the IdP redirect URL for SP-initiated login. */
export async function startSso(slug: string): Promise<{ redirectUrl: string }> {
  const { config } = await loadActiveConfig(slug);
  const saml = buildSaml(config, slug);
  const relayState = signRelayState(slug);
  const redirectUrl = await saml.getAuthorizeUrlAsync(relayState, undefined, {});
  return { redirectUrl };
}

/** Generate this SP's SAML metadata XML for the org. */
export async function samlMetadata(slug: string): Promise<string> {
  const { config } = await loadActiveConfig(slug);
  const saml = buildSaml(config, slug);
  return saml.generateServiceProviderMetadata(null, null);
}

/**
 * Consume an ACS POST: verify RelayState, validate the assertion, JIT
 * match-or-provision the user, and mint a D2D session.
 */
export async function consumeAcs(
  input: {
    slug: string;
    samlResponse: string;
    relayState: string;
    ip?: string;
    userAgent?: string;
  },
  deps: AcsDeps = {},
): Promise<{ session: AuthSuccess; created: boolean }> {
  // 1. RelayState CSRF check — valid signature AND bound to the same slug.
  let relaySlug: string;
  try {
    relaySlug = verifyRelayState(input.relayState).slug;
  } catch {
    throw new ProblemError(Problems.forbidden('Invalid SSO RelayState'));
  }
  if (relaySlug !== input.slug) {
    throw new ProblemError(Problems.forbidden('SSO RelayState does not match the requested org'));
  }

  // 2. Load active config.
  const { org, config } = await loadActiveConfig(input.slug);

  // 3. Validate the SAMLResponse (signature + assertion). Tests inject a seam.
  const validate = deps.validate ?? defaultValidate;
  let profile: SamlProfileLike;
  try {
    profile = await validate(config, input.slug, input.samlResponse);
  } catch {
    throw new ProblemError(Problems.unauthorized('SAML assertion validation failed'));
  }

  // 4. Map attributes (throws if no usable email).
  const mapping = config.attributeMappingJson as unknown as SamlAttributeMapping;
  let mapped;
  try {
    mapped = mapSamlAttributes(profile, mapping);
  } catch {
    throw new ProblemError(Problems.unauthorized('SAML assertion missing required attributes'));
  }

  // 5. JIT match-or-provision, keyed on the globally-unique emailDigest. §4b:
  //    resolve via the SECURITY DEFINER resolver — the IdP's email may belong to
  //    ANY org (the exact cross-org case we must reject), and there is no org
  //    context here, so a direct User read under d2d_app would deny-by-default.
  //    The resolver returns the owning orgId so the cross-org guard still fires.
  const digest = emailDigest(mapped.email, env().PII_SEARCH_KEY);
  const resolvedRows = await prisma().$queryRaw<ResolvedUserRow[]>`
    SELECT * FROM app_resolve_user_by_email_digest(${digest})
  `;
  const existing = resolvedRows[0];

  let userForSession: IssueUser;
  let created = false;
  if (existing) {
    if (existing.orgId !== org.id) {
      // Email belongs to a user in another org — never cross-link via SSO.
      throw new ProblemError(
        Problems.forbidden('This email is registered to a different organization'),
      );
    }
    if (existing.status !== 'active') {
      throw new ProblemError(Problems.forbidden('User is not active'));
    }
    // Returning user: do NOT mutate role from the assertion (anti-escalation).
    // Enum columns arrive from the resolver as text; re-narrow to the session shape.
    userForSession = {
      id: existing.id,
      email: existing.email,
      role: existing.role as PlatformRole,
      orgId: existing.orgId,
      regionCode: existing.regionCode as RegionCode,
      brandCode: existing.brandCode,
      givenName: existing.givenName,
      familyName: existing.familyName,
    };
  } else {
    const userId = newId('usr');
    // GUC pinned to org.id so the User insert's WITH CHECK + the audit co-write
    // pass under d2d_app post-cutover.
    const createdUser = await tenantTx(org.id, async (tx) => {
      const u = await tx.user.create({
        data: {
          id: userId,
          orgId: org.id,
          email: mapped.email,
          emailDigest: digest,
          givenName: mapped.givenName,
          familyName: mapped.familyName,
          role: mapped.role,
          regionCode: org.regionCode,
          brandCode: org.brandCode,
          status: 'active',
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: u.id,
        action: 'auth.sso_provisioned',
        resourceType: 'User',
        resourceId: u.id,
        metadata: { provider: config.provider, role: mapped.role, ip: input.ip },
      });
      return u;
    });
    userForSession = toIssueUser(createdUser);
    created = true;
  }

  // 6. Mint the session (issueTokens owns its own tx + writes the login audit).
  const session = await issueTokens(userForSession, {
    ip: input.ip,
    userAgent: input.userAgent,
    audit: 'auth.sso_login_success',
  });

  // 7. Mark validated + promote pending→active. updateMany with a status guard
  //    so a concurrent revoke is never overwritten. Scoped through the belt so
  //    the GUC admits the row under d2d_app (an un-GUC'd updateMany would match
  //    zero rows post-cutover); the wrapper also ANDs orgId into the where.
  await tenantPrismaTx(org.id).ssoConfiguration.updateMany({
    where: { id: config.id, status: { in: ['pending', 'active'] } },
    data: { lastValidatedAt: new Date(), status: 'active' },
  });

  return { session, created };
}
