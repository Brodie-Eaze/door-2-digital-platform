/**
 * Provider-adapter production-readiness unit tests.
 *
 * These run in the api unit-test pool (no DB, no port) and exercise the
 * `@d2d/integrations` adapters directly. They lock in the fail-closed contract
 * added for production-readiness:
 *
 *   1. production + missing creds  → CREDENTIALS_REQUIRED (never silent stub)
 *   2. sandbox                     → deterministic stub success
 *   3. production + real creds     → real HTTP path (mocked)
 *   4. partner 5xx / 429 / timeout → typed ProviderError (no raw throw)
 *
 * `global.fetch` is mocked per-case so no real partner is ever contacted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDefaultRegistry,
  createCrmHubSpotAdapter,
  createCrmSalesforceAdapter,
  createCrmZapierAdapter,
  guardProduction,
  hasRealCredentials,
  isStubMode,
  resolveProviderPosture,
  type ProviderConfig,
} from '@d2d/integrations';

const REAL_HUBSPOT: ProviderConfig = {
  mode: 'production',
  credentials: { accessToken: 'pat-na1-real-token-value', portalId: '12345678' },
};
const PROD_NO_CREDS: ProviderConfig = { mode: 'production', credentials: {} };
const PROD_BLANK_CREDS: ProviderConfig = {
  mode: 'production',
  credentials: { accessToken: '   ', portalId: '' },
};
const SANDBOX: ProviderConfig = { mode: 'sandbox', credentials: {} };

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('posture resolution (the core fail-closed primitive)', () => {
  it('production + real creds → live', () => {
    expect(resolveProviderPosture(REAL_HUBSPOT)).toBe('live');
    expect(hasRealCredentials(REAL_HUBSPOT)).toBe(true);
    expect(isStubMode(REAL_HUBSPOT)).toBe(false);
  });

  it('production + missing creds → needs_credentials (NOT stub)', () => {
    expect(resolveProviderPosture(PROD_NO_CREDS)).toBe('needs_credentials');
    // The dangerous historical behavior: isStubMode must be FALSE in prod.
    expect(isStubMode(PROD_NO_CREDS)).toBe(false);
    expect(hasRealCredentials(PROD_NO_CREDS)).toBe(false);
  });

  it('production + blank/whitespace creds → needs_credentials', () => {
    expect(resolveProviderPosture(PROD_BLANK_CREDS)).toBe('needs_credentials');
    expect(isStubMode(PROD_BLANK_CREDS)).toBe(false);
  });

  it('sandbox → stub regardless of creds', () => {
    expect(resolveProviderPosture(SANDBOX)).toBe('stub');
    expect(isStubMode(SANDBOX)).toBe(true);
    expect(
      resolveProviderPosture({ mode: 'sandbox', credentials: { apiKey: 'x'.repeat(40) } }),
    ).toBe('stub');
  });

  it('unset mode defaults to stub (safe default)', () => {
    expect(resolveProviderPosture({ credentials: { apiKey: 'x'.repeat(40) } })).toBe('stub');
  });

  it('guardProduction returns CREDENTIALS_REQUIRED in prod-without-creds', () => {
    const g = guardProduction(PROD_NO_CREDS, 'crm_hubspot');
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.error.code).toBe('CREDENTIALS_REQUIRED');
      expect(g.error.httpStatus).toBe(424);
    }
  });
});

describe('CRM adapters — fail closed in production', () => {
  afterEach(() => vi.restoreAllMocks());

  const cases = [
    { name: 'hubspot', make: createCrmHubSpotAdapter },
    { name: 'salesforce', make: createCrmSalesforceAdapter },
    { name: 'zapier', make: createCrmZapierAdapter },
  ];

  for (const c of cases) {
    it(`${c.name}: pushLead in prod-without-creds returns CREDENTIALS_REQUIRED and never calls fetch`, async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const adapter = c.make();
      const res = await adapter.pushLead!(
        {
          leadId: 'lead_1',
          orgId: 'org_1',
          givenName: 'Ada',
          familyName: 'Lovelace',
          status: 'new',
        },
        PROD_NO_CREDS,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('CREDENTIALS_REQUIRED');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it(`${c.name}: pushLead in sandbox returns a deterministic stub id`, async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const adapter = c.make();
      const res = await adapter.pushLead!(
        {
          leadId: 'lead_1',
          orgId: 'org_1',
          givenName: 'Ada',
          familyName: 'Lovelace',
          status: 'new',
        },
        SANDBOX,
      );
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.externalId).toMatch(/stub/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});

describe('HubSpot adapter — real HTTP path (mocked partner)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('happy path: production + real creds POSTs and returns external id + url', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ id: '551' }));
    const adapter = createCrmHubSpotAdapter();
    const res = await adapter.pushLead!(
      { leadId: 'l1', orgId: 'o1', givenName: 'Ada', familyName: 'L', status: 'new' },
      REAL_HUBSPOT,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.externalId).toBe('551');
      expect(res.data.externalUrl).toContain('/contact/551');
    }
  });

  it('partner 5xx → typed PROVIDER_5XX error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 503 }));
    const adapter = createCrmHubSpotAdapter();
    const res = await adapter.pushLead!(
      { leadId: 'l1', orgId: 'o1', givenName: 'Ada', familyName: 'L', status: 'new' },
      REAL_HUBSPOT,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('PROVIDER_5XX');
      expect(res.error.httpStatus).toBe(503);
    }
  });

  it('network abort/timeout → typed TIMEOUT error (no raw throw)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    const adapter = createCrmHubSpotAdapter();
    const res = await adapter.ping(REAL_HUBSPOT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('TIMEOUT');
  });
});

describe('Claude copy adapter — rate limit handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('partner 429 → RATE_LIMITED with retryAfter', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate', { status: 429, headers: { 'retry-after': '12' } }),
    );
    const registry = buildDefaultRegistry();
    const claude = registry.get('claude_copy');
    const res = await claude.generateText!(
      { prompt: 'hello' },
      { mode: 'production', credentials: { apiKey: 'sk-ant-real-key-value-1234' } },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('RATE_LIMITED');
      expect(res.error.httpStatus).toBe(429);
    }
  });

  it('sandbox generateText returns stub text without fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const registry = buildDefaultRegistry();
    const claude = registry.get('claude_copy');
    const res = await claude.generateText!({ prompt: 'hello world' }, SANDBOX);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.text).toContain('[stub:');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('production generateText without creds fails closed (CREDENTIALS_REQUIRED), no fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const registry = buildDefaultRegistry();
    const claude = registry.get('claude_copy');
    const res = await claude.generateText!({ prompt: 'hello' }, PROD_NO_CREDS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CREDENTIALS_REQUIRED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Zapier adapter — SSRF guard on operator-supplied webhook URL', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects non-https / internal-host webhook URLs in production', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const adapter = createCrmZapierAdapter();
    const blocked = [
      'http://hooks.zapier.com/abc12345',
      'https://localhost/abc12345',
      'https://127.0.0.1/abc12345',
      'https://169.254.169.254/latest/meta-data',
      'https://10.0.0.5/internal',
    ];
    for (const url of blocked) {
      const res = await adapter.pushLead!(
        { leadId: 'l1', orgId: 'o1', givenName: 'A', familyName: 'B', status: 'new' },
        { mode: 'production', credentials: { webhookUrl: url } },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('INVALID_CONFIG');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a valid https external webhook URL and POSTs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ id: 'zap_99' }));
    const adapter = createCrmZapierAdapter();
    const res = await adapter.pushLead!(
      { leadId: 'l1', orgId: 'o1', givenName: 'A', familyName: 'B', status: 'new' },
      {
        mode: 'production',
        credentials: { webhookUrl: 'https://hooks.zapier.com/hooks/catch/123/abc' },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalId).toBe('zap_99');
  });
});
