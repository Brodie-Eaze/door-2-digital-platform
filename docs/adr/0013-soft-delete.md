# ADR-0013 — Soft delete only (`status='archived'`); immutable history

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Regulators (ACNC, IRS, state charity offices, PDPC) need to see the full history of a conversion, payout, or commission record. Hard DELETE breaks audit chains and DSAR fulfillment.

## Decision

- All regulated tables carry a `status` column (`active | archived` and variants).
- Soft-delete sets `status = 'archived'` and `archivedAt = now()`.
- No `DELETE FROM <regulated_table>` in application code. CI lint rule (Phase 1.1) flags `prisma.<x>.delete()` calls on regulated models.
- DSAR delete uses **cryptographic erasure** (ADR-0011) — drop the per-row DEK from the PII vault; ciphertext is forever unreadable but the row persists for ledger integrity.
- TTL-bounded tables (`IdempotencyRecord`, `RateLimitBuckets`) DO allow DELETE — they're not regulated history.

## Consequences

- Storage grows monotonically; archive to S3 after N years per retention policy.
- DSAR fulfillment is a separate concern from row deletion.
- Index strategy must filter `status = 'active'` for hot reads.

## Alternatives considered

- **Hard delete + audit-log-as-truth** — works but DSAR proof becomes harder ("we deleted the row but the audit log says it existed").
- **Append-only event sourcing** — overkill for our scale.
