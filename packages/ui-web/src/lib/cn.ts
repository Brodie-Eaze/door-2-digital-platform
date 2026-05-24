/**
 * Minimal classname combiner. Filters out falsy values and joins with a space.
 * For more complex variant logic, consider class-variance-authority — but
 * keep this lightweight default for component-level usage.
 */
export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}
