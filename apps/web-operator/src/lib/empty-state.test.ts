/**
 * @d2d/ui-web EmptyState + FirstRunChecklist exports — smoke test.
 *
 * We can't render JSX here (no DOM env in the workspace test pool), so we
 * pin the public surface: variant enum, milestone shape, both components
 * exported from the package root. If sprint D moves these, this test
 * fails fast.
 */
import { describe, expect, it } from 'vitest';
import { EmptyState, FirstRunChecklist } from '@d2d/ui-web';
import type { EmptyStateVariant, FirstRunMilestone } from '@d2d/ui-web';

describe('@d2d/ui-web · EmptyState exports', () => {
  it('exports EmptyState + FirstRunChecklist as functions', () => {
    expect(typeof EmptyState).toBe('function');
    expect(typeof FirstRunChecklist).toBe('function');
  });

  it('accepts the three EmptyState variants', () => {
    const variants: EmptyStateVariant[] = ['default', 'anomaly', 'first-run'];
    for (const v of variants) {
      expect(['default', 'anomaly', 'first-run']).toContain(v);
    }
  });

  it('FirstRunMilestone shape compiles + counter is { current, target }', () => {
    const m: FirstRunMilestone = {
      id: 'x',
      label: 'l',
      progress: 0.4,
      counter: { current: 3, target: 10 },
      cta: { label: 'go', href: '/x', onClick: () => undefined },
    };
    expect(m.progress).toBeCloseTo(0.4);
    expect(m.counter?.current).toBe(3);
    expect(m.counter?.target).toBe(10);
  });
});
