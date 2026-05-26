/**
 * Seed reconciliation tests.
 *
 * Sprint B's hardest contract is: numbers reconcile across views. If the
 * command-centre says X total conversions MTD, the sum of each per-account
 * /conversions view must equal X. These tests pin that invariant + a
 * handful of adversarial cases (deterministic across runs, no zero counts,
 * proper time-series shape).
 */

import { describe, expect, it } from 'vitest';
import { hqRollup, rollupFor, ACCOUNT_SEEDS } from './kpis';
import { buildLeads } from './leads';
import { buildRoster } from './roster';
import { buildConversions } from './conversions';
import { dailySeries, totalOf } from './time-series';

const FIXED_DAY = new Date('2026-05-27T15:00:00.000Z'); // Wed mid-day, scenario clock

describe('seed/kpis · rollups', () => {
  it('reconciles HQ totals to per-account sums', () => {
    const hq = hqRollup(FIXED_DAY);
    const sumActive = hq.perAccount.reduce((s, r) => s + r.activeReps, 0);
    const sumKnocks = hq.perAccount.reduce((s, r) => s + r.knocksToday, 0);
    const sumConvToday = hq.perAccount.reduce((s, r) => s + r.conversionsToday, 0);
    const sumConvMTD = hq.perAccount.reduce((s, r) => s + r.conversionsMTD, 0);
    const sumRev = hq.perAccount.reduce((s, r) => s + r.revenueCentsMTD, 0n);

    expect(sumActive).toBe(hq.totalActiveReps);
    expect(sumKnocks).toBe(hq.totalKnocksToday);
    expect(sumConvToday).toBe(hq.totalConvToday);
    expect(sumConvMTD).toBe(hq.totalConvMTD);
    expect(sumRev).toBe(hq.totalRevenueCentsMTD);
  });

  it('renders Pilot-Charlie scale (>= 400 reps, >= 4000 conv/mo)', () => {
    const hq = hqRollup(FIXED_DAY);
    expect(hq.totalReps).toBeGreaterThanOrEqual(400);
    expect(hq.totalConvMTD).toBeGreaterThanOrEqual(4000);
  });

  it('is deterministic across calls', () => {
    const a = rollupFor('hope-forward', FIXED_DAY);
    const b = rollupFor('hope-forward', FIXED_DAY);
    expect(a.conversionsMTD).toBe(b.conversionsMTD);
    expect(a.revenueCentsMTD).toBe(b.revenueCentsMTD);
    expect(a.knocksToday).toBe(b.knocksToday);
  });

  it('throws for unknown slugs', () => {
    expect(() => rollupFor('not-a-real-account')).toThrow(/unknown account slug/);
  });
});

describe('seed/leads · per-account', () => {
  for (const slug of Object.keys(ACCOUNT_SEEDS)) {
    it(`${slug}: generates 30-80 leads with valid statuses + sources`, () => {
      const leads = buildLeads({ slug, today: FIXED_DAY });
      expect(leads.length).toBeGreaterThanOrEqual(30);
      expect(leads.length).toBeLessThanOrEqual(80);
      for (const l of leads) {
        expect(l.id.startsWith(`${slug}_ld_`)).toBe(true);
        expect([
          'new',
          'contacted',
          'qualified',
          'appointment_set',
          'converted',
          'lost',
          'do_not_contact',
        ]).toContain(l.status);
        expect(['door', 'inside_sales', 'retargeting']).toContain(l.source);
        expect(l.givenName.length).toBeGreaterThan(0);
        expect(l.familyName.length).toBeGreaterThan(0);
        // Address must look like a real address (number + street + city + state + zip).
        expect(l.address).toMatch(/\d+\s+\S+.+\d/);
      }
    });
  }

  it('is tenant-scoped: hope-forward leads do not leak into pestmax', () => {
    const hf = buildLeads({ slug: 'hope-forward', today: FIXED_DAY });
    const pm = buildLeads({ slug: 'pestmax', today: FIXED_DAY });
    const hfIds = new Set(hf.map((l) => l.id));
    for (const l of pm) {
      expect(hfIds.has(l.id)).toBe(false);
    }
  });
});

describe('seed/roster · per-account', () => {
  for (const slug of Object.keys(ACCOUNT_SEEDS)) {
    it(`${slug}: roster size matches config`, () => {
      const roster = buildRoster({ slug, today: FIXED_DAY });
      expect(roster.length).toBe(ACCOUNT_SEEDS[slug]!.rosterSize);
    });

    it(`${slug}: realistic conv-rate spread (bottom 3%, veteran top per vertical)`, () => {
      const roster = buildRoster({ slug, today: FIXED_DAY });
      const cfg = ACCOUNT_SEEDS[slug]!;
      const rates = roster.map((r) => r.lifetimeConvRate);
      const min = Math.min(...rates);
      const max = Math.max(...rates);
      expect(min).toBeGreaterThanOrEqual(3);
      // Veteran rates peak around 1.5-1.7x the vertical base; charity base 14,
      // commercial 9, healthcare 11. Use the vertical-aware floor.
      const base = cfg.vertical === 'commercial' ? 9 : cfg.vertical === 'healthcare' ? 11 : 14;
      const expectedMax = cfg.rosterSize >= 60 ? base * 1.4 : base * 1.15;
      expect(max).toBeGreaterThanOrEqual(expectedMax);
    });

    it(`${slug}: status distribution looks live (>50% on shift on weekday)`, () => {
      const roster = buildRoster({ slug, today: FIXED_DAY });
      const onShift = roster.filter((r) => r.status !== 'offline');
      expect(onShift.length / roster.length).toBeGreaterThan(0.5);
    });
  }
});

describe('seed/conversions · ledger', () => {
  for (const slug of Object.keys(ACCOUNT_SEEDS)) {
    it(`${slug}: builds 60 entries in reverse-chrono`, () => {
      const ledger = buildConversions({ slug, today: FIXED_DAY });
      expect(ledger.length).toBe(60);
      for (let i = 0; i < ledger.length - 1; i++) {
        expect(ledger[i]!.capturedAt >= ledger[i + 1]!.capturedAt).toBe(true);
      }
      // ~95% should clear, ~3% pending, ~2% declined.
      const cleared = ledger.filter((c) => c.paymentStatus === 'cleared').length;
      expect(cleared / ledger.length).toBeGreaterThan(0.85);
    });
  }
});

describe('seed/time-series · shape', () => {
  it('weekly pattern is visible (charity Wed/Thu > Sun)', () => {
    const series = dailySeries(
      {
        days: 28,
        vertical: 'charity',
        baseline: 100,
        seed: 'test:charity:weekly',
      },
      FIXED_DAY,
    );
    const byDay: Record<string, number[]> = {};
    for (const p of series) {
      (byDay[p.weekday] ??= []).push(p.value);
    }
    const avg = (arr: number[]): number => arr.reduce((s, v) => s + v, 0) / arr.length;
    const sun = avg(byDay.Sun ?? [0]);
    const wed = avg(byDay.Wed ?? [0]);
    expect(wed).toBeGreaterThan(sun * 3);
  });

  it('produces non-flat data (some variance day-to-day)', () => {
    const series = dailySeries(
      {
        days: 14,
        vertical: 'charity',
        baseline: 50,
        seed: 'test:variance',
      },
      FIXED_DAY,
    );
    const unique = new Set(series.map((p) => p.value));
    expect(unique.size).toBeGreaterThan(7);
  });

  it('totalOf sums correctly', () => {
    const series = dailySeries(
      { days: 7, vertical: 'charity', baseline: 30, seed: 'total' },
      FIXED_DAY,
    );
    const manual = series.reduce((s, p) => s + p.value, 0);
    expect(totalOf(series)).toBe(manual);
  });
});

describe('seed adversarial', () => {
  it('handles weekend `today` without crashing (low active count)', () => {
    const sat = new Date('2026-05-30T15:00:00.000Z'); // Sat
    const hq = hqRollup(sat);
    // Saturday peak ~32% of roster fielded.
    expect(hq.totalActiveReps).toBeLessThan(hq.totalReps * 0.45);
    expect(hq.totalActiveReps).toBeGreaterThan(0);
  });

  it('avg ticket × conversions = revenue (no float drift)', () => {
    for (const slug of Object.keys(ACCOUNT_SEEDS)) {
      const r = rollupFor(slug, FIXED_DAY);
      const cfg = ACCOUNT_SEEDS[slug]!;
      expect(r.revenueCentsMTD).toBe(BigInt(r.conversionsMTD) * BigInt(cfg.avgTicketCents));
    }
  });
});
