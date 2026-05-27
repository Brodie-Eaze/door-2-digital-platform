/**
 * first-run tests — sprint C contract.
 *
 * The four demo accounts NEVER hit first-run mode; any other slug DOES.
 * If this contract breaks, sprint B's seed realism leaks through onto a
 * brand-new account, OR onboarded accounts show populated KPIs from
 * Hope Forward's fixture by mistake — both bad.
 */
import { describe, expect, it } from 'vitest';
import { firstRunSnapshot, defaultFirstRunMilestones } from './first-run';
import { ACCOUNT_SEEDS } from './seed/kpis';

describe('first-run · snapshot', () => {
  it('returns isFirstRun=false for every seeded demo account', () => {
    for (const slug of Object.keys(ACCOUNT_SEEDS)) {
      const snap = firstRunSnapshot(slug);
      expect(snap.isFirstRun, `expected ${slug} not to be first-run`).toBe(false);
      expect(snap.hasAccount).toBe(true);
      expect(snap.accountName.length).toBeGreaterThan(0);
    }
  });

  it('returns isFirstRun=true for an unknown slug', () => {
    const snap = firstRunSnapshot('brand-new-charity-2026');
    expect(snap.isFirstRun).toBe(true);
    expect(snap.hasAccount).toBe(false);
    expect(snap.accountName).toBe('Brand New Charity 2026');
  });

  it('handles single-segment slugs without crashing', () => {
    const snap = firstRunSnapshot('alpha');
    expect(snap.isFirstRun).toBe(true);
    expect(snap.accountName).toBe('Alpha');
  });

  it('handles empty/whitespace input defensively', () => {
    const snap = firstRunSnapshot('');
    expect(snap.isFirstRun).toBe(true);
    // empty slug formats to empty name — caller decides how to render
    expect(snap.accountName).toBe('');
  });
});

describe('first-run · milestones', () => {
  it('emits three milestones with progress 0 by default', () => {
    const ms = defaultFirstRunMilestones('new-acct');
    expect(ms.length).toBe(3);
    for (const m of ms) {
      expect(m.progress).toBe(0);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.cta?.href?.startsWith('/accounts/new-acct/')).toBe(true);
    }
  });

  it('milestone IDs are stable + unique', () => {
    const ms = defaultFirstRunMilestones('x');
    const ids = new Set(ms.map((m) => m.id));
    expect(ids.size).toBe(ms.length);
    expect(ids.has('onboard-knockers')).toBe(true);
    expect(ids.has('draw-territory')).toBe(true);
    expect(ids.has('first-campaign')).toBe(true);
  });

  it('the onboard-knockers milestone targets 10 reps', () => {
    const ms = defaultFirstRunMilestones('x');
    const onboard = ms.find((m) => m.id === 'onboard-knockers')!;
    expect(onboard.counter).toEqual({ current: 0, target: 10 });
  });
});
