/**
 * MiCamp Gateway API adapter — Brodie's ISO merchant agreement.
 *
 * Implements PaymentAdapter against the MiCamp Gateway REST API. All requests
 * are HMAC-SHA256 signed: `X-Signature = HMAC(secret, "{key}:{ts}:{method}:{path}:{bodyHash}")`.
 *
 * ISO residual: MiCamp's published ISO rate is 0.5% of transaction volume.
 * The exact cents are confirmed in the monthly remittance file; this adapter
 * computes the expected value at request time so the Conversion row is
 * immediately accurate for ledger purposes.
 *
 * Credentials (all optional in dev; required in prod):
 *   MICAMP_API_KEY          — issued per merchant / ISO agent account
 *   MICAMP_API_SECRET       — HMAC signing secret
 *   MICAMP_GATEWAY_URL      — base URL (e.g. https://gateway.micamp.com/api/v1)
 *   MICAMP_ISO_AGENT_ID     — ISO agent ID passed on every transaction for residual attribution
 *   MICAMP_WEBHOOK_SECRET   — used by the inbound webhook handler (not this adapter)
 *
 * When credentials are absent (dev / CI), every method returns a dev-mode
 * synthetic result with a deterministic sandbox token. The dev-mode branch is
 * explicit and auditable — no silent stubs.
 */
import { createHmac, createHash } from 'node:crypto';
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

// ISO residual: 0.5% of gross (confirmed rate per Brodie's ISO agreement).
function isoResidualCents(amountCents: bigint): bigint {
  return (amountCents * 5n) / 1000n;
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildSignature(
  apiKey: string,
  secret: string,
  method: string,
  path: string,
  body: string,
): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const bodyHash = sha256Hex(body);
  const payload = `${apiKey}:${ts}:${method.toUpperCase()}:${path}:${bodyHash}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${ts}.${sig}`;
}

interface MicampConfig {
  apiKey: string;
  apiSecret: string;
  gatewayUrl: string;
  isoAgentId: string;
}

async function callGateway<T>(
  config: MicampConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = buildSignature(config.apiKey, config.apiSecret, method, path, bodyStr);
  const url = `${config.gatewayUrl.replace(/\/$/, '')}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.apiKey,
      'X-Signature': signature,
    },
    body: bodyStr || undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MiCamp gateway error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ── Dev-mode synthetic results ────────────────────────────────────────────────
// Returned when credentials are absent. Makes the code-path testable in CI.

const DEV_TOKEN_PREFIX = 'micamp_dev_tok_';
const DEV_TXN_PREFIX = 'micamp_dev_txn_';
const DEV_SUB_PREFIX = 'micamp_dev_sub_';
const DEV_REFUND_PREFIX = 'micamp_dev_ref_';

function devTokenize(req: TokenizeCardRequest): TokenizedCard {
  const last4 = req.cardNumber.slice(-4);
  return {
    token: `${DEV_TOKEN_PREFIX}${last4}_${req.expiryYear}${req.expiryMonth}`,
    last4,
    brand: 'visa',
    expiryMonth: req.expiryMonth,
    expiryYear: req.expiryYear,
  };
}

function devCharge(req: ChargeRequest): ChargeResult {
  return {
    transactionId: `${DEV_TXN_PREFIX}${req.idempotencyKey.slice(-8)}`,
    status: 'approved',
    approvalCode: 'DEV000',
    processorResidualCents: isoResidualCents(req.amountCents),
  };
}

function devSubscription(req: SubscriptionRequest): SubscriptionResult {
  const nextBilling = new Date(req.startDate);
  if (req.frequency === 'monthly') nextBilling.setMonth(nextBilling.getMonth() + 1);
  else if (req.frequency === 'weekly') nextBilling.setDate(nextBilling.getDate() + 7);
  else if (req.frequency === 'fortnightly') nextBilling.setDate(nextBilling.getDate() + 14);
  else nextBilling.setFullYear(nextBilling.getFullYear() + 1);
  return {
    subscriptionId: `${DEV_SUB_PREFIX}${req.idempotencyKey.slice(-8)}`,
    status: 'active',
    nextBillingDate: nextBilling,
    processorResidualCents: isoResidualCents(req.amountCents),
  };
}

// ── MicampAdapter ─────────────────────────────────────────────────────────────

export class MicampAdapter implements PaymentAdapter {
  readonly provider = 'micamp' as const;
  private readonly config: MicampConfig | null;

  constructor() {
    const key = process.env.MICAMP_API_KEY;
    const secret = process.env.MICAMP_API_SECRET;
    const url = process.env.MICAMP_GATEWAY_URL;
    const isoAgentId = process.env.MICAMP_ISO_AGENT_ID;

    this.config =
      key && secret && url && isoAgentId
        ? { apiKey: key, apiSecret: secret, gatewayUrl: url, isoAgentId }
        : null;

    if (!this.config) {
      // Log once at startup — not per-request.
      console.warn(
        '[MicampAdapter] Credentials absent (MICAMP_API_KEY/SECRET/GATEWAY_URL/ISO_AGENT_ID) — using dev-mode synthetic responses. Set all four env vars for live payments.',
      );
    }
  }

  async tokenizeCard(req: TokenizeCardRequest): Promise<TokenizedCard> {
    if (!this.config) return devTokenize(req);

    interface MicampTokenResponse {
      token: string;
      last4: string;
      brand: string;
      expiry_month: number;
      expiry_year: number;
    }

    const res = await callGateway<MicampTokenResponse>(this.config, 'POST', '/vault/tokens', {
      card_number: req.cardNumber,
      expiry_month: req.expiryMonth.toString().padStart(2, '0'),
      expiry_year: req.expiryYear.toString(),
      cvv: req.cvv,
      billing_name: req.billingName,
      billing_zip: req.billingZip,
    });

    return {
      token: res.token,
      last4: res.last4,
      brand: (['visa', 'mastercard', 'amex', 'discover'].includes(res.brand)
        ? res.brand
        : 'unknown') as TokenizedCard['brand'],
      expiryMonth: res.expiry_month,
      expiryYear: res.expiry_year,
    };
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    if (!this.config) return devCharge(req);

    interface MicampSaleResponse {
      transaction_id: string;
      status: string;
      approval_code?: string;
      decline_code?: string;
      decline_message?: string;
    }

    const amountDollars = (Number(req.amountCents) / 100).toFixed(2);
    const res = await callGateway<MicampSaleResponse>(this.config, 'POST', '/transactions/sale', {
      token: req.token,
      amount: amountDollars,
      currency: req.currency.toUpperCase(),
      merchant_id: req.merchantId,
      iso_agent_id: this.config.isoAgentId,
      invoice_id: req.idempotencyKey,
      description: req.description,
    });

    const approved = res.status === 'approved';
    return {
      transactionId: res.transaction_id,
      status: approved ? 'approved' : 'declined',
      approvalCode: res.approval_code,
      declineCode: res.decline_code,
      declineMessage: res.decline_message,
      processorResidualCents: approved ? isoResidualCents(req.amountCents) : 0n,
    };
  }

  async createSubscription(req: SubscriptionRequest): Promise<SubscriptionResult> {
    if (!this.config) return devSubscription(req);

    interface MicampSubResponse {
      subscription_id: string;
      status: string;
      next_billing_date: string;
    }

    const amountDollars = (Number(req.amountCents) / 100).toFixed(2);
    const startDateStr = req.startDate.toISOString().split('T')[0]!;

    // MiCamp frequency mapping: weekly | bi-weekly (fortnightly) | monthly | annual
    const freqMap: Record<SubscriptionRequest['frequency'], string> = {
      weekly: 'weekly',
      fortnightly: 'bi-weekly',
      monthly: 'monthly',
      annual: 'annual',
    };

    const res = await callGateway<MicampSubResponse>(this.config, 'POST', '/subscriptions', {
      token: req.token,
      amount: amountDollars,
      currency: req.currency.toUpperCase(),
      frequency: freqMap[req.frequency],
      start_date: startDateStr,
      iso_agent_id: this.config.isoAgentId,
      merchant_id: req.merchantId,
      idempotency_key: req.idempotencyKey,
      description: req.description,
    });

    const active = res.status === 'active' || res.status === 'pending';
    return {
      subscriptionId: res.subscription_id,
      status: active ? (res.status as 'active' | 'pending') : 'error',
      nextBillingDate: new Date(res.next_billing_date),
      processorResidualCents: active ? isoResidualCents(req.amountCents) : 0n,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult> {
    if (!this.config) {
      return { subscriptionId, status: 'cancelled', cancelledAt: new Date() };
    }

    await callGateway(this.config, 'DELETE', `/subscriptions/${subscriptionId}`);
    return { subscriptionId, status: 'cancelled', cancelledAt: new Date() };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    if (!this.config) {
      return {
        refundId: `${DEV_REFUND_PREFIX}${req.idempotencyKey.slice(-8)}`,
        status: 'approved',
        refundedCents: req.amountCents,
      };
    }

    interface MicampRefundResponse {
      refund_id: string;
      status: string;
      refunded_amount: string;
    }

    const amountDollars = (Number(req.amountCents) / 100).toFixed(2);
    const res = await callGateway<MicampRefundResponse>(
      this.config,
      'POST',
      `/transactions/${req.transactionId}/refund`,
      {
        amount: amountDollars,
        reason: req.reason,
        idempotency_key: req.idempotencyKey,
      },
    );

    const approved = res.status === 'approved';
    return {
      refundId: res.refund_id,
      status: approved ? 'approved' : 'declined',
      refundedCents: approved ? BigInt(Math.round(parseFloat(res.refunded_amount) * 100)) : 0n,
    };
  }
}
