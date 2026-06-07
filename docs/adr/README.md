# Architecture Decision Records

ADRs capture **load-bearing** architectural decisions for Door 2 Digital. Read them in number order to onboard.

Each ADR follows: **Context · Decision · Consequences · Alternatives considered**.

## Index

| #    | Title                                                                 | Status   |
| ---- | --------------------------------------------------------------------- | -------- |
| 0001 | Monorepo: Turbo + pnpm workspaces                                     | Accepted |
| 0002 | Backend: Fastify + Prisma + Postgres                                  | Accepted |
| 0003 | Mobile: native iOS via Xcode (Swift / SwiftUI)                        | Accepted |
| 0004 | Database: Aurora PostgreSQL + PostGIS                                 | Accepted |
| 0005 | Auth: AWS Cognito + first-party JWT + SAML for enterprise             | Accepted |
| 0006 | IaC: Terraform with per-env composition                               | Accepted |
| 0007 | Money as BigInt cents                                                 | Accepted |
| 0008 | Audit row in same TX (transactional outbox + hash chain)              | Accepted |
| 0009 | RFC 7807 Problem Details for all error responses                      | Accepted |
| 0010 | Idempotency keys mandatory on all POST /v1 mutations                  | Accepted |
| 0011 | PII envelope encryption + KMS per-datastore                           | Accepted |
| 0012 | JIT PII unmask: dual-control + 30-min grant + per-read audit          | Accepted |
| 0013 | Soft delete only (`status='archived'`); immutable history             | Accepted |
| 0014 | XState v5 for lifecycle state machines                                | Accepted |
| 0015 | Modular monolith with extractable services (boundary via Turbo graph) | Accepted |
| 0016 | Multi-region: region-pinned at org creation, immutable                | Accepted |
| 0017 | Webhooks isolated in `apps/webhooks` for blast-radius                 | Accepted |
| 0018 | Real-time via Ably (managed channels, JWT-scoped)                     | Accepted |
| 0019 | Commission/payout: instruct-only, never auto-debit                    | Accepted |
| 0020 | Territory geometry: PostGIS polygons + S2 cell index for heatmaps     | Accepted |
| 0021 | Multi-vertical conversion polymorphism (Donation \| Sale)             | Accepted |
| 0022 | Offline-first knocker mobile — last-write-wins with operator override | Accepted |
| 0023 | AI-generated content provenance + brand-safety scan before publish    | Accepted |
| 0024 | Charity vs commercial pricing & contract polymorphism                 | Accepted |
| 0025 | Mobile attestation required (App Attest / Play Integrity)             | Accepted |
| 0026 | WebAuthn hardware-key required for payout instruction                 | Accepted |
| 0027 | Single-monorepo until Phase 4+ (no premature splitting)               | Accepted |
| 0028 | MiCamp Gateway is the US payment processor (Brodie's ISO)             | Accepted |

## How to add a new ADR

1. Pick the next number.
2. Copy `template.md` to `NNNN-short-title.md`.
3. Fill in Context / Decision / Consequences.
4. Open a PR — Brodie + senior engineer must approve.
5. After merge, link from this README and from any related schema/code.
