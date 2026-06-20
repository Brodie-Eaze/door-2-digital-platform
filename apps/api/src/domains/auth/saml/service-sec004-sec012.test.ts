/**
 * Unit tests for SEC-004 (SAML assertion-ID replay cache) and
 * SEC-012 (IP truncation) in saml/service.ts.
 *
 * Redis and Prisma are mocked — no real DB or broker required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Redis — must be declared before the module under test is imported.
// ---------------------------------------------------------------------------
const setMock = vi.fn();
vi.mock('../../../config/redis', () => ({
  redis: () => ({ set: setMock }),
}));

// Mock prisma, env, writeAudit, issueTokens, buildSaml and relay-state so
// consumeAcs can run without a real database or SAML library.
// The prisma() accessor returns the client; consumeAcs reaches for
// .org.findUnique, .user.findUnique, .$transaction (which provisions a new
// user via tx.user.create) and .ssoConfiguration.updateMany. The mock must
// expose all of them, otherwise consumeAcs throws
// "Cannot read properties of undefined (reading 'findUnique')" the moment it
// hits the JIT match-or-provision step.
const prismaMock = {
  org: {
    findUnique: vi.fn().mockResolvedValue({
      id: 'org_1',
      slug: 'acme',
      regionCode: 'US',
      brandCode: 'd2d',
      ssoConfiguration: {
        id: 'sso_1',
        orgId: 'org_1',
        status: 'active',
        provider: 'okta',
        entityId: 'https://idp.example.com',
        ssoUrl: 'https://idp.example.com/sso',
        certificateKey: '{}',
        attributeMappingJson: { email: 'email', givenName: 'firstName', familyName: 'lastName' },
        lastValidatedAt: null,
      },
    }),
  },
  user: {
    // No matching user → consumeAcs takes the JIT-provision branch and runs
    // the $transaction below.
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 'usr_test',
      orgId: 'org_1',
      email: 'user@example.com',
      emailDigest: 'digest_abc',
      givenName: 'Alice',
      familyName: 'Smith',
      role: 'knocker',
      regionCode: 'US',
      brandCode: 'd2d',
      status: 'active',
    }),
  },
  ssoConfiguration: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  // $transaction is invoked with a callback (tx) => ...; run it with a tx that
  // exposes the same user.create the provisioning path calls.
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'usr_test',
          orgId: 'org_1',
          email: 'user@example.com',
          emailDigest: 'digest_abc',
          givenName: 'Alice',
          familyName: 'Smith',
          role: 'knocker',
          regionCode: 'US',
          brandCode: 'd2d',
          status: 'active',
        }),
      },
    }),
  ),
};

vi.mock('../../../config/db', () => ({
  prisma: () => prismaMock,
}));

vi.mock('../../../config/env', () => ({
  env: () => ({
    PII_SEARCH_KEY: 'test-search-key-32-bytes-xxxxxxxxx',
    JWT_ACCESS_SECRET: 'test-access-secret',
    OAUTH_STATE_SECRET: 'test-state-secret-min-32-bytes-xx',
    SAML_SP_BASE_URL: 'https://api.example.com',
  }),
}));

vi.mock('../../../shared/audit/write', () => ({ writeAudit: vi.fn() }));

vi.mock('../service', () => ({
  issueTokens: vi.fn().mockResolvedValue({
    accessToken: 'at',
    refreshToken: 'rt',
    accessTokenExpiresIn: 300,
    user: {},
  }),
}));

vi.mock('./config', () => ({
  buildSaml: vi.fn(),
  encryptIdpCert: vi.fn(),
  entityIdFor: (slug: string) => `https://api.example.com/v1/auth/sso/${slug}/metadata`,
  acsUrlFor: (slug: string) => `https://api.example.com/v1/auth/sso/${slug}/acs`,
}));

vi.mock('./relay-state', () => ({
  signRelayState: vi.fn((slug: string) => `signed.${slug}`),
  verifyRelayState: vi.fn((rs: string) => {
    const slug = rs.split('.')[1];
    if (!slug) throw new Error('bad relay state');
    return { slug };
  }),
}));

// @d2d/shared-utils — only the bits consumeAcs calls.
vi.mock('@d2d/shared-utils', () => ({
  Problems: {
    notFound: (t: string, id: string) => ({ type: 'not_found', title: `${t} ${id}` }),
    forbidden: (msg: string) => ({ type: 'forbidden', title: msg }),
    unauthorized: (msg: string) => ({ type: 'unauthorized', title: msg }),
  },
  ProblemError: class ProblemError extends Error {
    constructor(public readonly problem: unknown) {
      super(JSON.stringify(problem));
    }
  },
  emailDigest: (_email: string, _key: string) => 'digest_abc',
  newId: (prefix: string) => `${prefix}_test`,
}));

// ---------------------------------------------------------------------------
// Import system under test (after mocks are established).
// ---------------------------------------------------------------------------
import { consumeAcs, truncateIp } from './service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// IMPORTANT: a default-parameter value is substituted whenever the argument is
// `undefined`, so `makeValidateDep(undefined)` would NOT yield a profile with
// an absent ID — it would silently fall back to the default and emit the
// 'assert_unique_001' key. To genuinely exercise consumeAcs's SHA-256 fallback
// branch you must build a no-ID profile explicitly (see makeNoIdValidateDep).
function makeValidateDep(assertionId: string = 'assert_unique_001') {
  return {
    validate: vi.fn().mockResolvedValue({
      ID: assertionId,
      nameID: 'user@example.com',
      email: 'user@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      issuer: 'https://idp.example.com',
      nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    }),
  };
}

/** A validate seam whose profile carries NO assertion ID (IdP omitted it). */
function makeNoIdValidateDep() {
  return {
    validate: vi.fn().mockResolvedValue({
      nameID: 'user@example.com',
      email: 'user@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      issuer: 'https://idp.example.com',
      nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    }),
  };
}

const BASE_INPUT = {
  slug: 'acme',
  samlResponse: 'base64-response',
  relayState: 'signed.acme',
  ip: '10.0.1.99',
  userAgent: 'Mozilla/5.0 Chrome/124.0.0.0',
};

// ---------------------------------------------------------------------------
// SEC-004: Replay cache tests
// ---------------------------------------------------------------------------
describe('consumeAcs — SEC-004 replay defence', () => {
  beforeEach(() => {
    setMock.mockReset();
  });

  it('accepts a first-use assertion (SET NX returns OK)', async () => {
    setMock.mockResolvedValue('OK');
    const result = await consumeAcs(BASE_INPUT, makeValidateDep());
    expect(result.session.accessToken).toBe('at');
    // Verify SET was called with NX and EX flags.
    expect(setMock).toHaveBeenCalledTimes(1);
    const args = setMock.mock.calls[0]!;
    expect(args[0]).toContain('saml:used-assertion:assert_unique_001');
    // ioredis EX-then-NX overload: set(key, value, 'EX', seconds, 'NX')
    expect(args[2]).toBe('EX');
    expect(typeof args[3]).toBe('number');
    expect(args[3]).toBeGreaterThan(0);
    expect(args[4]).toBe('NX');
  });

  it('rejects a replayed assertion (SET NX returns null)', async () => {
    setMock.mockResolvedValue(null); // already exists
    await expect(consumeAcs(BASE_INPUT, makeValidateDep())).rejects.toMatchObject({
      problem: expect.objectContaining({ type: 'forbidden' }),
    });
  });

  it('falls back to a SHA-256 of the raw response when profile has no ID', async () => {
    setMock.mockResolvedValue('OK');
    const deps = makeNoIdValidateDep(); // no ID in profile
    await consumeAcs(BASE_INPUT, deps);
    const key = setMock.mock.calls[0]?.[0] as string;
    // The key should NOT be 'saml:used-assertion:undefined'; it should be a hex digest.
    expect(key).not.toContain('undefined');
    expect(key).toMatch(/^saml:used-assertion:[0-9a-f]{64}$/);
  });

  it('fails closed when Redis is unavailable (throws, does not issue a session)', async () => {
    setMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(consumeAcs(BASE_INPUT, makeValidateDep())).rejects.toThrow('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------
// SEC-012: IP truncation tests
// ---------------------------------------------------------------------------
describe('truncateIp — SEC-012 PII minimisation', () => {
  it('truncates IPv4 to /24 (drops last octet)', () => {
    expect(truncateIp('192.168.1.42')).toBe('192.168.1.0');
    expect(truncateIp('10.0.0.1')).toBe('10.0.0.0');
    expect(truncateIp('255.255.255.255')).toBe('255.255.255.0');
  });

  it('truncates IPv6 to /48 (keeps first 3 groups)', () => {
    expect(truncateIp('2001:db8:85a3::1')).toBe('2001:db8:85a3::/48');
    expect(truncateIp('fe80::1%eth0')).toBe('fe80::1::/48');
  });

  it('returns undefined for missing / unparseable input', () => {
    expect(truncateIp(undefined)).toBeUndefined();
    expect(truncateIp('')).toBeUndefined();
    // A single-segment string is not an IPv4 or a valid IPv6.
    expect(truncateIp('not-an-ip')).toBeUndefined();
  });

  it('consumeAcs passes truncated IP (not raw) to audit metadata', async () => {
    const { writeAudit } = await import('../../../shared/audit/write');
    const mockWriteAudit = vi.mocked(writeAudit);
    mockWriteAudit.mockClear();
    setMock.mockResolvedValue('OK');

    // Use an IP that would differ from its truncated form.
    await consumeAcs(
      { ...BASE_INPUT, ip: '192.168.1.99', slug: 'acme', relayState: 'signed.acme' },
      {
        validate: vi.fn().mockResolvedValue({
          ID: 'assert_ip_test',
          nameID: 'new@example.com',
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          issuer: 'https://idp.example.com',
          nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        }),
      },
    );

    // If writeAudit was called with IP in metadata, it should be truncated.
    for (const call of mockWriteAudit.mock.calls) {
      const meta = call[1]?.metadata as Record<string, unknown> | undefined;
      if (meta && 'ip' in meta) {
        expect(meta['ip']).not.toBe('192.168.1.99');
        expect(meta['ip']).toBe('192.168.1.0');
      }
    }
  });
});
