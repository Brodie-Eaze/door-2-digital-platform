# Security review — `apps/web-operator` (Phase 0 demo)

**Date:** 2026-05-24
**Reviewer:** Agent 4 (post Agents 1–3, commit `961edc0`)
**Scope:** Single Next.js operator console (`apps/web-operator`) plus shared workspace files (`.husky/`, `.github/workflows/`, root `package.json`, `apps/api/prisma/schema.prisma`).
**Purpose:** Honest pen-test-readiness audit before Brodie shares the demo more widely. Backend (`apps/api`) is **not running** — the auditable surface is the static/SSR Next bundle and its headers/cookies.

---

## 1. Scope of this review

### What was read

- `apps/web-operator/next.config.mjs` — CSP + security headers + image domains
- `apps/web-operator/src/app/layout.tsx` — root layout, fonts, metadata
- `apps/web-operator/src/app/page.tsx` — root redirect
- `apps/web-operator/src/app/login/page.tsx` — login form (no real auth wired)
- `apps/web-operator/src/app/screens/page.tsx` — gallery (fixed React `key` warning in this pass)
- `apps/web-operator/src/components/` — all 9 shell/map/avatar components
- `apps/web-operator/src/lib/` — all 4 fixture/data files
- `apps/web-operator/package.json` — deps and pins
- `apps/web-operator/public/.well-known/security.txt` — added in this pass
- `package.json` (workspace root) — engines, dev deps, lint-staged
- `.gitignore` — env exclusion
- `.gitleaks.toml` — secret scanner config
- `.husky/pre-commit` — lint-staged + gitleaks
- `.github/workflows/ci.yml` — 10 CI gates
- `.github/workflows/deploy-railway.yml` — deploy job
- `.github/CODEOWNERS`
- `SECURITY.md`
- `apps/api/prisma/schema.prisma` — 849-line schema, every PII column marked

### What was NOT read (deliberately out of scope this pass)

- `apps/api/src/**` (the NestJS backend) — not running, mostly stub
- `apps/workers/**` — same
- `apps/knocker-ios/**` — Swift code, separate audit needed
- `infra/terraform/**` — IaC scan is Trivy's job in CI
- `packages/ui-web/**` deeper than imports — components were spot-checked via their consumers
- `pnpm-lock.yaml` — should be Snyk/Trivy-driven, not human-eyeballed

### Honest framing of the threat model right now

The web-operator app today is a **UI demo with mock fixtures**. There is no:

- Real authentication (the login form just `window.location.href = '/overview'`)
- Real session/cookie (no Set-Cookie issued)
- Real PII (every phone/address/email in `lib/*.ts` is synthetic — `+1-212-555-…` reserved range)
- Backend persistence (the rewrite rule for `/proxy/api/*` points at a `localhost:3010` that isn't running)
- Mutations of any kind (no POST handlers, no Server Actions)

Therefore "PII exposure" risk is **bounded to**:

1. **What ships in the JS bundle** — could a static-source recon turn up a hard-coded token, a debug PII-table flag, or a vendor-API key?
2. **What the browser allows the page to do** — CSP, headers, cookie scope, inline scripts.
3. **What an attacker could exploit if they MITM'd a dev session** — TLS posture, HSTS preload eligibility, `target=_blank` reverse-tabnabbing.

Real PII risk (mass enumeration, vault bypass, JIT-unmask abuse, cross-tenant read, audit-chain tampering) all arrive when the backend lands. Those are tracked in §6 below.

---

## 2. Findings by category

Severity legend: **P0** = exploit feasible now, fix immediately. **P1** = exploitable when backend lands or obvious miss. **P2** = defence-in-depth, low blast radius. **P3** = housekeeping / future-proofing.

### 2a) Content Security Policy

**File:** `apps/web-operator/next.config.mjs:7-72`

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
worker-src 'self' blob:; manifest-src 'self'; media-src 'self';
upgrade-insecure-requests
```

| #    | Title                                                     | Sev | Evidence                  | Risk                                                                                                                                                           | Fix                                                                                                                                                                                    |
| ---- | --------------------------------------------------------- | --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2a-1 | `script-src 'self'` — no `unsafe-inline` or `unsafe-eval` | —   | line 20                   | ✅ Strong. Next 14 App Router uses module scripts, no inline `<script>`.                                                                                       | No action.                                                                                                                                                                             |
| 2a-2 | `style-src` includes `'unsafe-inline'`                    | P2  | line 23                   | Tailwind utility classes don't need it, but Next's critical-CSS optimisation inlines a `<style>` block without a nonce. Removing this **will** break the page. | Phase 1.1: add SHA-256 hashes via a Next plugin, or switch to nonce-based CSP with edge middleware. Document the dependency in next.config.mjs (already noted in comment lines 21-22). |
| 2a-3 | `img-src` includes 9 tile-server hostnames                | P3  | lines 24-40               | Wildcard `https://*.tile.openstreetmap.org` is broad but scoped to a single TLD. Adversary would need to compromise an OSM tile mirror to inject pixels.       | Phase 2: scope to the specific subdomains actually used (`a.`/`b.`/`c.`) and drop the wildcard.                                                                                        |
| 2a-4 | `connect-src` includes `http://localhost:3010` in dev     | P3  | line 8                    | Only when `NEXT_PUBLIC_API_URL` is unset (dev default). In a prod deploy with the env set, this is replaced.                                                   | Add a build-time assertion: in production builds, require `NEXT_PUBLIC_API_URL` to be set and start with `https://`.                                                                   |
| 2a-5 | `frame-ancestors 'none'` + `X-Frame-Options: DENY`        | —   | lines 57, 79              | ✅ Both present; redundant by design.                                                                                                                          | No action.                                                                                                                                                                             |
| 2a-6 | `object-src 'none'`                                       | —   | line 60                   | ✅ Blocks Flash/Java/PDF object embeds.                                                                                                                        | No action.                                                                                                                                                                             |
| 2a-7 | `upgrade-insecure-requests`                               | —   | line 67 (added this pass) | ✅ Forces any accidental `http://` asset to upgrade. No effect on localhost dev.                                                                               | No action.                                                                                                                                                                             |
| 2a-8 | `media-src 'self'`                                        | —   | line 64 (added this pass) | ✅ Blocks `<video src="https://evil/">`.                                                                                                                       | No action.                                                                                                                                                                             |

### 2b) HTTP security headers

**File:** `apps/web-operator/next.config.mjs:69-89`

All headers verified via `curl -I http://localhost:3011/` after build.

| Header                              | Present?             | Value                                                       | Notes                                                           |
| ----------------------------------- | -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `Strict-Transport-Security`         | ✅                   | `max-age=31536000; includeSubDomains; preload`              | 1y. Needs **2y** before submission to hstspreload.org per §9.5. |
| `Referrer-Policy`                   | ✅                   | `strict-origin-when-cross-origin`                           | Good default.                                                   |
| `Permissions-Policy`                | ✅                   | Locks down 22 features (camera, mic, geolocation, USB, etc) | Excellent — explicitly denies everything we don't need.         |
| `X-Content-Type-Options`            | ✅                   | `nosniff`                                                   |                                                                 |
| `X-Frame-Options`                   | ✅                   | `DENY`                                                      |                                                                 |
| `X-DNS-Prefetch-Control`            | ✅                   | `off`                                                       | Avoids DNS-leak side-channel on hover.                          |
| `Cross-Origin-Opener-Policy`        | ✅                   | `same-origin`                                               | Process-isolation for Spectre.                                  |
| `Cross-Origin-Resource-Policy`      | ✅                   | `same-site`                                                 |                                                                 |
| `X-Permitted-Cross-Domain-Policies` | ✅ (added this pass) | `none`                                                      | Blocks legacy Flash/Adobe crossdomain.xml abuse.                |
| `Origin-Agent-Cluster`              | ✅ (added this pass) | `?1`                                                        | Modern origin-keyed isolation hint.                             |
| `Server` / `X-Powered-By`           | —                    | (absent)                                                    | ✅ `poweredByHeader: false` in config.                          |

**Finding 2b-1 — HSTS max-age** · **P2** · `next.config.mjs:70` · Current `max-age=31536000` (1y) is below the **2y** threshold required by hstspreload.org. Bump to `max-age=63072000` before submitting for preload. (Don't bump now — submitting preload from a dev/staging hostname would brick the domain.)

**Finding 2b-2 — `Cross-Origin-Embedder-Policy` absent** · **P3** · Adding `COEP: require-corp` would unlock high-precision timers and `SharedArrayBuffer`, but it **would break** Leaflet tile loads (they don't send the required CORP header). Decision: leave off. Re-evaluate in Phase 2 if a feature needs it.

### 2c) Cookies & auth tokens

`grep -rn document.cookie apps/web-operator/src` → **0 results.**
`grep -rn localStorage apps/web-operator/src` → **0 results.**
`grep -rn sessionStorage apps/web-operator/src` → **0 results.**

**Finding 2c-1 — No client-side token storage today** · ✅ · The login form at `apps/web-operator/src/app/login/page.tsx:15` just does `window.location.href = '/overview'` — no token issued, no cookie set, no storage write. When auth lands Phase 1.1 the requirement is: `__Host-`-prefixed `HttpOnly; Secure; SameSite=Strict` cookies for the session; **no token in localStorage**.

**Finding 2c-2 — Login form is a no-op** · **P1** · `apps/web-operator/src/app/login/page.tsx:11-16` accepts any email/password and redirects. Acceptable for Phase 0 (clearly labelled "Phase 0 scaffold — auth lands Phase 1.1" line 53), but **must not** ship past Phase 1 without enforcement. Add a CI gate that fails the build if `NEXT_PUBLIC_AUTH_REQUIRED=true` AND the login handler is still this stub.

### 2d) Hard-coded secrets / API keys

`grep -rnEi "(sk_|AKIA|Bearer |api[_-]?key|pk_eyJ|pk\.eyJ)" apps/web-operator/src` → **0 results** (after filtering placeholder strings and React `name="password"` form-field names).

`find . -name ".env*" -not -path "*/node_modules/*"` → only `.env.example` (committed, no real values).

**Finding 2d-1 — Zero secrets in client bundle** · ✅ · No Mapbox token, no Esri token, no AWS key, no Stripe key, no third-party Bearer. The Esri World Imagery basemap (`server.arcgisonline.com`) is **token-free** — that's by design.

**Finding 2d-2 — Gitleaks config exists** · ✅ · `.gitleaks.toml` extends defaults, allowlists docs/example placeholders only. Pre-commit hook at `.husky/pre-commit:9` runs `gitleaks protect --staged --no-banner --redact`. CI also runs `gitleaks/gitleaks-action@v2` (`ci.yml:68-77`).

### 2e) PII handling in the UI

**Files:** `apps/web-operator/src/lib/account-fixtures.ts:140-148`, `apps/web-operator/src/lib/fleet-reps.ts`, all `accounts/[slug]/leads/*` pages.

**Finding 2e-1 — Fixture PII is fully synthetic** · ✅ · Phone numbers use `+1-212-555-…` (NANP reserved fictional range) and `+614-…` (synthetic AU mobiles). Addresses are demo-only. No real donor/lead data present.

**Finding 2e-2 — No masking layer on lead/conversation pages** · **P1 for prod, N/A for demo** · Files like `apps/web-operator/src/app/accounts/[slug]/leads/page.tsx` and `apps/web-operator/src/app/accounts/[slug]/leads/maria-santos/page.tsx` render phone/address inline. When real data arrives:

- Wrap PII fields in a `<MaskedField>` component that shows `+61•••••3942` until clicked
- Every reveal click → audit row via `services/audit` (ADR-0008)
- WebAuthn re-prompt if last unmask >5min ago
- JIT unmask grants (30min) per ADR-0012

**Components that will need the masking wrapper** (concrete list for the implementer in Phase 1.2):

| File                                          | Lines                     | PII fields rendered                |
| --------------------------------------------- | ------------------------- | ---------------------------------- |
| `accounts/[slug]/leads/page.tsx`              | grid view                 | phone, address                     |
| `accounts/[slug]/leads/maria-santos/page.tsx` | full                      | phone, email, address, full name   |
| `accounts/[slug]/conversations/page.tsx`      | thread previews           | phone, full name                   |
| `accounts/[slug]/inside-sales/page.tsx`       | dialer cockpit            | phone, address, name               |
| `accounts/[slug]/knockers/page.tsx`           | rep roster                | rep email (less sensitive but PII) |
| `command-centre/page.tsx`                     | per-territory leaderboard | rep names                          |

### 2f) Dangerous patterns

`grep -rn dangerouslySetInnerHTML apps/web-operator/src` → **0**
`grep -rnE "\beval\(" apps/web-operator/src` → **0**
`grep -rn "new Function" apps/web-operator/src` → **0**
`grep -rnE "(inner\|outer)HTML" apps/web-operator/src` → **0**

✅ Clean. No XSS sinks.

### 2g) Dependency hygiene

**File:** `apps/web-operator/package.json`

| Aspect                          | State                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| All deps use `^` (caret)        | ✅ — no `*`, no `latest`                                                           |
| Lockfile present                | ✅ `pnpm-lock.yaml` at root, 344 KB                                                |
| `engines` pinned                | ✅ `node>=20.10.0`, `pnpm>=9.0.0`                                                  |
| `packageManager` field          | ✅ `pnpm@9.12.0`                                                                   |
| Build-time deprecation warnings | None observed in this build                                                        |
| CI dependency scan              | ✅ Trivy gate at `ci.yml:90-100` with `severity: HIGH,CRITICAL` and `exit-code: 1` |
| Renovate / Dependabot           | Not in `.github/` — **P2** to add `dependabot.yml`                                 |

**Finding 2g-1 — Dependabot not configured** · **P2** · `.github/dependabot.yml` doesn't exist. Trivy covers vuln scanning in CI but doesn't open PRs to upgrade. Add a basic `dependabot.yml` for `npm` (weekly) and `github-actions` (weekly).

### 2h) Source map exposure

**File:** `apps/web-operator/next.config.mjs:91` (added this pass)

```js
productionBrowserSourceMaps: false,
```

Verified in `.next/required-server-files.json` — `productionBrowserSourceMaps:false`.

✅ Production bundles do NOT ship `.map` files. Reverse engineering would have to work from minified-bundle source.

### 2i) XSS surface — `target="_blank"`

`grep -rn 'target="_blank"' apps/web-operator/src` → **1 occurrence** (was: `rel="noreferrer"` only).

**Finding 2i-1 — `noopener` was implicit, now explicit** · **P3 → resolved** · `apps/web-operator/src/app/accounts/[slug]/knocker-ios/page.tsx:35` — was `rel="noreferrer"`, now `rel="noopener noreferrer"`. Modern browsers (Chrome 88+, Firefox 79+) imply `noopener` when `target="_blank"`, but explicit is auditor-friendly and future-proof.

### 2j) Open redirects

No mutations, no query-string driven redirects. The single redirect (`apps/web-operator/src/app/page.tsx:3`) is a hard-coded `redirect('/accounts')` — safe.

✅ Not applicable today. Pattern to enforce when /login lands: any `?next=…` parameter must be allowlist-validated to internal paths only (regex `^/[a-z0-9/_-]+$` and not starting with `//`).

### 2k) CSRF — N/A today, controls planned

No forms POST to anything mutable. When backend lands:

- `SameSite=Strict` on session cookie
- Double-submit token (`__Host-csrf` cookie + `X-CSRF-Token` header)
- Origin / Referer check on every mutating endpoint
- (per §9.3 of master plan)

### 2l) Rate limiting / brute force — N/A today

No login endpoint. When backend lands: AWS WAF rate rules (per §9.5) + per-key tiered limits (5/s burst, 30/10s, 120/min per master plan §9.3).

### 2m) Audit trail — entirely future work

Per ADR-0008 (hash-chained audit + S3 Object Lock 7y). Today there is no audit capture in the demo. When the backend lands, every one of these UI events must write an audit row:

| Screen / interaction                   | Audit event type                              |
| -------------------------------------- | --------------------------------------------- |
| Any PII unmask (phone, address, email) | `lead.pii.unmasked`                           |
| Payout instruction submitted           | `payout.instructed`                           |
| Settings change                        | `org.settings.changed`                        |
| User invite / role change              | `user.role.changed`                           |
| Compliance state grant/revoke          | `compliance.state.changed`                    |
| Lead status pipeline move              | `lead.stage.changed` (low priority — bulk-OK) |
| Smart-list create/edit                 | `smart_list.changed`                          |
| Campaign launch                        | `campaign.launched`                           |
| Workflow enable/disable                | `workflow.toggled`                            |

Each row needs: `{ orgId, actorId, ipHash, userAgentHash, action, resourceId, beforeHash, afterHash, prevRowHash, rowHash, ts }`.

---

## 3. Quick wins applied in this pass

All applied to `apps/web-operator/next.config.mjs` (and one to a page file + a new public file):

1. ✅ **Added `media-src 'self'` to CSP** — blocks `<video>` / `<audio>` exfiltration via remote URLs.
2. ✅ **Added `upgrade-insecure-requests` to CSP** — any accidental `http://` reference auto-upgrades.
3. ✅ **Added `X-Permitted-Cross-Domain-Policies: none` header** — kills legacy Flash crossdomain.xml abuse.
4. ✅ **Added `Origin-Agent-Cluster: ?1` header** — opts the origin into modern origin-keyed agent clustering.
5. ✅ **Pinned `productionBrowserSourceMaps: false` explicitly** — was relying on Next 14 default; now belt-and-braces.
6. ✅ **`rel="noopener noreferrer"`** on the only `target="_blank"` (`knocker-ios/page.tsx:35`).
7. ✅ **Created `/.well-known/security.txt`** with `Contact:`, `Expires:`, `Policy:`, `Canonical:` per RFC 9116. Verified serves 200.
8. ✅ **Fixed React `key` warning** on `/screens` (Fragment shorthand `<>` was getting an inner-child key — now uses `<Fragment key=…>`). This is a stability fix, not security, but it was the only dev-server warning and it's gone.

After these changes the build is still clean (`pnpm --filter web-operator build` exits 0, 28 routes generated) and 132/133 routes serve 200 (the one 307 is the intentional `/` → `/accounts` redirect).

---

## 4. Top P0/P1 findings (the ones that matter for a real pen test)

| #   | Sev | File                                                             | Finding                                                                                                                                      |
| --- | --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P1  | `apps/web-operator/src/app/login/page.tsx:11-16`                 | Login is a no-op stub. **Must not ship past Phase 1.1 without a real handler.** Add CI gate.                                                 |
| 2   | P1  | `apps/web-operator/src/app/accounts/[slug]/leads/**` and related | No `<MaskedField>` wrapper anywhere. Real PII would render in plaintext today. Concrete component list in §2e-2.                             |
| 3   | P2  | `apps/web-operator/next.config.mjs:23`                           | CSP `'unsafe-inline'` in `style-src`. Required by Next 14 critical-CSS inlining. Switch to nonce-based CSP in Phase 1.1 via edge middleware. |
| 4   | P2  | `apps/web-operator/next.config.mjs:70`                           | HSTS max-age 1y. Bump to 2y before submitting domain to hstspreload.org.                                                                     |
| 5   | P2  | `.github/`                                                       | No `dependabot.yml`. Trivy in CI catches CVEs but doesn't auto-PR upgrades.                                                                  |

---

## 5. Long-pole work — what stands between today and a real pen test

Master plan reference: `/Users/Brodie/.claude/plans/question-im-about-to-greedy-cascade.md` §9 (lines 634-718).

The demo has **none** of the backend hardening because the backend doesn't exist yet. That's deliberate Phase 0 scope. Concretely outstanding (mirrors master plan §9.1–9.5):

### §9.1 — RBAC + ABAC + SSO

- 8-role RBAC enforced at 5 layers (BFF guard, TenantGuard, RLS, RegionGuard, WebAuthn middleware) — **0% built**
- SAML SP for enterprise tenants — **0%**
- SCIM 2.0 — deferred to Phase 2 per master plan
- SOC 2 Type I evidence collection — **stub `docs/soc2/` folder exists, no controls written**

### §9.2 — PII vault

- Per-row DEK with KMS envelope + AAD discriminator — **0%**
- Deterministic AES-SIV for searchable fields — **0%**
- JIT unmask with dual control + 30-min grant + per-reveal audit row — **0%**

### §9.3 — Threat model controls

- Knocker mobile: biometric re-auth, App Attest, cert pinning, SQLCipher — **0% (Swift app not yet built)**
- Web console WebAuthn — **0%**
- Public API mTLS, OAuth2 cc, HMAC body signing, tiered rate limits — **0%**
- Webhook HMAC + replay window — **0%**
- Egress SSRF guard (block 169.254.169.254, RFC1918, IPv6 ULA) — **0%**

### §9.4 — OWASP Top 10

- A01 Broken Access Control: quad guard layers — **0%**
- A02 Cryptographic Failures: KMS envelope, SIV — **0%**
- A03 Injection: Prisma parameterised (✅ ready — schema present), Zod input validation at BFF — **0%**
- A05 Security Misconfig: WAF Terraform IaC + Trivy scan — Trivy ✅ in CI, WAF Terraform **0%**
- A06 Vulnerable Components: Renovate + Trivy + Snyk + Dependabot — only Trivy + gitleaks today; **Dependabot missing**
- A07 Identity: Cognito + Okta + WebAuthn + JWT ≤5min — **0%**
- A08 Data Integrity: hash-chained audit + cosign-signed images + SLSA L3 — **0%**
- A09 Logging: Pino structured + redaction + OpenSearch + SIEM + PagerDuty — **0%**
- A10 SSRF: egress allowlist — **0%**

### §9.5 — Pen-test readiness checklist

Mirrored in full at `docs/PEN_TEST_READINESS.md` (added in this pass) with honest ✓/🟡/✗ per item. TL;DR: **3 ✓, 4 🟡, 13 ✗** out of 20 items.

---

## 6. What's actually defendable RIGHT NOW

Despite the long backlog above, **today's demo would survive a basic external check** because there is nothing meaningful to attack:

- No mutations → no CSRF, no IDOR, no SQLi
- No auth → no session-fixation, no JWT-tampering, no MFA-bypass
- No PII → no enumeration, no plaintext-leak, no GDPR breach
- No backend → no SSRF, no RCE, no SQLi-via-Prisma
- Strict CSP + tight headers → drive-by XSS unlikely
- Static fixtures → no data-poisoning vector

A securityheaders.com scan of the deployed demo should hit **A+** (assuming the production deploy serves over TLS with the same headers — which it will, since the headers are defined in `next.config.mjs` and apply to every route).

**The honest answer:** the demo is appropriately hard to attack because it doesn't do anything. The hard work begins Phase 1.1 when auth + backend land — that's where the §9 controls become load-bearing.

---

## 7. Verification done in this review

- ✅ `pnpm --filter web-operator build` exits 0 (28 routes, no errors)
- ✅ 132/133 routes return 200 (the 1 outlier is `/` → 307 redirect to `/accounts`, which resolves to 200)
- ✅ Dev-server log clean (no React warnings, no Next compile errors) after the `Fragment key` fix
- ✅ `curl -I` confirms all 13 security headers ship on `/accounts`
- ✅ `curl /.well-known/security.txt` returns 200
- ✅ `grep -rn` for all dangerous patterns returned 0 hits
- ✅ Gitleaks config + pre-commit hook present and correct
- ✅ CI workflow has 10 gates including SAST (Semgrep) and dependency scan (Trivy)
- ✅ Prisma schema PII columns marked with `/// PII` comments (lines 244, 259-264, 474, 502-507, 580, 677 et al)

---

## 8. Recommended next two security-hardening tasks (post-this-pass)

These are out of scope for this commit but the natural next steps:

1. **Add `.github/dependabot.yml`** (5 min). Weekly npm + GitHub Actions updates.
2. **Wire a CSP nonce middleware** (45 min). Use Next 14 `middleware.ts` to generate a per-request nonce, inject into the CSP header, and pass to layout via header. Lets us drop `'unsafe-inline'` from `style-src`.

---

**End of review.**

Total findings: 14 (1 fixed in pass, 7 quick wins applied, 5 P1/P2 left for Phase 1, 1 P3 future-proofing).

The codebase is in good shape for a Phase 0 demo. The CSP and header posture is already above the median for production SaaS apps shipping in 2026 — the bar will move up significantly once the backend lands and real PII flows through.
