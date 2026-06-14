# D2D Platform — Honest Gap Map

**Date:** 2026-06-14 · **Branch:** `fix/soc2-security-floor`  
**Purpose:** Separate what code can close vs what only Brodie can action.

---

## 1. Things Only Brodie Can Do (Human-Gated)

These cannot be closed by any amount of code generation. Each has a real-world blocker.

| #       | Action                                                                                        | Why you specifically                                                                                            | Estimated time           |
| ------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **H1**  | **Merge the 11 open PRs**                                                                     | Only you can merge on GitHub — git-push + auto-merge is disabled by safety rail                                 | 10 min                   |
| **H2**  | **Bootstrap AWS state backend** (S3 + DynamoDB) then run `terraform init` + `terraform apply` | Requires your AWS credentials for the `d2d-prod` account — see `infra/runbooks/aws-prod-deploy.md` Step 0       | 60–90 min                |
| **H3**  | **Inject 13 required secrets** via `aws secretsmanager put-secret-value`                      | Each secret needs a real cryptographic value — random generation commands are in the runbook Step 5             | 20 min                   |
| **H4**  | **Build + push Docker image to ECR**                                                          | Requires Docker Desktop running locally + AWS ECR login — Step 6 of runbook                                     | 15 min                   |
| **H5**  | **Issue ACM TLS certificate** for `api.door2digital.com` and point Route 53 at the ALB        | Requires Route 53 write access + domain ownership confirmation                                                  | 30 min                   |
| **H6**  | **MiCamp Gateway API sandbox credentials**                                                    | Account-team call; no public signup path                                                                        | 1–2 days                 |
| **H7**  | **Pilot-Charlie SSO/SAML IdP details**                                                        | Pilot-Charlie's IT admin must supply entityId + Okta/AzureAD SSO URL + signing certificate                      | Pilot-Charlie's calendar |
| **H8**  | **Counsel's state-clearance schedule**                                                        | External counsel is running parallel paid-solicitor registrations; only they know the order                     | Ongoing — check weekly   |
| **H9**  | **Obtain MiCamp ISO residual rate card in writing**                                           | Needed to validate `computeProcessorResidualCents` (currently 0.5% stub); mismatch = revenue leak               | 1 call                   |
| **H10** | **Engage CREST-grade pen-test firm** (Phase 1.4 gate)                                         | Bastion, Pure Hacking, or equivalent; cannot be substituted by AI red-teaming                                   | 4–6 weeks lead time      |
| **H11** | **Enrol with Bug Bounty platform** (Bugcrowd / HackerOne invite-only Phase 3)                 | Requires company verification + scope definition                                                                | 1 week                   |
| **H12** | **SOC 2 Type I — engage CPA firm**                                                            | Only an independent CPA firm can issue the report; `docs/soc2/` directory is empty (control matrix not written) | 6–12 week engagement     |
| **H13** | **Apple Developer + Google Play accounts for white-label builds**                             | Requires legal entity name + payment                                                                            | 1–3 days                 |
| **H14** | **Pilot-Charlie contract countersign** ($2,500/mo + 5/10/15% rake)                            | Legal instrument — must be you                                                                                  | 1 meeting                |
| **H15** | **D2D US legal entity registration** (DE C-corp or US LLC)                                    | Counsel + registered agent                                                                                      | 2–4 weeks                |

---

## 2. Code-Closable Gaps (Agent Can Build)

Ordered by Priority for Pilot-Charlie launch readiness.

### P0 — Launch Blockers (must close before Pilot-Charlie go-live)

| ID         | Domain     | Gap                                                                                                                                                                                         | Effort                                  |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --- |
| ~~**C1**~~ | Auth       | ~~501 stub~~ **ALREADY DONE** (WS4/Task #98) — `POST /v1/auth/sso/:orgSlug/acs` processes signed SAMLResponse, JIT-provisions user, issues JWT; `GET /sso/:orgSlug/metadata` returns SP XML | M                                       |
| ~~**C2**~~ | Auth       | ~~`POST /v1/auth/mfa/verify` and `GET /v1/auth/mfa/setup` are 501 stubs~~ **CLOSED 2026-06-14** — TOTP MFA real: migration + AES-256-GCM encrypted credential + setup + verify routes       | S                                       |
| ~~**C3**~~ | Sale       | ~~`PATCH /v1/sales/:id/status` is a 501 stub — sale lifecycle is incomplete~~ **CLOSED 2026-06-14** — status transitions (pending_install→installed                                         | cancelled, installed→cancelled) + audit | M   |
| ~~**C4**~~ | Donation   | ~~501 stubs~~ **ALREADY DONE** — `cancelDonation` + `changeDonationAmount` wired; only Phase 1.4 `resume`/`receipt` remain 501                                                              | S                                       |
| ~~**C5**~~ | Lead       | ~~501 stub~~ **ALREADY DONE** — `assignLead` imported + `POST /:id/assign` route wired                                                                                                      | S                                       |
| ~~**C6**~~ | Conversion | ~~501~~ **ALREADY DONE** — `listConversions` cursor-paginated endpoint live; only Phase 1.4 refund/dispute remain 501                                                                       | S                                       |
| ~~**C7**~~ | Billing    | ~~501 stubs~~ **ALREADY DONE** (Task #121) — Invoice schema + generate + list + residuals wired                                                                                             | L                                       |
| ~~**C8**~~ | CI         | ~~echo TODO~~ **ALREADY DONE** — `tests/integration/cross-tenant-isolation.test.ts` (269 lines, real vitest suite); CI Gate 9 checks file + line count                                      | S                                       |

### P1 — Important Before Scale (close before 200+ knockers)

| ID          | Domain     | Gap                                                                                                                                                                                                            | Effort |
| ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| ~~**C9**~~  | Commission | ~~deferred~~ **ALREADY DONE** — `accrueKnockCommission` called inside `createKnockBatch` TX at line 720; commission rows created per-batch atomically                                                          | M      |
| ~~**C10**~~ | Payout     | ~~no idempotency guard~~ **CLOSED 2026-06-14** — `@@unique([orgId, periodStart, periodEnd])` DB constraint + P2002→409 catch in `generatePayoutBatch`                                                          | S      |
| ~~**C11**~~ | Audit      | ~~echo TODO~~ **ALREADY DONE** — CI Gate 10 (`audit-chain-verify` job) runs `pnpm audit:verify` → `src/scripts/audit-chain-verify.ts` weekly on schedule                                                       | M      |
| ~~**C12**~~ | Compliance | ~~`POST /v1/compliance/state-clearance` is a 501~~ **CLOSED 2026-06-14** — manual clearance for post-approval campaigns: validates reg + expiry + state match + tenant, upserts CampaignStateClearance + audit | S      |
| ~~**C13**~~ | DNC/DNK    | ~~no dnk-sync job~~ **ALREADY DONE** — `apps/api/src/workers/dnk-sync.worker.ts` nightly FTC DNC + DNK feed ingestion via BullMQ                                                                               | M      |
| ~~**C14**~~ | Realtime   | ~~501~~ **ALREADY DONE** — `POST /v1/realtime/tokens` HMAC-signed Ably TokenRequest; 503 when `ABLY_API_KEY` absent                                                                                            | S      |
| ~~**C15**~~ | PII Vault  | ~~501~~ **ALREADY DONE** — full JIT unmask flow: unmask-request → unmask-approve (second approver) → reveal; audit row per reveal                                                                              | M      |
| ~~**C16**~~ | Security   | ~~unsafe-inline~~ **ALREADY DONE** — helmet CSP has no `unsafe-inline` in any directive; `style-src: ["'self'"]` only                                                                                          | S      |
| ~~**C17**~~ | CI         | ~~not added~~ **ALREADY DONE** — `.github/dependabot.yml` present: npm weekly grouped + github-actions weekly                                                                                                  | S      |

### P2 — Phase 1.4 / SOC 2 Hardening

| ID          | Domain  | Gap                                                                                                                                                                                                            | Effort |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **C18**     | Auth    | WebAuthn hardware-key enforcement for `super_admin` payout instruction not wired                                                                                                                               | M      |
| ~~**C19**~~ | DSAR    | ~~501 stubs~~ **CLOSED 2026-06-14** — full DSAR lifecycle: file/list/get/fulfil/reject; `DsarRequest` model + migration; per-jurisdiction SLAs (AU 30d, CCPA/CPRA 45d, GDPR 30d); audit row every state change | M      |
| ~~**C20**~~ | Consent | ~~501 stubs~~ **ALREADY DONE** — `POST /v1/consent/capture`, `GET /v1/consent/lookup`, `POST /v1/consent/:id/withdraw` all wired to real service                                                               | S      |
| ~~**C21**~~ | CRM     | ~~501 stubs~~ **PARTIALLY DONE** — `GET /v1/crm/activities` live (paginated, org-scoped); sequences remain 501 — require BullMQ step workers (Phase 1.3b)                                                      | M      |
| ~~**C22**~~ | User    | ~~501 stub~~ **ALREADY DONE** — `DELETE /v1/users/:id` calls `archiveUser` (ADR-0013 soft-delete)                                                                                                              | S      |
| **C23**     | Audit   | Audit S3 Object Lock COMPLIANCE sink — `audit-ship` BullMQ worker not built                                                                                                                                    | L      |
| **C24**     | RLS     | `C2 · RLS belt for new tables` (Task #120) — deferred; PropensityScore + KnockerShift tables not under RLS                                                                                                     | M      |
| **C25**     | SOC2    | `docs/soc2/controls.md` control matrix is an empty directory — needs CC1–CC9 mapped                                                                                                                            | L      |

---

## 3. What's Solid (Do Not Touch Without a Good Reason)

These are production-grade and should not be re-implemented or "improved" casually:

- **Tenant isolation**: `tenantTx` + RLS GUC + `TenantGuard` triple-layer (Tasks 95, 101–104)
- **Commission math**: BigInt percent = `(cents * BigInt(Math.round(pct * 10))) / 1000n` — do not switch to floats
- **Payment adapter pattern**: MiCampAdapter + StripeAdapter both behind the common interface; swap path is clean
- **Payout ADR-0019**: Never auto-pays. Instruction file only. Hard rule.
- **Analytics transactional outbox**: `emitAnalyticsEvent(tx, ...)` always receives the caller's TX — no drift from OLTP
- **Compliance state-clearance gate**: `assertStateCleared()` in conversion create path — hard P0 legal gate
- **SAML JWKS + token revocation epoch**: Wired in auth service; do not remove the epoch check
- **PII write-path**: Donor email stored as `'redacted@vaulted'` with mask-on-read — never store real PII in the Donation row

---

## 4. PR Merge Queue (Brodie's Action — H1 above)

These 11 PRs are committed and staged on `fix/soc2-security-floor`. They need to be merged into `main`. All pass CI as of last push.

Merge order doesn't strictly matter (no conflicts) but suggested:

1. WS1 · Tenant isolation defense-in-depth (SEC-005)
2. WS6 · Postgres RLS belt
3. SEC-004 · Access-token revocation epoch
4. SOC2 P0 security findings (D1–D5, 4 merged fix branches)
5. WS2 · MiCamp Gateway payment adapter
6. WS3 · Compliance state-clearance engine
7. WS4 · SAML 2.0 SSO
8. WS5 · AWS prod IaC
9. Phase 1.3 commission + payout backend
10. C3 analytics wiring
11. AWS prod deploy runbook

---

## 5. The Critical Path to Pilot-Charlie Go-Live

```
Week 1 (You):
  H1 — Merge all 11 PRs
  H6 — Get MiCamp sandbox creds
  H7 — Get Pilot-Charlie SSO details

  Code (Agent):
  C1 — SAML ACS endpoint
  C7 — Billing invoice generation
  C8 — Real cross-tenant CI probe

Week 2 (You):
  H2–H5 — AWS prod deploy (follow runbook)
  H9 — Confirm MiCamp rate card

  Code (Agent):
  C2, C3, C4 — Auth MFA + Sale + Donation lifecycle
  C14 — Ably realtime token endpoint
  C9 — Batch-knock commission accrual

Week 3–4:
  H8 — First cleared state(s) from counsel → update CampaignStateClearance
  Phased knocker rollout: 10 → 50 → 200+

  Code (Agent):
  C13 — DNC/DNK scrub cron
  C11 — Audit chain Merkle replay CI
  C12 — State-clearance admin endpoint
```

---

_Gap map is a point-in-time snapshot — update whenever a gap closes or a new one surfaces._
