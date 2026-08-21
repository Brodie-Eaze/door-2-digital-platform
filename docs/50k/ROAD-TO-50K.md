# Road to 50k — Execution Backlog

> Living document. Dependency-ordered. Each milestone tagged by who can do it.
> Status: `TODO` · `WIP` · `DONE` · `BLOCKED` · `QUEUED` (awaiting Brodie's one-click).
> Owner: `auto` (I do it autonomously) · `gated` (I build, Brodie approves the irreversible step) · `human` (only Brodie).

Baseline: `docs/AUDIT-2026-06-04.md` — ~20% end-to-end. Target: 50,000 concurrent, live prod, Stripe/Plaid bar.

---

## Phase F — Foundation (pure code / IaC; zero infra spend) — autonomous

| ID  | Milestone                                                                                                                                                                                                                      | Owner                          | Status | Acceptance                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| M1  | **Security floor consolidation** — integrate the unmerged SOC2 P0 branches (RLS belt, token-revocation epoch, tenant isolation) into one clean, conflict-free floor                                                            | auto                           | TODO   | All P0 SEC branches reconciled on one branch; `tsc` + isolation probe pass; no `main` merge yet (QUEUED)    |
| M2  | **Production IaC apply-ready** — Aurora (+read replica), RDS Proxy (pooling), ElastiCache Redis, ECS Fargate (api/workers/webhooks), ALB, CloudFront+WAF, Secrets Manager, autoscaling; `terraform plan` clean; deploy runbook | auto (write) / human (apply)   | TODO   | `terraform validate` + `plan` clean against a dry profile; runbook names the ~6 clicks only Brodie can do   |
| M3  | **Scale-by-design** — global + per-tenant rate limiting, Prisma/RDS-Proxy pooling config, response caching, idempotency coverage on every POST, pagination caps, slow-path offload to BullMQ                                   | auto                           | TODO   | Hot paths reviewed; rate-limit 429 backpressure in code; no unbounded queries; idempotency on all mutations |
| M4  | **Real auth replacing demo session** — harden JWT/session, wire token-revocation epoch, admin MFA, strip demo login from prod build                                                                                            | auto (write) / staging (prove) | TODO   | Demo path gated behind non-prod flag; revocation works; admin requires MFA                                  |

## Phase W — Wiring (code now; prove against a DB once infra exists)

| ID  | Milestone                                                                                                                                                  | Owner                           | Status  | Acceptance                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------- | ----------------------------------------------------------------------------- |
| M5  | **Wire the 32 mock screens → real api** (BFF → services → Prisma); kill inline-data                                                                        | auto (write) / staging (prove)  | TODO    | Each screen reads from `/api/*`; inline-data files removed                    |
| M6  | **api deployable** — healthcheck, migrations runnable, env contract, Dockerfile verified                                                                   | auto (write) / gated (deploy)   | TODO    | `api` boots against a Postgres URL; `/v1/healthz` 200; migrations apply clean |
| M7  | **Money path + MiCamp adapter** (#97) — ledger correctness (BigInt cents), idempotent finalisation, ISO residual calc; adapter skeleton now, wire on creds | auto (skeleton) / human (creds) | BLOCKED | Needs MiCamp sandbox creds. Ledger + double-entry tests pass on stub          |

## Phase P — Proof (needs infra to exist)

| ID  | Milestone                                                                         | Owner                                 | Status | Acceptance                                                                                    |
| --- | --------------------------------------------------------------------------------- | ------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| M8  | **Load test at 50k concurrent** with ≥3× headroom; fix what breaks                | gated (needs infra)                   | TODO   | p99 within SLO at 50k; graceful degradation + 429 under overload; connection-count math holds |
| M9  | **soc2-swarm + harden + external pen test**                                       | auto (code) / human (pen test, audit) | TODO   | Code-fixable gaps closed on branches; human punch-list issued                                 |
| M10 | **Day-2 ops** — DR drill (RPO 5m/RTO 1h), runbooks, observability + alerting live | auto (code) / infra (drill)           | TODO   | Golden-signal dashboards alerting; runbooks for top failures; DR validated                    |

## Human-only critical path (parallel — only Brodie)

- [ ] AWS account/Org + spend approval (~$300–800/mo) → unblocks M2 apply, M8, M10 drill
- [ ] MiCamp sandbox creds → unblocks M7
- [ ] Real domain + TLS → unblocks public prod
- [ ] External pen-test firm → unblocks M9 sign-off
- [ ] SOC 2 auditor (CPA) → unblocks certification
- [ ] Lawyer (paid-solicitor regs, TOS) → unblocks live solicitation

---

## Wave log

- 2026-06-05 · Kickoff. Operating agreement set. Menu fix committed (`1f0a6f0`). First wave: M2 (IaC) ∥ M3 (scale-by-design).
