# ADR-0008 — Audit row in same TX (transactional outbox + hash chain)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Every regulated mutation (knock, lead, conversion, donation, sale, commission, payout, consent, PII unmask, ad publish) must produce an audit row that:

1. Cannot be lost (no fire-and-forget logging)
2. Cannot be edited after the fact
3. Cannot have rows inserted out of band
4. Survives regulator review and pen tests

## Decision

- **Same-TX outbox:** every domain service writes its mutation AND an `AuditEvent` row in the same `prisma.$transaction`. If either fails, both roll back.
- **Hash chain:** each `AuditEvent` carries `prevHash` (previous row's `rowHash`) and `rowHash` (HMAC-SHA256 over `prevHash || canonicalize(rest of row)`). Helper in `@d2d/shared-utils/audit-chain`.
- **Genesis:** first row in each region uses `prevHash = 'GENESIS'`.
- **Drain:** `worker:audit-shipper` reads `shippedToS3At IS NULL` rows every 60s and writes them to S3 with Object Lock COMPLIANCE mode, 7-year retention.
- **Verification:** weekly CI job replays the chain per region; any mismatch fails the build and pages on-call.
- **Merkle root:** weekly root committed to `docs/audits/merkle-roots/<region>/<YYYY>-W<NN>.json` for public tamper-evidence.

## Consequences

- Regulators see an unbroken chain.
- Pen-tester attempts to backfill or edit will fail verification on next replay.
- Cannot bulk-delete audit rows.
- DB write amplification: every regulated mutation costs an extra row. Acceptable at expected scale.

## Alternatives considered

- **Append-only Postgres extension + WAL stream** — overkill at our scale and operationally heavy.
- **Send audit to Kafka** — adds new infrastructure; same-TX gives stronger consistency.
- **Database triggers writing audit rows** — opaque to service code; hard to canonicalize payload.
