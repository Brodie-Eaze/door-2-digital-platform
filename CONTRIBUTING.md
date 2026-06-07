# Contributing to Door 2 Digital

Welcome. This monorepo serves the Pilot-Charlie enterprise launch + every D2D tenant after. Quality bar matches EazePay App: pen-test-ready, audit-grade, mission-control polish.

## Branches & commits

- Trunk: `main`. Always green.
- Feature branches: `feat/<scope>-<short-slug>` (e.g. `feat/knock-batch-sync`).
- Bug fix: `fix/<scope>-<slug>`.
- Hotfix: `hotfix/<slug>` — opens directly off latest prod tag.
- **Squash-merge only.** Conventional Commits enforced by commitlint (Phase 1 follow-up).
- Commit subject ≤72 chars, imperative ("Add knocker idempotency batch endpoint", not "Added").

## Pull requests

Every PR must satisfy the 10 CI gates (see `.github/workflows/ci.yml`):

1. **Format check** (`pnpm format:check`)
2. **Lint** (`pnpm lint`)
3. **Typecheck** (`pnpm typecheck`)
4. **Gitleaks** secrets scan
5. **Semgrep** SAST (owasp-top-ten + typescript + react)
6. **Trivy** deps + IaC vulnerability scan
7. **Unit tests** (`pnpm test`)
8. **Integration tests** (Testcontainers PG + Redis)
9. **Cross-tenant + cross-region isolation probe** (Phase 1.1+)
10. **Audit chain Merkle replay** (weekly cron)

PR checklist (auto-populated via `.github/PULL_REQUEST_TEMPLATE.md`):

- [ ] Money values use BigInt cents (ADR-0007)
- [ ] Regulated mutations write audit row in same TX (ADR-0008)
- [ ] Errors use `ProblemError(Problems.x())` → RFC 7807 (ADR-0009)
- [ ] POST routes call `requireIdempotencyKey(req)` (ADR-0010)
- [ ] PII columns marked `/// PII` + routed through `pii-vault` (ADR-0011)
- [ ] Soft-delete (`status='archived'`) — no DELETE (ADR-0013)
- [ ] Region-pinned writes call `assertRegionMatches(org, req)` (ADR-0016)
- [ ] Architectural changes accompanied by an ADR in `docs/adr/`

## Code review etiquette

- CODEOWNERS auto-assigns. Don't merge without owner approval.
- Security-sensitive paths (auth, PII vault, audit, payment, compliance) require security-engineer approval in Phase 1.4+.
- Compliance-sensitive paths (consent, DNC, cooling-off, charity receipts, paid-solicitor) require compliance review (Brodie + counsel).
- Architectural reshape requires an ADR — reviewer can block on missing ADR.
- Aim to review within 4 business hours during Pilot-Charlie launch window (Weeks 14–16).

## Adding a new domain

```
apps/api/src/domains/<name>/
├── routes.ts         Fastify route definitions
├── service.ts        Business logic (orgId-scoped queries)
├── repository.ts     Prisma access layer
└── __tests__/        Unit tests
```

Then:

- Add Zod schema(s) to `packages/shared-types/src/schemas.ts`
- Add migration: `pnpm --filter api db:migrate:dev --name <name>`
- Register routes in `apps/api/src/index.ts`
- Add integration test in `apps/api/tests/integration/<name>.spec.ts`
- Update CODEOWNERS

## Adding a new ADR

```
cp docs/adr/template.md docs/adr/NNNN-short-title.md
```

Fill Context / Decision / Consequences / Alternatives. Link from `docs/adr/README.md`. PR requires Brodie + senior engineer approval.

## Running locally

See `README.md` Quick start. Common pnpm scripts:

```bash
pnpm dev                          # everything via turbo
pnpm --filter api dev             # API only
pnpm --filter web-operator dev    # operator console only
pnpm typecheck
pnpm lint
pnpm test
pnpm format
pnpm db:migrate:dev               # in apps/api
pnpm db:studio                    # Prisma Studio
```

## Style

- 2-space indent (4 for Swift)
- Single quotes, semicolons, trailing commas (per `.prettierrc`)
- TypeScript strict mode + `noUncheckedIndexedAccess`
- No `any` without a comment explaining why
- No `console.log` in committed code; use `logger()`
- Tabular numbers everywhere a number is rendered (`<Money />` or `.numeric` class)

## Reporting bugs internally

- Security vulnerability: see `SECURITY.md` — DO NOT open a public GitHub issue.
- Functional bug: GitHub issue with reproduction steps + expected vs actual.
- Production incident: PagerDuty SEV1/2/3 + Slack #d2d-incidents.

## Asking for help

- Architecture questions → check `docs/adr/` first, then ask Brodie.
- Domain-specific (compliance, payment) → check `docs/compliance/` then counsel.
- Stuck on local setup → check `README.md` Quick start; bootstrap script in `scripts/bootstrap.sh` (Phase 0 follow-up).
