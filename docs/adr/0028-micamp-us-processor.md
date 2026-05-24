# ADR-0028 — MiCamp Gateway is the US payment processor (Brodie's ISO)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Brodie holds an ISO (Independent Sales Organization) agreement with MiCamp Solutions in the US. Every transaction processed via MiCamp under his ISO produces a residual to Brodie on top of D2D's own take rate. Using a different US processor (Stripe US, Adyen, etc.) leaves money on the table.

## Decision

- **US payments:** MiCamp Gateway API for cards, ACH, recurring donations, tokenised vault.
- **`services/payment` adapter pattern:** `MiCampAdapter` (US) + `StripeAdapter` (AU via Stripe AU + GoCardless, SG via Stripe SG + PayNow). Common interface: `PaymentMethod`, `Charge`, `Subscription`, `Refund`.
- Every `Conversion` stores `paymentProvider` discriminator + `paymentExternalId`.
- ISO residual computed at conversion-finalise time using rate card. Stored on `Conversion.processorResidualCents` for daily reconciliation against MiCamp portal export.
- MiCamp account team kickoff is a Phase 0 prerequisite (gates Phase 1.3).

## Consequences

- Brodie earns MiCamp residual on every US transaction (revenue stream beyond D2D's take rate).
- Two integration codepaths to maintain (MiCamp + Stripe).
- Recurring donation maturity depends on MiCamp's recurring API; backup plan = switch to Stripe US if MiCamp falls short, adapter pattern absorbs the swap.
- AU and SG payments deferred to Phase 2/3.

## Alternatives considered

- **Stripe US for everything** — simpler integration but forfeits MiCamp residuals.
- **Adyen** — global processor but no existing ISO relationship.
