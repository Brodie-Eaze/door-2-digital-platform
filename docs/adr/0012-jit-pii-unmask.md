# ADR-0012 — JIT PII unmask: dual-control + 30-min grant + per-read audit

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

Operators occasionally need to see plaintext PII (debugging a lead complaint, responding to a DSAR, validating a payment dispute). Without controls, "always-on" PII access is a recipe for insider abuse.

## Decision

- PII columns are **masked by default** in every UI and audit query.
- Unmask flow:
  1. Operator clicks "Reveal PII for lead lead_…" → reason text required.
  2. Second admin (different user, `org_admin+`) WebAuthn-approves within 5 min.
  3. Grant valid for **30 minutes** and **only for that specific resource ID**.
  4. Every read during the grant writes a separate `AuditEvent { action: 'pii.unmasked', resourceId, actorUserId, reason, approvedByUserId }`.
- Mobile knocker app NEVER receives plaintext for leads they didn't capture themselves.

## Consequences

- Forensic trail for every PII reveal.
- Insider abuse requires collusion (two accounts, both WebAuthn-bound to hardware keys).
- Slows legitimate ops a little — acceptable tradeoff.
- Service: `pii-vault.unmask({ resourceId, reason, approverUserId })` returns plaintext only with a valid 30-min grant.

## Alternatives considered

- **Time-bound IAM-style policies** — equivalent but harder to audit per-reveal.
- **Static "PII-reader" role** — too coarse; rejected.
