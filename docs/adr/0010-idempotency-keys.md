# ADR-0010 — Idempotency keys mandatory on all POST /v1 mutations

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

The knocker iOS app retries failed syncs. Inside-sales reps double-click "Save". Webhook senders retry on timeout. Without idempotency, a network blip can charge a donor twice, double-count a knock, or generate two commission rows for one conversion.

## Decision

- Every `POST` route under `/v1/*` MUST accept and validate an `Idempotency-Key` header.
- Format: 8–64 chars, `[a-zA-Z0-9._-]`. Clients commonly send ULIDs.
- Server hashes request body (canonical JSON) and stores `{key, orgId, method, path, bodyHash, responseStatus, responseBodyKey, expiresAt}` in `IdempotencyRecord`.
- TTL: 24 hours.
- Replay with same key + same body → return stored response identically.
- Replay with same key + different body → `409 idempotency-key-conflict`.
- Helper: `requireIdempotencyKey(req)` in `apps/api/src/shared/middleware/idempotency.ts`.

## Consequences

- Safe client retries.
- Storage cost — bounded by 24h TTL.
- Response body sometimes too large for PG row → S3 key indirection.
- Knock batch endpoint accepts per-knock idempotency keys inside the batch (Phase 1.2).

## Alternatives considered

- **At-least-once + downstream dedupe** — pushes complexity onto every consumer.
- **Optimistic locking via `version`** — addresses a different problem (concurrent edits, not retries).
