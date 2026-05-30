/**
 * SAML SSO integration tests.
 *
 * The real XML-signature happy path through node-saml needs a signed IdP
 * fixture (deferred). Everything else is covered here:
 *   - config upsert authz + cert encryption round-trip (HTTP)
 *   - SP-initiated start → 302 to the IdP with a RelayState (HTTP)
 *   - SP metadata XML (HTTP)
 *   - ACS rejects a bad RelayState (403) and an unverifiable response (401) (HTTP)
 *   - JIT match / create / cross-org rejection / role-clamp via the
 *     `consumeAcs` validate seam (service, no real IdP needed)
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, truncateAll, teardown } from '../helpers/app';
import { prisma } from '../../src/config/db';
import { setUserPassword } from '../../src/domains/auth/service';
import {
  consumeAcs,
  upsertSsoConfigurationBySlug,
  type SsoActor,
} from '../../src/domains/auth/saml/service';
import { decryptIdpCert } from '../../src/domains/auth/saml/config';
import { signRelayState } from '../../src/domains/auth/saml/relay-state';
import type { SamlProfileLike } from '../../src/domains/auth/saml/attribute-mapping';
import { emailDigest } from '@d2d/shared-utils';

let app: FastifyInstance;

const slug = 'pilot-charlie';
const orgId = 'org_SSO_PILOT';
const otherOrgId = 'org_SSO_OTHER';
const adminId = 'usr_SSO_ADMIN';
const adminEmail = 'admin@pilot.test';
const password = 'CorrectHorseBatteryStaple1!';

// A throwaway PEM-ish cert (>40 chars to pass the schema). node-saml only uses
// it to validate RESPONSES, so the start/metadata/cert-round-trip paths don't
// need a real key.
const FAKE_CERT = 'MIIDdummycertbase64dummycertbase64dummycertbase64dummycertbase64dummycert==';

const attributeMapping = {
  email: 'email',
  givenName: 'firstName',
  familyName: 'lastName',
  role: 'd2dRole',
  roleMap: { 'Org Admin': 'org_admin', 'Field Rep': 'knocker' },
};

function digest(email: string): string {
  return emailDigest(email, process.env.PII_SEARCH_KEY!);
}

const superActor: SsoActor = {
  userId: 'usr_SUPER',
  orgId: 'org_OPS',
  role: 'super_admin',
  regionCode: 'US',
};

/**
 * Org-bound admin actor for the pilot org. After D4 the upsert is strictly
 * org-bound (no super_admin cross-tenant bypass), so config seeding must use an
 * actor whose orgId matches the slug's org.
 */
const pilotAdminActor: SsoActor = {
  userId: adminId,
  orgId,
  role: 'org_admin',
  regionCode: 'US',
};

async function seedOrg(id: string, orgSlug: string | null): Promise<void> {
  await prisma().org.create({
    data: {
      id,
      legalName: id,
      tradingName: id,
      vertical: 'charity',
      type: 'client',
      regionCode: 'US',
      ...(orgSlug ? { slug: orgSlug } : {}),
    },
  });
}

/** Create the org-admin used for HTTP authz, return a Bearer access token. */
async function loginAdmin(): Promise<string> {
  await prisma().user.create({
    data: {
      id: adminId,
      orgId,
      email: adminEmail,
      emailDigest: digest(adminEmail),
      givenName: 'Admin',
      familyName: 'Pilot',
      role: 'org_admin',
      regionCode: 'US',
      status: 'active',
    },
  });
  await setUserPassword(adminId, password);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: adminEmail, password },
  });
  return res.json().accessToken as string;
}

async function configure(): Promise<void> {
  await upsertSsoConfigurationBySlug(
    slug,
    {
      provider: 'okta',
      entityId: 'https://idp.pilot.test/saml/metadata',
      ssoUrl: 'https://idp.pilot.test/saml/sso',
      idpCertificate: FAKE_CERT,
      attributeMapping,
    },
    pilotAdminActor, // org-bound: actor.orgId === slug's org (post-D4)
  );
}

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await teardown();
});

beforeEach(async () => {
  await truncateAll();
  await seedOrg(orgId, slug);
});

describe('PUT /v1/auth/sso/:slug/config (authz + cert at rest)', () => {
  it('rejects an unauthenticated upsert with 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/auth/sso/${slug}/config`,
      payload: {
        provider: 'okta',
        entityId: 'https://idp.pilot.test/saml/metadata',
        ssoUrl: 'https://idp.pilot.test/saml/sso',
        idpCertificate: FAKE_CERT,
        attributeMapping,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('lets an org_admin upsert and never returns the cert', async () => {
    const token = await loginAdmin();
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/auth/sso/${slug}/config`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        provider: 'okta',
        entityId: 'https://idp.pilot.test/saml/metadata',
        ssoUrl: 'https://idp.pilot.test/saml/sso',
        idpCertificate: FAKE_CERT,
        attributeMapping,
      },
    });
    expect(res.statusCode).toBe(200);
    const cfg = res.json().ssoConfiguration;
    expect(cfg.provider).toBe('okta');
    expect(cfg.spEntityId).toContain(`/v1/auth/sso/${slug}/metadata`);
    expect(cfg.acsUrl).toContain(`/v1/auth/sso/${slug}/acs`);
    // The cert must never cross the API boundary.
    expect(JSON.stringify(cfg)).not.toContain(FAKE_CERT);
    expect(cfg.certificateKey).toBeUndefined();
  });

  it('encrypts the cert at rest and decrypts back to the original', async () => {
    await configure();
    const row = await prisma().ssoConfiguration.findUniqueOrThrow({ where: { orgId } });
    // Stored value is an encrypted EncryptedField JSON, not the plaintext.
    expect(row.certificateKey).not.toContain(FAKE_CERT);
    expect(decryptIdpCert(row)).toBe(FAKE_CERT);
  });

  it('forbids an org_admin from configuring a different org', async () => {
    await seedOrg(otherOrgId, 'other-org');
    const token = await loginAdmin(); // admin belongs to orgId (pilot-charlie)
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/auth/sso/other-org/config`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        provider: 'okta',
        entityId: 'https://idp.other.test/saml/metadata',
        ssoUrl: 'https://idp.other.test/saml/sso',
        idpCertificate: FAKE_CERT,
        attributeMapping,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  // D4 — the `isSuper` cross-tenant bypass is removed. A super_admin from
  // `org_OPS` may NOT install an IdP cert on a victim org's slug. This is the
  // chain that turns a forged super_admin (D3) into full org takeover: without
  // this guard, the attacker installs their own IdP cert for the victim slug
  // and SP-logs-in as that org. The upsert is now strictly org-bound.
  it('forbids a super_admin from configuring ANOTHER org (no isSuper bypass)', async () => {
    await expect(
      upsertSsoConfigurationBySlug(
        slug, // slug belongs to org_SSO_PILOT, NOT the super-actor's org_OPS
        {
          provider: 'okta',
          entityId: 'https://attacker-idp.test/saml/metadata',
          ssoUrl: 'https://attacker-idp.test/saml/sso',
          idpCertificate: FAKE_CERT,
          attributeMapping,
        },
        superActor, // role: super_admin, orgId: org_OPS
      ),
    ).rejects.toMatchObject({ problem: { status: 403 } });
    // And no config row was written for the victim org.
    const row = await prisma().ssoConfiguration.findUnique({ where: { orgId } });
    expect(row).toBeNull();
  });

  it('lets a super_admin configure their OWN org (org-bound upsert still works)', async () => {
    // Give the super-actor a real org so the org-equality check can pass.
    await seedOrg(superActor.orgId, 'ops-org');
    const cfg = await upsertSsoConfigurationBySlug(
      'ops-org',
      {
        provider: 'okta',
        entityId: 'https://idp.ops.test/saml/metadata',
        ssoUrl: 'https://idp.ops.test/saml/sso',
        idpCertificate: FAKE_CERT,
        attributeMapping,
      },
      superActor,
    );
    expect(cfg.orgId).toBe(superActor.orgId);
  });
});

describe('GET /v1/auth/sso/:slug/start', () => {
  it('302-redirects to the IdP entry point with a SAMLRequest + RelayState', async () => {
    await configure();
    const res = await app.inject({ method: 'GET', url: `/v1/auth/sso/${slug}/start` });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain('https://idp.pilot.test/saml/sso');
    expect(location).toContain('SAMLRequest=');
    expect(location).toContain('RelayState=');
  });

  it('404s when the org has no SSO config', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/auth/sso/${slug}/start` });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/auth/sso/:slug/metadata', () => {
  it('returns SP metadata XML', async () => {
    await configure();
    const res = await app.inject({ method: 'GET', url: `/v1/auth/sso/${slug}/metadata` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.body).toContain('EntityDescriptor');
    expect(res.body).toContain(`/v1/auth/sso/${slug}/acs`);
  });
});

describe('POST /v1/auth/sso/:slug/acs (HTTP rejection paths)', () => {
  it('rejects a forged / missing RelayState with 403', async () => {
    await configure();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/auth/sso/${slug}/acs`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `SAMLResponse=${encodeURIComponent('garbage')}&RelayState=${encodeURIComponent('forged.sig')}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects an unverifiable SAMLResponse with 401 (valid RelayState)', async () => {
    await configure();
    const rs = signRelayState(slug);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/auth/sso/${slug}/acs`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `SAMLResponse=${encodeURIComponent('not-a-real-signed-assertion')}&RelayState=${encodeURIComponent(rs)}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a RelayState bound to a different org with 403', async () => {
    await configure();
    const rs = signRelayState('some-other-slug');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/auth/sso/${slug}/acs`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `SAMLResponse=${encodeURIComponent('x')}&RelayState=${encodeURIComponent(rs)}`,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('consumeAcs JIT provisioning (via validate seam)', () => {
  const validProfile = (over: SamlProfileLike = {}): SamlProfileLike => ({
    email: 'newhire@pilot.test',
    firstName: 'New',
    lastName: 'Hire',
    d2dRole: 'Field Rep',
    ...over,
  });

  function seam(profile: SamlProfileLike) {
    return { validate: async () => profile };
  }

  it('provisions a brand-new user with the clamped role', async () => {
    await configure();
    const { session, created } = await consumeAcs(
      { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
      seam(validProfile()),
    );
    expect(created).toBe(true);
    expect(session.user.role).toBe('knocker'); // 'Field Rep' → roleMap → knocker
    expect(session.user.orgId).toBe(orgId);
    const row = await prisma().user.findUniqueOrThrow({
      where: { emailDigest: digest('newhire@pilot.test') },
    });
    expect(row.orgId).toBe(orgId);
    expect(row.role).toBe('knocker');
  });

  it('NEVER mints super_admin from the assertion (escalation guard)', async () => {
    await configure();
    const { session } = await consumeAcs(
      { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
      seam(validProfile({ email: 'sneaky@pilot.test', d2dRole: 'super_admin' })),
    );
    expect(session.user.role).toBe('viewer'); // clamped to least-privilege default
  });

  it('matches a returning user WITHOUT mutating their stored role', async () => {
    await configure();
    await prisma().user.create({
      data: {
        id: 'usr_RETURNING',
        orgId,
        email: 'manager@pilot.test',
        emailDigest: digest('manager@pilot.test'),
        givenName: 'Mary',
        familyName: 'Manager',
        role: 'manager',
        regionCode: 'US',
        status: 'active',
      },
    });
    const { session, created } = await consumeAcs(
      { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
      // Assertion tries to demote/escalate — must be ignored on a returning user.
      seam(validProfile({ email: 'manager@pilot.test', d2dRole: 'Org Admin' })),
    );
    expect(created).toBe(false);
    expect(session.user.role).toBe('manager');
    const row = await prisma().user.findUniqueOrThrow({ where: { id: 'usr_RETURNING' } });
    expect(row.role).toBe('manager');
  });

  it('rejects an email already bound to a DIFFERENT org (no cross-link)', async () => {
    await configure();
    await seedOrg(otherOrgId, 'other-org');
    await prisma().user.create({
      data: {
        id: 'usr_FOREIGN',
        orgId: otherOrgId,
        email: 'shared@pilot.test',
        emailDigest: digest('shared@pilot.test'),
        givenName: 'Sam',
        familyName: 'Shared',
        role: 'viewer',
        regionCode: 'US',
        status: 'active',
      },
    });
    await expect(
      consumeAcs(
        { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
        seam(validProfile({ email: 'shared@pilot.test' })),
      ),
    ).rejects.toMatchObject({ problem: { status: 403 } });
  });

  it('rejects a suspended user with 403', async () => {
    await configure();
    await prisma().user.create({
      data: {
        id: 'usr_SUSPENDED',
        orgId,
        email: 'gone@pilot.test',
        emailDigest: digest('gone@pilot.test'),
        givenName: 'Gone',
        familyName: 'Away',
        role: 'knocker',
        regionCode: 'US',
        status: 'archived',
      },
    });
    await expect(
      consumeAcs(
        { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
        seam(validProfile({ email: 'gone@pilot.test' })),
      ),
    ).rejects.toMatchObject({ problem: { status: 403 } });
  });

  it('marks the config validated + active after a successful login', async () => {
    await configure();
    await consumeAcs(
      { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
      seam(validProfile()),
    );
    const row = await prisma().ssoConfiguration.findUniqueOrThrow({ where: { orgId } });
    expect(row.status).toBe('active');
    expect(row.lastValidatedAt).not.toBeNull();
  });

  it('refuses login when the config is revoked (403)', async () => {
    await configure();
    await prisma().ssoConfiguration.update({ where: { orgId }, data: { status: 'revoked' } });
    await expect(
      consumeAcs(
        { slug, samlResponse: 'seam', relayState: signRelayState(slug) },
        seam(validProfile()),
      ),
    ).rejects.toMatchObject({ problem: { status: 403 } });
  });
});
