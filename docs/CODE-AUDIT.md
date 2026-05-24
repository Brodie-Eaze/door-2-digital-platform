# Code audit — Door 2 Digital OS

**Date:** 2026-05-25
**Auditor:** Agent 17 (overnight chain)
**Scope:** Full workspace at commit `8db7ffc` (HEAD on entry)
**Tests on entry:** 198/198 passing
**Tests on exit:** 198/198 passing

## Executive summary

The codebase is in unusually good shape for its size and pace of development.
Single overnight pass turned up:

- 2 typecheck failures (both rootDir misconfigurations in `tsconfig.json`)
- 8 lint failures across 4 packages (mostly unused imports + one rules-of-hooks bug)
- 0 hardcoded secrets, 0 `: any` usages, 0 `@ts-expect-error` suppressions
- 0 new dependencies tonight
- 100% domain-layout consistency (every real backend domain has the
  `routes.ts` + `service.ts` + `schemas.ts` triple)
- 5 stub apps with no `package.json` (intentional placeholders)
- 1 empty workspace package (`@d2d/api-client`)

All fix-now items applied. All 198 backend tests still pass. Web-operator
build still clean. Deferred items documented below with P0/P1/P2/P3
priority and effort estimates.

## 1. TypeScript health

### Workspace typecheck on entry

```
packages/shared-utils typecheck: Failed — 5x TS6059 rootDir errors
apps/api typecheck (implicit, hidden by rootDir):
  src/index.ts:118  TS2345 — registerHealthRoutes Fastify Logger mismatch
  src/index.ts:157  TS2345 — registerIntegrations Fastify Logger mismatch
```

### Workspace typecheck on exit

```
Scope: 8 of 9 workspace projects — all green
  packages/shared-types     ✓
  packages/shared-utils     ✓
  packages/ui-tokens        ✓
  packages/ui-web           ✓
  packages/integrations     ✓
  apps/api                  ✓
  apps/web-operator         ✓
  apps/web-org              ✓
```

The 9th project that pnpm skips is implicit — there are 8 packages with
package.json under apps+packages.

### Strictness levels per package

| Package                      | strict | noUncheckedIndexedAccess | noImplicitOverride | noFallthroughCases |
| ---------------------------- | ------ | ------------------------ | ------------------ | ------------------ |
| tsconfig.base.json           | ✓      | ✓                        | ✓                  | ✓                  |
| All 8 packages (extend base) | ✓      | ✓                        | ✓                  | ✓                  |

No drift. Every package inherits the strict base. Good.

### Type-safety stats

- `: any` usages in production code: **0**
- `as any` usages: **0**
- `@ts-expect-error` / `@ts-ignore`: **0**
- `as unknown as` casts: **12** (all `Prisma.InputJsonValue` for JSON
  columns + one error-handler `unknown[]` cast — all justified)

## 2. Lint health

### Workspace lint on entry

```
packages/ui-web         1 error  (@next/next/no-img-element rule unknown in non-Next pkg)
packages/integrations   3 errors (unused StubModeError import, ProviderConfig import, T type param)
apps/api                3 errors (unused imports/symbols)
apps/web-operator      33 errors (unused imports + react/no-unescaped-entities + 1 rules-of-hooks)
```

### Workspace lint on exit

```
packages/ui-web         ✓ clean
packages/integrations   3 errors  DEFERRED (Agent 12 territory — see §10)
apps/api                3 errors  DEFERRED (Agent 13 territory — see §10)
apps/web-operator       ✓ clean (was 33 errors)
all other packages      ✓ clean
```

The web-operator build was always clean — `next.config.mjs` has
`eslint: { ignoreDuringBuilds: true }` documented as a Phase 0 demo
concession. Fixed the lints anyway so CI can later flip strict.

### Warning categories fixed

| Category                                                  | Count | Action                                         |
| --------------------------------------------------------- | ----- | ---------------------------------------------- |
| Unused lucide-react / @d2d/ui-web imports                 | 23    | Removed                                        |
| `react/no-unescaped-entities` (quotes/apostrophes in JSX) | 9     | Replaced with `&apos;` / `&ldquo;` / `&rdquo;` |
| `react-hooks/rules-of-hooks` (conditional useEffect)      | 1     | Moved hook before early-return                 |

## 3. Test health

- **Backend API:** 198/198 passing across 15 integration test files
  (5,380 LOC of tests). Coverage across 15 real domains:
  auth, audit, content-studio, conversion, donation, knock, lead,
  marketing, notification, org, pii-vault, sale, territory, user, webhook.
- **Web-operator:** 0 tests. 80 pages, all unit-tested-by-typecheck-only.
- **Packages:** 0 vitest files in shared-types, shared-utils, ui-web,
  ui-tokens, integrations. Logic is exercised indirectly via the API tests.
- **Coverage %:** Not measured tonight (no coverage tooling installed).

## 4. Naming + structure consistency

### Backend domain layout

15 of 15 real domains follow the canonical 3-file pattern exactly:

```
apps/api/src/domains/<name>/
  routes.ts    — Fastify route registrations (thin)
  service.ts   — business logic
  schemas.ts   — Zod DTOs
```

Domains with implementations + tests:
audit, auth, content-studio, conversion, donation, knock, lead,
marketing, notification, org, pii-vault, sale, territory, user, webhook.

The `auth/` domain additionally has `password.ts` and `tokens.ts` — both
documented helpers (scrypt password hashing + hand-rolled JWT) that are
internal to the auth service. Pattern is fine: domain-internal helpers
live alongside the domain.

### Stub routes (no service.ts yet — placeholders only)

10 domains expose RFC 7807 501-stub routes with no service implementation:
billing, commission, compliance, consent, crm, do-not-call, do-not-knock,
dsar, payout, realtime. All <65 LOC, no business logic. Consistent.

### File-size outliers

| File                                                               | Lines | Note                           |
| ------------------------------------------------------------------ | ----- | ------------------------------ |
| `apps/web-operator/src/app/roster/page.tsx`                        | 1539  | Demo page; refactor candidate  |
| `apps/web-operator/src/app/onboard-account/page.tsx`               | 1195  | Demo page; refactor candidate  |
| `apps/web-operator/src/app/accounts/[slug]/roster/page.tsx`        | 1183  | Demo page; refactor candidate  |
| `apps/web-operator/src/app/marketing-studio/integrations/page.tsx` | 1057  | Demo page                      |
| `apps/web-operator/src/app/accounts/[slug]/pipeline/page.tsx`      | 1005  | Demo page                      |
| `apps/api/src/domains/marketing/service.ts`                        | 981   | Real service; deserves a split |

The 981-line `marketing/service.ts` is the only backend file that should
be split (provider-connection ops vs job ops vs webhook ingestion). All
others are demo Next.js pages.

### Re-export hygiene

`packages/shared-types/src/index.ts` — clean, 3 lines.
`packages/shared-utils/src/index.ts` — clean, 7 lines.
`packages/integrations/src/index.ts` — clean, 3 lines.

No deep imports from other packages — everyone goes through the package
root. Good.

### Empty / placeholder workspace projects

| Path                     | Status                                | Recommendation                                                 |
| ------------------------ | ------------------------------------- | -------------------------------------------------------------- |
| `apps/crm-desktop/`      | README + 3 empty src dirs             | Keep or delete (no package.json)                               |
| `apps/marketing-studio/` | README + 3 empty src dirs             | Likely redundant with web-operator's `/marketing-studio` route |
| `apps/partner-portal/`   | README + 3 empty src dirs             | Keep as placeholder                                            |
| `apps/public-site/`      | README + 2 empty src dirs             | Likely redundant — web-operator already serves `/public`       |
| `apps/knocker-ios/`      | Real Swift files (D2DKit + iOS shell) | Keep                                                           |
| `packages/api-client/`   | `src/` empty dir                      | No package.json, zero references — delete or build out         |

None of these block any build (pnpm only scans workspaces with valid
`package.json`).

## 5. Logging hygiene

### console.\* usage in production code

Only 2 intentional uses, both flagged with `// eslint-disable-next-line no-console`:

| File:Line                        | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `apps/api/src/config/env.ts:105` | Env validation failure during startup (pre-Pino) |
| `apps/api/src/index.ts:186`      | Fatal startup error catch (pre-Pino)             |

Both are bootstrap-only — they fire before the Pino logger is wired and
crash the process. The "console.error" in `apps/api/src/domains/territory/service.ts:392`
is just a comment containing the word "console". No leakage into request
handlers.

Recommendation: this discipline is correct. Don't replace these two with
Pino — Pino isn't available at the failure points.

### Pino usage

Every request handler logs via `req.log` / `app.log` (Fastify-Pino bridge).
Searched for raw `pino()` calls — only one, the singleton factory in
`apps/api/src/config/logger.ts`. Correct.

## 6. Security smells

- **Gitleaks pre-commit:** clean (per security review, Agent 11).
- **Hardcoded secrets:** none. Grep for `sk_`, `pk_`, `AKIA`, Bearer tokens,
  password literals turned up only domain strings (e.g. `pii.unmask_approved`).
- **`as any` / `: any`:** zero in production code.
- **`eval` / `new Function`:** zero.
- **`dangerouslySetInnerHTML`:** 3 uses in web-operator (compliance,
  marketing-studio, public/bug-bounty pages) — all rendering hardcoded
  copy with `<strong>` formatting, never user input. Safe for demo but
  flagged for hardening before launch (replace with React elements).

## 7. Dependency hygiene

- **New deps added tonight:** 0 (verified by checking modification times
  on the workspace + package lockfile).
- **Unused deps in any package:** none found by inspection. `@d2d/shared-utils`
  was missing `@d2d/shared-types` as an explicit dependency despite
  importing from it — **fixed** in this audit (added `"@d2d/shared-types":
"workspace:*"` to its `dependencies`).
- **Major-version drift:** all `@d2d/*` packages pinned to `workspace:*`.
  External versions match across packages (React 18.3.1, Next 14.2.13,
  Zod 3.23.8, TypeScript 5.6.2).

## 8. Documentation hygiene

- **JSDoc on exported package symbols:**
  - `packages/shared-types/src/*.ts` — good coverage (every enum & schema
    block has a leading comment block).
  - `packages/shared-utils/src/*.ts` — good coverage on functions; type
    aliases are self-describing.
  - `packages/integrations/src/types.ts` — ~50% JSDoc coverage; the
    `Input` / `Output` interfaces lack docstrings but are
    self-describing. **DEFERRED.**
- **ADRs:** 28 numbered ADRs in `docs/adr/`. **Missing:**
  - Provider-adapter plug-in architecture (introduced tonight by
    Agent 12). Should be ADR-0029.
  - Marketing-studio job model + webhook ingestion shape (introduced
    tonight). Could be combined with the adapter ADR.
- **README freshness:** main `README.md` is from Phase 0 setup;
  `HANDOFF.md` reflects current overnight progress. Five
  `apps/<stub>/README.md` files describe the intent of their respective
  apps but the dirs are otherwise empty.

## 9. What I fixed

| Fix                                                                 | File:Line                                                             | Rationale                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Add `@d2d/shared-types` to `dependencies`                           | `packages/shared-utils/package.json`                                  | shared-utils imports from it but didn't declare it                                                                  |
| Remove `"rootDir": "src"` from shared-utils tsconfig                | `packages/shared-utils/tsconfig.json`                                 | rootDir restriction broke typecheck of cross-package imports                                                        |
| Remove `"rootDir": "."` from api tsconfig                           | `apps/api/tsconfig.json`                                              | Same — was masking real Fastify Logger type errors                                                                  |
| Use `app.register(registerHealthRoutes)` instead of bare call       | `apps/api/src/index.ts:118`                                           | Fastify-Pino Logger type incompat — using the plugin signature fixes it                                             |
| Use `app.register(registerIntegrations)` instead of bare call       | `apps/api/src/index.ts:157`                                           | Same fix for integrations decorator                                                                                 |
| Drop unused `MessageCircle, StatusPill` imports                     | `apps/web-operator/src/app/accounts/[slug]/conversations/page.tsx:1`  | Dead imports                                                                                                        |
| Drop unused `Button` import                                         | `apps/web-operator/src/app/accounts/[slug]/memberships/page.tsx:18`   | Dead import                                                                                                         |
| Drop unused `MessageSquare, ChevronDown, Money, StatusPill` imports | `apps/web-operator/src/app/accounts/[slug]/smart-lists/page.tsx:4-27` | Dead imports                                                                                                        |
| Drop unused `totalConversions` variable                             | `apps/web-operator/src/app/accounts/page.tsx:11`                      | Computed but unused                                                                                                 |
| Drop unused `Button, Money` imports                                 | `apps/web-operator/src/app/command-centre/page.tsx:4`                 | Dead imports                                                                                                        |
| Drop unused `ImageIcon` import                                      | `apps/web-operator/src/app/marketing-studio/generate/page.tsx:8`      | Dead import                                                                                                         |
| Drop unused `Users` import                                          | `apps/web-operator/src/app/orgs/pilot-charlie/page.tsx:1`             | Dead import                                                                                                         |
| Drop unused `AlertCircle, AlertTriangle` imports                    | `apps/web-operator/src/app/overview/page.tsx:1`                       | Dead imports                                                                                                        |
| Drop unused `TrendingUp, ShieldCheck` imports                       | `apps/web-operator/src/app/public/customers/page.tsx:2`               | Dead imports                                                                                                        |
| Drop unused `Smartphone, MapIcon, TrendingUp, Globe2` imports       | `apps/web-operator/src/app/public/page.tsx:2-12`                      | Dead imports                                                                                                        |
| Drop unused `AlertCircle` import                                    | `apps/web-operator/src/app/public/status/page.tsx:2`                  | Dead import                                                                                                         |
| Drop unused `TrendingUp, DollarSign, Users` imports                 | `apps/web-operator/src/app/territory-intel/page.tsx:1`                | Dead imports                                                                                                        |
| Drop unused `useState` import                                       | `apps/web-operator/src/components/HQLiveMapImpl.tsx:13`               | Dead import                                                                                                         |
| Escape `"` in JSX literals                                          | `apps/web-operator/src/app/accounts/[slug]/drip/page.tsx:158`         | `react/no-unescaped-entities`                                                                                       |
| Escape `"` in JSX literals                                          | `apps/web-operator/src/app/accounts/[slug]/lead-lists/page.tsx:56`    | Same                                                                                                                |
| Escape `'` in JSX literal                                           | `apps/web-operator/src/app/accounts/[slug]/leads/page.tsx:25`         | Same                                                                                                                |
| Escape `'` in JSX literal                                           | `apps/web-operator/src/app/accounts/[slug]/roster/page.tsx:358`       | Same                                                                                                                |
| Escape `"` in JSX literal                                           | `apps/web-operator/src/app/accounts/[slug]/smart-lists/page.tsx:833`  | Same                                                                                                                |
| Escape `'` in JSX literal                                           | `apps/web-operator/src/app/accounts/page.tsx:36`                      | Same                                                                                                                |
| Escape `'` in JSX literal                                           | `apps/web-operator/src/app/compliance/page.tsx:16`                    | Same                                                                                                                |
| Move `useEffect` before conditional `return`                        | `apps/web-operator/src/app/accounts/[slug]/tasks/page.tsx:286-300`    | `react-hooks/rules-of-hooks` — real bug; would break the Esc-to-close drawer when `account` is null on first render |
| Remove obsolete `@next/next/no-img-element` disable comment         | `packages/ui-web/src/components/KnockCard.tsx:44`                     | Rule not defined in framework-agnostic package; replaced with explanatory comment                                   |

**Total fixes:** 26.

## 10. Deferred (with priority + effort estimate)

### P1 — Should be addressed before next merge window

| Finding                                                | File:Line                                                 | Owner              | Effort | Why deferred                                   |
| ------------------------------------------------------ | --------------------------------------------------------- | ------------------ | ------ | ---------------------------------------------- |
| Unused `adapterMethodForCapability` helper (dead code) | `apps/api/src/domains/marketing/service.ts:134`           | Agent 12 territory | 5min   | Brief restricts touching Marketing Studio code |
| Unused `FastifyRequest` type import                    | `apps/api/src/domains/org/routes.ts:7`                    | Agent 13 territory | 1min   | Brief restricts touching auth/org/user         |
| Unused `newId` import in auth test                     | `apps/api/tests/integration/auth.test.ts:9`               | Agent 13 territory | 1min   | Brief restricts touching auth tests            |
| Unused `StubModeError` import                          | `packages/integrations/src/adapters/higgsfield.ts:15`     | Agent 12 territory | 1min   | Brief restricts touching integrations          |
| Unused `ProviderConfig` import                         | `packages/integrations/src/adapters/meta-marketing.ts:24` | Agent 12 territory | 1min   | Same                                           |
| Unused generic param `T`                               | `packages/integrations/src/errors.ts:74`                  | Agent 12 territory | 5min   | Same                                           |

These are all 1-5 minute fixes the next agent can sweep up. They're
clustered in two agents' files and were explicitly placed off-limits
by the audit brief.

### P2 — Worth addressing this sprint

| Finding                                       | Location                                                                 | Effort         | Note                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------- |
| `marketing/service.ts` is 981 LOC             | apps/api/src/domains/marketing/service.ts                                | 1h             | Split into `provider-connections.ts`, `jobs.ts`, `webhooks.ts` — service.ts becomes a barrel. |
| Write ADR for Provider Adapter pattern        | docs/adr/0029-provider-adapter-plugin.md                                 | 30min          | Tonight's integrations architecture is undocumented in ADRs                                   |
| Replace 3 demo `dangerouslySetInnerHTML` uses | web-operator: regions/sg/compliance, marketing-studio, public/bug-bounty | 20min          | Safe today (hardcoded copy) but hardens before public launch                                  |
| Delete or build out `packages/api-client/`    | packages/api-client/                                                     | 5min if delete | Empty stub, zero imports, no package.json                                                     |
| Two TODOs in territory/lead services          | territory/service.ts:390, lead/service.ts:15                             | (real work)    | Tracked in Phase 1.2 / Agent 15 backlog                                                       |
| One TODO in `config/db.ts`                    | apps/api/src/config/db.ts:33                                             | (real work)    | Prisma `$extends` for orgId scoping — Phase 1.1                                               |

### P3 — Nice-to-have

| Finding                                                                                      | Location                              | Effort            |
| -------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------- |
| JSDoc the remaining ~10 integration `Input` / `Output` interfaces                            | packages/integrations/src/types.ts    | 15min             |
| Delete or repurpose 4 stub apps (crm-desktop, marketing-studio, partner-portal, public-site) | apps/                                 | Discussion + 5min |
| Test coverage for `packages/shared-utils` (currently only indirect via API tests)            | packages/shared-utils/src/            | 1-2h              |
| Test coverage for `packages/integrations` adapters                                           | packages/integrations/src/adapters/   | 2-4h              |
| Coverage % measurement (vitest --coverage)                                                   | repo root                             | 15min setup       |
| Refactor 1000-LOC+ web-operator demo pages into sub-components                               | apps/web-operator/src/app/\*/page.tsx | 2-4h each         |

### P0 — None

No security holes, data-loss bugs, or build-blockers remain.

## 11. Verdict

**Overall code health: A-**

Justification: zero `any`, zero `@ts-ignore`, 100% strict mode adherence,
100% domain-layout consistency, 198/198 backend tests green, zero new
deps overnight, zero hardcoded secrets, only 2 intentional and
documented `console.*` calls. The codebase has the discipline of a much
older project. Knock from A+ to A- for: (1) one real rules-of-hooks bug
that the audit caught; (2) two `tsconfig.json` rootDir misconfigurations
that hid Fastify Logger type errors for an unknown number of commits;
(3) the 981-line marketing/service.ts that wants splitting; (4) zero
test coverage on the web-operator (acknowledged Phase 1.4 work).

**Recommended next-session priorities:**

1. Sweep the 6 P1 deferred lint errors (10 minutes total, but cross 2
   agents' protected zones — needs coordination)
2. Split `marketing/service.ts` (1h, Agent 12 or successor)
3. Write ADR-0029 for the Provider Adapter pattern (30min)
4. Spin up Playwright + a smoke suite for web-operator (Phase 1.4)
5. Decide fate of the 4 empty stub apps and `@d2d/api-client`
