/**
 * Money — BigInt-cents arithmetic for D2D.
 *
 * Per ADR-0007 "Money as BigInt cents", every monetary value crosses
 * service boundaries as BigInt minor units. Floats and JS Number are
 * forbidden — even `Number.MAX_SAFE_INTEGER` only covers ~$90 trillion
 * in cents which is fine for D2D, but float arithmetic introduces
 * non-deterministic drift that breaks reconciliation.
 *
 * Currency code is carried alongside as a 3-char ISO 4217 string.
 *
 * For display, use `<Money cents={x} region={...} />` from @d2d/ui-web.
 */

export interface Money {
  readonly cents: bigint;
  readonly currency: string; // ISO 4217, uppercase
}

export const ZERO_USD: Money = Object.freeze({ cents: 0n, currency: 'USD' });
export const ZERO_AUD: Money = Object.freeze({ cents: 0n, currency: 'AUD' });
export const ZERO_SGD: Money = Object.freeze({ cents: 0n, currency: 'SGD' });

export function money(cents: bigint | number | string, currency: string): Money {
  const c =
    typeof cents === 'bigint'
      ? cents
      : typeof cents === 'number'
        ? BigInt(Math.round(cents))
        : BigInt(cents);
  return { cents: c, currency: currency.toUpperCase() };
}

export function fromMajor(amount: number, currency: string): Money {
  // Convert dollars/whole-unit to cents. Use Math.round to avoid 0.1 + 0.2
  // floating issues.
  return money(BigInt(Math.round(amount * 100)), currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: ${a.currency} vs ${b.currency}. Convert via the FX service before arithmetic.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { cents: a.cents + b.cents, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { cents: a.cents - b.cents, currency: a.currency };
}

export function multiplyByInt(a: Money, n: number): Money {
  if (!Number.isInteger(n)) {
    throw new Error('multiplyByInt requires an integer multiplier');
  }
  return { cents: a.cents * BigInt(n), currency: a.currency };
}

/**
 * Multiply by a basis-points rate (10_000 bps = 100%). Used for
 * commission rakes, take-rate calculations, processor residuals.
 * Returns the truncated cents (rounds toward zero).
 */
export function takeRate(a: Money, ratePercent: number): Money {
  if (ratePercent < 0 || ratePercent > 100) {
    throw new Error('takeRate percent must be in [0, 100]');
  }
  // Convert percent → basis points to avoid float drift.
  const bps = BigInt(Math.round(ratePercent * 100));
  return { cents: (a.cents * bps) / 10_000n, currency: a.currency };
}

/**
 * MiCamp ISO residual calculator — Brodie earns a share of processor
 * markup on every transaction. This is separate from D2D's own take rate.
 *
 * Example: ratePercent = 0.10 means 10 bps of transaction volume.
 */
export function processorResidual(transactionAmount: Money, residualPercent: number): Money {
  return takeRate(transactionAmount, residualPercent);
}

export function isPositive(m: Money): boolean {
  return m.cents > 0n;
}
export function isZero(m: Money): boolean {
  return m.cents === 0n;
}
export function isNegative(m: Money): boolean {
  return m.cents < 0n;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.cents === b.cents;
}

/**
 * Serialize for transport (Money cannot survive JSON.stringify because
 * of BigInt). Wire format: { cents: string, currency: string }.
 * Deserialize via `parseMoney`.
 */
export function serializeMoney(m: Money): { cents: string; currency: string } {
  return { cents: m.cents.toString(), currency: m.currency };
}

export function parseMoney(wire: { cents: string | number; currency: string }): Money {
  return money(wire.cents, wire.currency);
}
