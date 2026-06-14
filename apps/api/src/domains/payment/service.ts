/**
 * Payment service — adapter factory + thin business-logic wrapper.
 *
 * Selects the correct PaymentAdapter by `PaymentProvider` enum value and
 * delegates to it. Callers (conversion service, donation workers, refund
 * routes) should import from here, not from the adapters directly.
 *
 * ISO residual note: MicampAdapter already computes `processorResidualCents`
 * at transaction time. The returned value is persisted to `Conversion` so
 * the ledger is immediately accurate before the monthly remittance lands.
 */
import type { PaymentProvider } from '@prisma/client';
import { MicampAdapter } from './adapters/micamp';
import { StripeAuAdapter, StripeSgAdapter } from './adapters/stripe';
import type { PaymentAdapter } from './interfaces';

// Singleton instances — adapters read env-vars once at construction.
let _micamp: MicampAdapter | undefined;
let _stripeAu: StripeAuAdapter | undefined;
let _stripeSg: StripeSgAdapter | undefined;

export function getAdapter(provider: PaymentProvider): PaymentAdapter {
  switch (provider) {
    case 'micamp':
      return (_micamp ??= new MicampAdapter());
    case 'stripe_au':
      return (_stripeAu ??= new StripeAuAdapter());
    case 'stripe_sg':
      return (_stripeSg ??= new StripeSgAdapter());
    default: {
      // TypeScript exhaustiveness guard — should never reach at runtime.
      const _: never = provider;
      throw new Error(`Unknown payment provider: ${String(_)}`);
    }
  }
}

// Re-export types so callers can import from one place.
export type {
  ChargeRequest,
  ChargeResult,
  CancelSubscriptionResult,
  PaymentAdapter,
  RefundRequest,
  RefundResult,
  SubscriptionRequest,
  SubscriptionResult,
  TokenizeCardRequest,
  TokenizedCard,
} from './interfaces';
