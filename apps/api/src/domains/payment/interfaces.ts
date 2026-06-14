/**
 * Payment adapter interfaces — provider-agnostic contract.
 *
 * MiCamp (US ISO), Stripe AU, Stripe SG all implement PaymentAdapter.
 * The service layer calls these; the adapter handles the provider-specific
 * HTTP shape, auth, and error mapping.
 *
 * PCI note: raw card PANs never touch D2D servers. The mobile/web client
 * POSTs directly to the provider's hosted fields or JS-SDK; the server only
 * receives the resulting token. These interfaces model that post-tokenization
 * world only — the Tokenize* types exist for server-side sandbox testing only.
 */

export interface TokenizeCardRequest {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  billingName: string;
  billingZip?: string;
}

export interface TokenizedCard {
  token: string;
  last4: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
  expiryMonth: number;
  expiryYear: number;
}

export interface ChargeRequest {
  token: string;
  amountCents: bigint;
  currency: string;
  idempotencyKey: string;
  description: string;
  merchantId?: string;
}

export interface ChargeResult {
  transactionId: string;
  status: 'approved' | 'declined' | 'error';
  approvalCode?: string;
  declineCode?: string;
  declineMessage?: string;
  processorResidualCents: bigint;
}

export interface SubscriptionRequest {
  token: string;
  amountCents: bigint;
  currency: string;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annual';
  startDate: Date;
  idempotencyKey: string;
  description: string;
  merchantId?: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: 'active' | 'pending' | 'error';
  nextBillingDate: Date;
  processorResidualCents: bigint;
}

export interface RefundRequest {
  transactionId: string;
  amountCents: bigint;
  reason?: string;
  idempotencyKey: string;
}

export interface RefundResult {
  refundId: string;
  status: 'approved' | 'declined' | 'error';
  refundedCents: bigint;
}

export interface CancelSubscriptionResult {
  subscriptionId: string;
  status: 'cancelled';
  cancelledAt: Date;
}

export interface PaymentAdapter {
  readonly provider: string;

  /**
   * Server-side tokenization for sandbox/test. In production the mobile SDK
   * (MiCamp Hosted Fields / Stripe.js) tokenizes client-side — never send
   * raw PANs to D2D servers.
   */
  tokenizeCard(req: TokenizeCardRequest): Promise<TokenizedCard>;

  /** One-off charge against a stored token. */
  charge(req: ChargeRequest): Promise<ChargeResult>;

  /** Create a recurring subscription (monthly/weekly charity giving). */
  createSubscription(req: SubscriptionRequest): Promise<SubscriptionResult>;

  /** Cancel an active subscription. */
  cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult>;

  /** Full or partial refund against a prior transaction. */
  refund(req: RefundRequest): Promise<RefundResult>;
}
