/**
 * Unit tests for the SAML attribute-mapping layer — the privilege-assignment
 * surface for SSO. The single most important property: an IdP can NEVER mint
 * a `super_admin`. These tests are pure (no DB, no SAML library).
 */
import { describe, it, expect } from 'vitest';
import {
  asString,
  clampRole,
  resolveEmail,
  resolveRole,
  mapSamlAttributes,
  SSO_ASSIGNABLE_ROLES,
  SSO_DEFAULT_ROLE,
  type SamlAttributeMapping,
} from './attribute-mapping';

const mapping: SamlAttributeMapping = {
  email: 'email',
  givenName: 'firstName',
  familyName: 'lastName',
  role: 'd2dRole',
  roleMap: { 'Org Admin': 'org_admin', 'Field Rep': 'knocker' },
};

describe('clampRole — escalation guard', () => {
  it('NEVER returns super_admin even if the assertion asks for it', () => {
    expect(clampRole('super_admin')).toBe(SSO_DEFAULT_ROLE);
    expect(SSO_ASSIGNABLE_ROLES.has('super_admin' as never)).toBe(false);
  });

  it('passes through every assignable role unchanged', () => {
    for (const role of SSO_ASSIGNABLE_ROLES) {
      expect(clampRole(role)).toBe(role);
    }
  });

  it('collapses unknown / empty / undefined to the least-privilege default', () => {
    expect(clampRole('root')).toBe(SSO_DEFAULT_ROLE);
    expect(clampRole('')).toBe(SSO_DEFAULT_ROLE);
    expect(clampRole(undefined)).toBe(SSO_DEFAULT_ROLE);
    expect(clampRole('ORG_ADMIN')).toBe(SSO_DEFAULT_ROLE); // case-sensitive on purpose
  });
});

describe('asString — multi-valued SAML attribute coercion', () => {
  it('trims a plain string and rejects empties', () => {
    expect(asString('  alice@x.io ')).toBe('alice@x.io');
    expect(asString('   ')).toBeUndefined();
  });

  it('takes the first non-empty entry of an array', () => {
    expect(asString(['', '  ', 'second'])).toBe('second');
    expect(asString([])).toBeUndefined();
  });

  it('returns undefined for non-string inputs', () => {
    expect(asString(42)).toBeUndefined();
    expect(asString(null)).toBeUndefined();
    expect(asString({ a: 1 })).toBeUndefined();
  });
});

describe('resolveEmail — precedence + normalisation', () => {
  it('prefers the mapped attribute', () => {
    expect(resolveEmail({ email: 'Mapped@X.io', mail: 'wk@x.io' }, mapping)).toBe('mapped@x.io');
  });

  it('falls back to well-known email / mail keys', () => {
    const m: SamlAttributeMapping = { ...mapping, email: 'customEmailAttr' };
    expect(resolveEmail({ mail: 'WK@X.io' }, m)).toBe('wk@x.io');
  });

  it('uses NameID only when it is itself an email', () => {
    const m: SamlAttributeMapping = { ...mapping, email: 'nope' };
    expect(resolveEmail({ nameID: 'person@x.io' }, m)).toBe('person@x.io');
    expect(() => resolveEmail({ nameID: 'not-an-email' }, m)).toThrow();
  });

  it('throws when no usable email is present', () => {
    const m: SamlAttributeMapping = { ...mapping, email: 'nope' };
    expect(() => resolveEmail({}, m)).toThrow();
  });

  it('lower-cases so it matches the deterministic emailDigest', () => {
    expect(resolveEmail({ email: 'UPPER@X.IO' }, mapping)).toBe('upper@x.io');
  });
});

describe('resolveRole — roleMap translate then clamp', () => {
  it('translates a raw IdP role string through roleMap before clamping', () => {
    expect(resolveRole({ d2dRole: 'Org Admin' }, mapping)).toBe('org_admin');
    expect(resolveRole({ d2dRole: 'Field Rep' }, mapping)).toBe('knocker');
  });

  it('clamps an unmapped raw role that is not assignable', () => {
    expect(resolveRole({ d2dRole: 'Wizard' }, mapping)).toBe(SSO_DEFAULT_ROLE);
  });

  it('honours a raw role that is already a valid D2D role with no roleMap entry', () => {
    expect(resolveRole({ d2dRole: 'auditor' }, mapping)).toBe('auditor');
  });

  it('defaults to viewer when no role attribute is configured', () => {
    const m: SamlAttributeMapping = { email: 'email', givenName: 'g', familyName: 'f' };
    expect(resolveRole({ anything: 'manager' }, m)).toBe(SSO_DEFAULT_ROLE);
  });

  it('never escalates to super_admin via roleMap', () => {
    const m: SamlAttributeMapping = { ...mapping, roleMap: { God: 'super_admin' } };
    expect(resolveRole({ d2dRole: 'God' }, m)).toBe(SSO_DEFAULT_ROLE);
  });
});

describe('mapSamlAttributes — full profile → User fields', () => {
  it('maps every field from a complete assertion', () => {
    const mapped = mapSamlAttributes(
      { email: 'Bob@X.io', firstName: 'Bob', lastName: 'Jones', d2dRole: 'Org Admin' },
      mapping,
    );
    expect(mapped).toEqual({
      email: 'bob@x.io',
      givenName: 'Bob',
      familyName: 'Jones',
      role: 'org_admin',
    });
  });

  it('falls back names to the email local-part on a minimal assertion', () => {
    const mapped = mapSamlAttributes({ email: 'minimal@x.io' }, mapping);
    expect(mapped.email).toBe('minimal@x.io');
    expect(mapped.givenName).toBe('minimal');
    expect(mapped.familyName).toBe('minimal');
    expect(mapped.role).toBe(SSO_DEFAULT_ROLE);
  });

  it('throws when the assertion carries no usable email', () => {
    expect(() => mapSamlAttributes({ firstName: 'X' }, mapping)).toThrow();
  });
});
