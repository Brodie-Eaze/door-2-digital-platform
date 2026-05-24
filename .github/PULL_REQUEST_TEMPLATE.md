<!--
  Door 2 Digital — Pull Request

  Hard rules every PR must satisfy:
    1. Money values use BigInt cents (ADR-0007)
    2. Regulated mutations write audit row in same TX (ADR-0008)
    3. Error responses are RFC 7807 Problem Details (ADR-0009)
    4. POST mutations require Idempotency-Key (ADR-0010)
    5. PII columns marked /// PII, routed through pii-vault (ADR-0011)
    6. Soft-delete only (status='archived'), never DELETE (ADR-0013)
    7. Region pinning enforced (ADR-0016) — RegionGuard middleware
    8. Architectural changes require an ADR in docs/adr/
-->

## Summary

<!-- 1–3 bullets describing what this PR does. Why, not what. -->

## Phase

- [ ] Phase 0 — scaffold
- [ ] Phase 1.1 — Foundations + Auth + Org
- [ ] Phase 1.2 — Field capture + CRM + Compliance core
- [ ] Phase 1.3 — Conversion + Payment + Commissions
- [ ] Phase 1.4 — Enterprise hardening + go-live
- [ ] Phase 2 — AU expansion
- [ ] Phase 3 — SG + AI Marketing Studio
- [ ] Phase 4 — Public SaaS + AWS migration

## Hard-rules checklist

- [ ] Money values use BigInt cents via `@d2d/shared-utils/money`
- [ ] Regulated mutations write audit row in same TX
- [ ] Error responses use `ProblemError(Problems.x())` → RFC 7807
- [ ] POST routes call `requireIdempotencyKey(req)`
- [ ] PII columns marked `/// PII` + flow through `pii-vault`
- [ ] Soft-delete (`status='archived'`) — no DELETE statements
- [ ] Region-pinned writes call `assertRegionMatches(org, req)`
- [ ] Architectural changes accompanied by ADR in `docs/adr/`

## Test plan

- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test` green (affected scope)
- [ ] Integration test added if touching API/DB
- [ ] Manual verification steps documented below

<!-- Steps to manually verify locally. -->

## Risk / rollback

<!-- What could break? How do we roll back? -->
