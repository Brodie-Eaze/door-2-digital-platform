/**
 * Unit tests for normalizeUserAgent (SEC-012 — PII minimisation).
 * The full User-Agent string is a fingerprinting vector; only the browser
 * family + major version should be persisted.
 */
import { describe, it, expect } from 'vitest';
import { normalizeUserAgent } from './tokens';

describe('normalizeUserAgent — SEC-012 coarse normalisation', () => {
  it('extracts Chrome major version', () => {
    expect(
      normalizeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome/124');
  });

  it('extracts Edge major version (matches Edg/ before Chrome/)', () => {
    expect(
      normalizeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      ),
    ).toBe('Edge/124');
  });

  it('extracts Firefox major version', () => {
    expect(
      normalizeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0'),
    ).toBe('Firefox/125');
  });

  it('extracts Safari major version via Version token', () => {
    expect(
      normalizeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari/17');
  });

  it('falls back to generic client/major for non-browser HTTP clients', () => {
    expect(normalizeUserAgent('okhttp/4.12.0')).toBe('okhttp/4');
  });

  it('returns "other" for a missing or empty UA', () => {
    expect(normalizeUserAgent(undefined)).toBe('other');
    expect(normalizeUserAgent(null)).toBe('other');
    expect(normalizeUserAgent('')).toBe('other');
  });

  it('never stores the raw OS, device model, or full version string', () => {
    const raw =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Safari/537.36';
    const normalized = normalizeUserAgent(raw);
    // Must not contain "Macintosh", "Intel", "Mac OS X", or the full sub-version.
    expect(normalized).not.toContain('Macintosh');
    expect(normalized).not.toContain('Intel');
    expect(normalized).not.toContain('Mac OS');
    expect(normalized).not.toContain('124.0.6367');
    expect(normalized).toBe('Chrome/124');
  });
});
