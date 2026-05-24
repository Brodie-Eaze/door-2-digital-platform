# ADR-0011 — PII envelope encryption + KMS per-datastore

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Lead PII (name, address, phone, email, signature, photo, donation details) is the most sensitive D2D handles. Enterprise pilots, SOC 2, and per-region privacy laws (CCPA, PDPA, APP) all require strong encryption at rest with key isolation.

## Decision

- **Per-row data encryption key (DEK)** — AES-256-GCM. New DEK per encrypted row.
- **Key encryption key (KEK)** — AWS KMS customer-managed CMK per (region × datastore class). KEK never leaves KMS.
- **Wrap on write, unwrap on read.** Wrapped DEK stored alongside ciphertext.
- **AAD discriminator** — primary key + tenant id bound into ciphertext to prevent copy-paste swap attacks.
- **Searchable fields** (e.g. `User.emailDigest`, `Lead.phoneDigest`) use deterministic AES-SIV with a separate region-pinned `PII_SEARCH_KEY`. Lookup-only, never displayed.
- **Service:** `apps/api/src/domains/pii-vault/`.
- **Mask by default** in admin/audit views — JIT unmask via ADR-0012 flow.

## Consequences

- Even a full Postgres dump leaks only ciphertext.
- Cryptographic erasure on DSAR delete: drop the per-row DEK; ciphertext is permanently unreadable.
- Performance cost: ~1ms per row for KMS Decrypt; cache wrapped DEKs in-process for short window.
- Searchable fields cannot prevent rainbow-style attacks if the search key leaks — rotation policy quarterly.

## Alternatives considered

- **Application-level field encryption with a single static key** — leaks key compromise to all rows.
- **Postgres pgcrypto column-level encryption** — keys live in DB; defeats the threat model.
- **Tokenisation service** — adds a synchronous network hop on every PII read.
