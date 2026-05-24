# ADR-0016 — Multi-region: region-pinned at org creation, immutable

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Pilot-Charlie is US — but the platform will eventually serve AU and SG tenants. Privacy law (APP 8, PDPA s.26) effectively forbids cross-border movement of donor PII without explicit consent or comparable-protection findings. Regulators want a clean "AU PII never leaves AU" story.

## Decision

- One Aurora cluster per region: `d2d-us-iad`, `d2d-au-syd`, `d2d-sg-sin`. Plus a small global control plane in `us-east-1` for org→region routing.
- `Org.regionCode` is **IMMUTABLE** — DB CHECK + trigger that raises on UPDATE.
- `RegionGuard` middleware asserts `org.regionCode === process.env.AWS_REGION` on every regulated mutation. Mismatch returns `403 region-mismatch` + audit row.
- DB users are subnet-scoped — pg_hba.conf rejects cross-region connections at the network layer.
- No cross-region read in application data plane. Operator-console aggregates use signed pre-aggregated rollups (no PII).

## Consequences

- Clean compliance story for auditors.
- DR is per-region (backups stay in-region).
- Migrating a tenant to a different region requires offline export → import (rare).
- Phase 1 only US region; AU + SG infra Phase 2/3.

## Alternatives considered

- **Aurora Global Database with tablespace pinning** — replicates everything to every secondary; defeats residency.
- **Logical replication carve-outs** — operationally fragile; auditors won't accept.
