/**
 * Stripe payment adapter stubs — Phase 2 (AU) + Phase 3 (SG).
 *
 * Phase 1 US launch uses MiCamp only. These adapters throw at runtime until
 * the corresponding Stripe keys are configured. They exist so the factory can
 * resolve the adapter for AU/SG org rows without a null check cascade.
 *
 * TODO Phase 2: install stripe npm package + implement real calls.
 */
import type {
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
} from '../interfaces';

function notImplemented(phase: string): never {
  throw new Error(
    `Payment provider not configured — ${phase}. Add the relevant Stripe secret key.`,
  );
}

export class StripeAuAdapter implements PaymentAdapter {
  readonly provider = 'stripe_au' as const;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async tokenizeCard(_req: TokenizeCardRequest): Promise<TokenizedCard> {
    return notImplemented('Phase 2 / Stripe AU');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async charge(_req: ChargeRequest): Promise<ChargeResult> {
    return notImplemented('Phase 2 / Stripe AU');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createSubscription(_req: SubscriptionRequest): Promise<SubscriptionResult> {
    return notImplemented('Phase 2 / Stripe AU');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cancelSubscription(_subscriptionId: string): Promise<CancelSubscriptionResult> {
    return notImplemented('Phase 2 / Stripe AU');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refund(_req: RefundRequest): Promise<RefundResult> {
    return notImplemented('Phase 2 / Stripe AU');
  }
}

export class StripeSgAdapter implements PaymentAdapter {
  readonly provider = 'stripe_sg' as const;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async tokenizeCard(_req: TokenizeCardRequest): Promise<TokenizedCard> {
    return notImplemented('Phase 3 / Stripe SG');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async charge(_req: ChargeRequest): Promise<ChargeResult> {
    return notImplemented('Phase 3 / Stripe SG');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createSubscription(_req: SubscriptionRequest): Promise<SubscriptionResult> {
    return notImplemented('Phase 3 / Stripe SG');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cancelSubscription(_subscriptionId: string): Promise<CancelSubscriptionResult> {
    return notImplemented('Phase 3 / Stripe SG');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refund(_req: RefundRequest): Promise<RefundResult> {
    return notImplemented('Phase 3 / Stripe SG');
  }
}
