# ADR-0019 — Commission/payout: instruct-only, never auto-debit

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

If D2D ever holds funds or initiates bank debits on a client's behalf, we become a money-transmitter in 40+ US states (requiring $500K–$2M bonds per state), need AFSL in AU, and MAS Payment Services Act licensing in SG. That's months of legal work and millions in bond capital.

Per Brodie's amala-ops convention: **the system computes, the human executes.**

## Decision

- D2D **never** initiates a transfer or holds funds.
- `services/payout` generates a **PayoutBatch** + **instruction file** (CSV / ABA / NACHA / PayNow) → uploaded to S3.
- Ops (Brodie or accountant) downloads the file, opens their banking app, and executes the transfers manually.
- The payout batch transitions `instructed → acknowledged` when ops confirms back in the UI.
- Pilot-Charlie's donor charges flow through MiCamp (US) — funds settle into **Pilot-Charlie's** MiCamp merchant account, not D2D's. D2D earns a take-rate invoice + processor residual, separately.

## Consequences

- Avoids money-transmitter regulatory regime entirely.
- Slower payouts vs auto-rails. Acceptable for fortnightly/monthly cadence.
- Cleaner audit story ("D2D never touched the money").
- Requires payout instruction file format adapters per region/bank.

## Alternatives considered

- **Direct ACH via Stripe / Wise / Airwallex** — triggers money-transmitter rules.
- **D2D-held escrow account** — same problem, plus AML obligations.
