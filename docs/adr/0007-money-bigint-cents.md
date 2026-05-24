# ADR-0007 — Money as BigInt cents

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Donations, sales, commissions, payouts, processor residuals, billing rake — every monetary value must be exact. Floating-point arithmetic introduces non-deterministic drift; even `0.1 + 0.2 !== 0.3`. At reconciliation time those rounding errors compound and break trust.

## Decision

- **All money in code and storage:** `bigint` representing **minor units** (cents for USD/AUD/SGD).
- **Currency carried separately:** ISO 4217 3-letter string.
- **No `Number` for money. Ever.** ESLint rule (Phase 1.1) will flag `Number(*Cents)` and similar in service code.
- **Wire format:** `{ cents: string, currency: string }` (because `bigint` doesn't serialize to JSON natively).
- **Display:** `<Money cents={...} region={...} />` from `@d2d/ui-web` (handles `Intl.NumberFormat`).
- **Arithmetic helpers:** `@d2d/shared-utils/money` — `add`, `subtract`, `multiplyByInt`, `takeRate`, `processorResidual`.

## Consequences

- Reconciliation deterministic to the cent.
- Slightly heavier wire payloads (string vs number).
- Cross-currency operations throw — explicit conversion required via future FX service.
- BigInt → Number for `Intl.NumberFormat` is safe under `Number.MAX_SAFE_INTEGER` cents (~$90T). D2D will not approach this.

## Alternatives considered

- **`decimal.js`** — heavier than needed; BigInt is native.
- **Postgres `numeric(19,4)`** — fine in DB but doesn't help in app code.
- **Float dollars** — rejected; the entire purpose of this ADR is to avoid it.
