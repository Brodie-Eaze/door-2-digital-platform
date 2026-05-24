import { cn } from '../lib/cn';
import type { RegionCode } from '../types';

interface MoneyProps {
  /** Amount in MINOR units (cents). Always BigInt per ADR-0007. */
  cents: bigint | number;
  /**
   * Region drives default currency + locale:
   *   AU → AUD / en-AU
   *   US → USD / en-US
   *   SG → SGD / en-SG
   */
  region?: RegionCode;
  /** Override currency explicitly. */
  currency?: string;
  /** Override locale explicitly. */
  locale?: string;
  /** Show currency code as suffix instead of symbol prefix. */
  showCode?: boolean;
  /** Display 0 with em-dash for visual quiet. */
  emptyAsDash?: boolean;
  className?: string;
}

const REGION_DEFAULTS: Record<RegionCode, { currency: string; locale: string }> = {
  AU: { currency: 'AUD', locale: 'en-AU' },
  US: { currency: 'USD', locale: 'en-US' },
  SG: { currency: 'SGD', locale: 'en-SG' },
};

/**
 * Money component — formats BigInt cents into region-aware currency display.
 *
 * Hard rule from ADR-0007: amounts ALWAYS in BigInt cents to avoid floats.
 * This component is the only acceptable way to render money in D2D UIs.
 */
export function Money({
  cents,
  region = 'US',
  currency,
  locale,
  showCode = false,
  emptyAsDash = false,
  className,
}: MoneyProps): JSX.Element {
  const amount = typeof cents === 'bigint' ? cents : BigInt(Math.round(cents));

  if (amount === 0n && emptyAsDash) {
    return <span className={cn('numeric text-muted', className)}>—</span>;
  }

  const defaults = REGION_DEFAULTS[region];
  const effectiveCurrency = currency ?? defaults.currency;
  const effectiveLocale = locale ?? defaults.locale;

  // BigInt → Number for Intl.NumberFormat. Safe for amounts under
  // Number.MAX_SAFE_INTEGER cents (~$90 trillion). For larger, format
  // manually. D2D will not approach this at MVP scale.
  const major = Number(amount) / 100;

  const formatter = new Intl.NumberFormat(effectiveLocale, {
    style: showCode ? 'decimal' : 'currency',
    currency: effectiveCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(major);
  const display = showCode ? `${formatted} ${effectiveCurrency}` : formatted;

  return <span className={cn('numeric', className)}>{display}</span>;
}
