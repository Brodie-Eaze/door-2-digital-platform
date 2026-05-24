# ADR-0022 — Offline-first knocker mobile — last-write-wins with operator override

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Knockers operate at doors with patchy or no connectivity. The app must capture knocks fully offline and reconcile when network returns — without losing data or duplicating rows.

## Decision

- All writes (knock, lead, signature, photo) land in encrypted local storage (SwiftData or GRDB) first.
- A FIFO sync queue retries failed uploads with exponential backoff.
- Each knock carries a client-generated `idempotencyKey` (ULID); server dedupe by key.
- Batch sync via `POST /v1/knocks/batch` with up to 500 knocks per call.
- **Conflict resolution: last-write-wins** by `serverReceivedAt`. If the server already has the knock (same idempotency key) but newer data exists server-side (e.g. manager updated the disposition), the **manager wins** — server returns the canonical record and client replaces local.
- Photos/signatures encrypted on device with per-blob DEK until successful sync, then DEK destroyed locally.
- `clientOffsetMs` (device clock vs server clock at last successful sync) stored on every knock — fraud signal for impossibly-fast knock cadence.

## Consequences

- Knocker never loses captured data due to network.
- Manager overrides knocker for after-the-fact corrections.
- Storage on device bounded by sync queue depth.
- Time-skewed devices flag for fraud review.

## Alternatives considered

- **Online-only with retries** — useless at most doors.
- **CRDTs** — overkill for this conflict surface.
- **Server-wins always** — knocker frustration when typo-fixed locally then overwritten.
