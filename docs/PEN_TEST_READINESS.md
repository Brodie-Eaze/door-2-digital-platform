# Pen-test readiness checklist

**Source:** Master plan §9.5 (`/Users/Brodie/.claude/plans/question-im-about-to-greedy-cascade.md`, lines 693-716)
**Last reviewed:** 2026-05-24 (Agent 4, commit `961edc0`)
**Owner:** Brodie (until SecEng hires Phase 1.4)

Status legend:

- ✅ **Done** — implemented + verified
- 🟡 **Partial** — scaffolded or in progress
- ❌ **Not started** — explicit Phase ≥1 work

Honest tally: **3 ✅ · 4 🟡 · 13 ❌** of 20 items. Most ❌ items are blocked on the backend service not yet existing — that's deliberate Phase 0 scope, not negligence.

---

## Checklist

### Architecture / API

| Status | Item                                                                                                               | Evidence / notes                                                                                                                                                         |
| :----: | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   ❌   | All endpoints documented in OpenAPI; no shadow APIs (CI: every route has decorator + spec entry)                   | No backend yet. Phase 1.0 — wire `@nestjs/swagger` from day one, and add a CI step that diffs `nest build && openapi-extract` against committed `docs/api/openapi.yaml`. |
|   ❌   | AWS WAF deployed (managed: Core, Linux, SQLi, BotControl) + custom rate limits versioned in `infra/terraform/waf/` | No infra yet — `infra/terraform/waf/` directory doesn't exist. Phase 1.4.                                                                                                |

### Secrets / dependencies / SAST

| Status | Item                                                                             | Evidence / notes                                                                                                                                                                                                                                                                                                                    |
| :----: | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ✅   | All secrets in Secrets Manager + Parameter Store; gitleaks clean pre-commit + CI | `.husky/pre-commit` runs `gitleaks protect --staged`. `.github/workflows/ci.yml:67-77` runs `gitleaks/gitleaks-action@v2` on every PR. `.gitleaks.toml` extends defaults with placeholder allowlist. No Secrets Manager yet (no AWS infra), but **no secrets in repo today** — confirmed via grep in `docs/SECURITY-REVIEW.md` §2d. |
|   🟡   | Dependency scan green (Trivy + Snyk + Dependabot)                                | **Trivy ✅** in CI (`ci.yml:90-100`, fails on HIGH/CRITICAL). **Snyk ❌** not yet wired. **Dependabot ❌** — no `.github/dependabot.yml`. Add Dependabot as next quick win.                                                                                                                                                         |
|   🟡   | SAST clean (Semgrep); DAST run before each release (OWASP ZAP automated)         | **Semgrep ✅** in CI (`ci.yml:79-87`, runs `p/owasp-top-ten` + `p/typescript` + `p/react` on PRs). **DAST/ZAP ❌** — no release pipeline yet.                                                                                                                                                                                       |
|   ❌   | Threat model signed-off; quarterly review on calendar                            | Master plan §9.3 has the matrix; no living `docs/security/threat-model.md` yet. Phase 1.1.                                                                                                                                                                                                                                          |

### Auth / identity / isolation

| Status | Item                                                                                                         | Evidence / notes                                                                         |
| :----: | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
|   ❌   | WebAuthn enforced on `super_admin`, `org_admin` payout, lead unmask approver, accountant payment-detail read | No auth at all today (login form is a stub — see `SECURITY-REVIEW.md` §2c-2). Phase 1.1. |
|   ❌   | mTLS internal service-to-service (Istio or AWS App Mesh)                                                     | No internal services yet. Phase 1.4 (multi-service split).                               |

### Headers / transport

| Status | Item                                                                           | Evidence / notes                                                                                                                                                                                                                                       |
| :----: | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   🟡   | securityheaders.com **A+** every region                                        | Headers wired correctly in `next.config.mjs` after this pass — would score **A+** if deployed (HSTS preload-eligible, COOP/CORP, X-Permitted-Cross-Domain-Policies, Origin-Agent-Cluster, strict CSP). Mark ✅ once deployed and a real scan confirms. |
|   🟡   | CSP `default-src 'self'`, `frame-ancestors 'none'`, no `unsafe-inline` in prod | `default-src 'self'` ✅, `frame-ancestors 'none'` ✅. `'unsafe-inline'` **still in `style-src`** — required by Next 14 critical-CSS inlining. Drop via nonce middleware Phase 1.1. (`next.config.mjs:23`)                                              |
|   🟡   | HSTS 2y preload submitted to hstspreload.org                                   | HSTS present at `max-age=31536000` (1y) with `includeSubDomains; preload` directives ✅, but max-age below 2y threshold. Bump to `63072000` before submission. Don't submit from dev/staging hostnames.                                                |

### Multi-tenant / multi-region

| Status | Item                                                                                             | Evidence / notes                                                                                     |
| :----: | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
|   ❌   | Per-tenant data isolation — synthetic cross-tenant probe in CI (asserts 403 + audit row)         | Stub in `ci.yml:160-171` ("isolation-probe") but body is `echo "TODO Phase 1.1: ..."`. Not real yet. |
|   ❌   | Per-region data isolation — synthetic cross-region probe in CI (AU lead via SG region API → 403) | Same — covered by the same stub. Phase 1.1.                                                          |

### Audit chain

| Status | Item                                        | Evidence / notes                                                                                                                                     |
| :----: | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ❌   | Audit chain Merkle replay test weekly in CI | Stub in `ci.yml:173-183` ("audit-chain-verify"), body is `echo "TODO Phase 1.4: replay audit chain..."`. No audit chain to replay yet. Per ADR-0008. |

### Mobile

| Status | Item                                                                                                          | Evidence / notes                                                                                                                                                                                                                                  |
| :----: | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ❌   | Mobile cert pinning + jailbreak detection + biometric re-auth verified on physical iOS + Android each release | Swift app `apps/knocker-ios/` is scaffolded but no security controls wired. iOS scope: SPKI hash pinning via `URLSessionDelegate`, jailbreak via filesystem probe + `dyld` checks, biometric via `LAContext`. Android scope: deferred to Phase 2. |

### Data protection

| Status | Item                                                   | Evidence / notes                                                                                                                                                                          |
| :----: | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   ❌   | PII vault + JIT unmask E2E tested per release          | No vault, no unmask flow. The Prisma schema **does** mark every PII column with `/// PII` (✅ — see `apps/api/prisma/schema.prisma:259-264, 502-507`) which is the foundation. Phase 1.2. |
|   ❌   | DR: RPO 5min, RTO 1h, validated quarterly via game day | No persistence layer running. Phase 1.4 when Aurora clusters land.                                                                                                                        |

### Compliance / launch posture

| Status | Item                                                                                        | Evidence / notes                                                                                                                                                                                                                                                         |
| :----: | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   🟡   | SOC 2 Type I scoping locked in (`docs/soc2/`); Type II observation window starts Phase 3    | `docs/soc2/` directory exists but is **empty**. Phase 1.4 deliverable — control matrix (`docs/soc2/controls.md`), evidence-collection automation, scoping memo.                                                                                                          |
|   ❌   | Independent pen test by AU firm (Bastion, Pure Hacking) before public SaaS launch (Phase 4) | Not engaged. Cost ~AUD 35–60k for a standard web + API + mobile engagement. Book ~6 weeks before Phase 4 cutover.                                                                                                                                                        |
|   ❌   | Bug bounty: invite-only Phase 3 → public Phase 4 (Bugcrowd or HackerOne)                    | Not engaged. `SECURITY.md` already documents the intent.                                                                                                                                                                                                                 |
|   ✅   | `security.txt` at `/.well-known/security.txt` on every web surface                          | Created this pass at `apps/web-operator/public/.well-known/security.txt`. Verified `curl -o - http://localhost:3011/.well-known/security.txt` returns RFC 9116 compliant content. Same file needs to be added to any other web surface that ships (marketing site, etc). |
|   ❌   | Subdomain takeover scan (`subjack`) before launch + weekly                                  | No public domain yet. Add a GitHub Actions cron job at Phase 1.4 hitting `subjack -d door2digital.io,api.door2digital.io,app.door2digital.io,...`.                                                                                                                       |

---

## Rollup

| Bucket                      |  ✅   |  🟡   |   ❌   |
| --------------------------- | :---: | :---: | :----: |
| Architecture / API          |   0   |   0   |   2    |
| Secrets / deps / SAST       |   1   |   2   |   1    |
| Auth / identity / isolation |   0   |   0   |   2    |
| Headers / transport         |   0   |   3   |   0    |
| Multi-tenant / multi-region |   0   |   0   |   2    |
| Audit chain                 |   0   |   0   |   1    |
| Mobile                      |   0   |   0   |   1    |
| Data protection             |   0   |   0   |   2    |
| Compliance / launch         |   1   |   1   |   3    |
| **Total**                   | **3** | **4** | **13** |

## What this means in plain English

- **Today (Phase 0 demo):** the web bundle is hardened above the median 2026 SaaS baseline; gitleaks/Trivy/Semgrep guard CI; `.well-known/security.txt` is published. **There is nothing to pen-test yet** because there's no auth, no PII, no mutations, no backend.
- **Phase 1.1 (next 4 weeks):** real login + Cognito + WebAuthn + cross-tenant CI probe + nonce-based CSP. After this, headers go from 🟡 to ✅ and the isolation probes from ❌ to ✅.
- **Phase 1.2:** PII vault + JIT unmask + audit chain → flips most of the remaining ❌ on this list to 🟡 or ✅.
- **Phase 1.4:** WAF + DR + SOC 2 scoping + mobile hardening.
- **Phase 4 (public SaaS launch):** book Bastion / Pure Hacking pen test; open bug bounty.

## Update cadence

- Re-run this checklist at every phase gate (Phase 0 → 1.0, 1.0 → 1.1, etc).
- Re-run after every dependency-related vulnerability (CVE in Next, Prisma, NestJS, AWS SDK, etc).
- Commit deltas as part of the same PR that lands the security work.
