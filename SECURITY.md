# Security

Door 2 Digital handles donor PII, charity registration data, and payment instruments across multiple jurisdictions. Security is a Day-1 commitment, not a Phase-N concern.

## Reporting a vulnerability

**Do NOT open a public GitHub issue.** Email **security@door2digital.io** (set up in Phase 0) with:

- Description of the issue
- Reproduction steps
- Impact assessment (your read)
- Your contact for follow-up

We acknowledge within 24 hours and aim for a fix or mitigation within:
- **Critical:** 24 hours
- **High:** 72 hours
- **Medium:** 7 days
- **Low:** 30 days

Coordinated disclosure preferred. We'll credit you in the fix announcement unless you prefer anonymity.

## Bug bounty

- **Phase 3:** invite-only via Bugcrowd or HackerOne.
- **Phase 4:** public bug bounty.

## Production security controls

### Authentication & authorisation

- AWS Cognito user pools + first-party JWT (RS256, ≤5 min lifetime)
- SAML 2.0 SP for enterprise tenants (Pilot-Charlie via Okta)
- WebAuthn hardware key required for: `super_admin` actions, payout instructions, lead PII unmask (with second-admin approver), payment instrument read
- 8-role RBAC + ABAC enforced at BFF + service + DB layers
- All admin actions audit-logged

### Data protection

- TLS 1.3 external, mTLS internal (Phase 4+)
- AWS KMS per-datastore + envelope encryption (AES-256-GCM) for all PII
- Deterministic AES-SIV for searchable fields (email/phone digests)
- JIT PII unmask: dual-control, 30-min grant, per-read audit row (ADR-0012)
- Hash-chained immutable audit outbox → S3 Object Lock COMPLIANCE 7-year retention (ADR-0008)
- Weekly Merkle root committed to `docs/audits/merkle-roots/<region>/<YYYY>-W<NN>.json` for public tamper-evidence

### Regional isolation

- Per-region Aurora cluster: `d2d-us-iad`, `d2d-au-syd`, `d2d-sg-sin`
- Org region pinned at creation, **immutable** (DB CHECK + trigger)
- `RegionGuard` middleware enforces on every regulated write
- No cross-region data plane reads; operator console uses pre-aggregated signed rollups (no PII)

### Application layer

- Strict CSP (`default-src 'self'`, no `unsafe-inline` in scripts, `frame-ancestors 'none'`)
- HSTS 2-year preload
- AWS WAF managed rules + custom rate limits
- All endpoints documented in OpenAPI (no shadow APIs)
- All errors return RFC 7807 Problem Details (no stack leakage)
- All POST mutations require `Idempotency-Key`

### Mobile

- App Attest (iOS) / Play Integrity (Android) attestation on every sync
- Certificate pinning (SPKI hashes for API + auth + S3 upload)
- Jailbreak/root detection → app refuses to run on rooted devices
- Biometric re-auth on backgrounding >60s
- Encrypted SQLite (SQLCipher) for offline knock data
- Per-blob DEK for photos/signatures until sync confirmed
- `FLAG_SECURE` (Android) + iOS overlay on PII screens

### Secrets

- AWS Secrets Manager + Parameter Store in production (no env vars on EC2/ECS)
- `.env.local` for dev only (gitignored)
- Gitleaks pre-commit + CI
- Rotation: DB creds 30d, API keys 90d, KMS data keys hourly, webhook secrets on request

### Supply chain

- pnpm-lock committed; Renovate with security PRs
- Trivy scans deps + container + IaC in CI
- Semgrep SAST every PR
- Syft SBOM per release
- Cosign-signed container images (Phase 4)

### Compliance posture

- **SOC 2 Type I** evidence collection Phase 1.4, report by end Phase 2
- **SOC 2 Type II** 90-day observation window opens Phase 3
- **CCPA / CPRA + 7 state privacy laws** — Phase 1
- **TCPA** prior-express-written-consent capture — Phase 1
- **ACNC / FundraisingNSW** — Phase 2 (AU)
- **PDPA** — Phase 3 (SG)
- **Paid-solicitor registrations** — counsel-led, table-driven state-clearance engine in code

### Penetration testing

- Independent pen test before public SaaS launch (Phase 4) by a reputable firm
- Pen test readiness checklist: `docs/PEN_TEST_READINESS.md` (Phase 1.4)

## Responsible AI

- All AI-generated content carries C2PA provenance manifests
- Anthropic moderation API + custom brand-safety rules before publish
- Per-jurisdiction legal-held terms (charity standards, FTC Green Guides, AER retail code, etc.)
- Org-level opt-out for AI retargeting (`Org.aiRetargetingOptOut`)
- Lead data anonymised to tract/SA1/subzone level before prompts; never sent as raw PII

## Incident response

Runbooks under `docs/runbooks/`:
- `incident-response.md` — SEV1/2/3 ladder + on-call procedure
- `data-breach-72h.md` — OAIC (AU) / PDPC (SG) / state AG (US) notification
- `payment-incident.md` — Stripe/MiCamp processor incident
- `region-failover.md` — region-level DR
- `ai-brand-safety-failure.md` — pause campaign within 15 min of detection
- `audit-chain-mismatch.md` — chain integrity failure procedure

## `.well-known/security.txt`

Will be served from every public web surface (Phase 4):

```
Contact: mailto:security@door2digital.io
Expires: 2027-12-31T00:00:00.000Z
Preferred-Languages: en
Canonical: https://d2d.io/.well-known/security.txt
Policy: https://d2d.io/security
```
