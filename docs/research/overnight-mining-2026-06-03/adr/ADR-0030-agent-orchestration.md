# ADR-0030: Agent orchestration for the D2D intelligence layer

**Status:** Proposed
**Date:** 2026-06-03
**Deciders:** Brodie (founder)
**Supersedes:** —
**Related:** ADR-0008 (transactional outbox + Merkle spine), ADR-0016 (region-pinning + PII residency), ADR-0019 (instruct-only payout), ADR-0020 (tenant-scoped RLS), architecture.md §10.1–§10.4, §11

---

## Context and Problem Statement

Door 2 Digital operates a closed-loop field sales platform: territory geo-ads warm a zone (Marketing Studio), a field team knocks, a call centre closes over seven days, retargeting fires on non-converts, and every conversion — donation or commercial sale — feeds attribution data back to calibrate the next territory selection. Each leg of that loop produces structured signals (open rates, door-answer rates, pitch-to-close ratios by vertical, creative variant performance) that currently sit unused between runs. A human campaign manager synthesises these manually before composing the next campaign; the call centre sequences creative ad-copy and door scripts by instinct; territory selection is a spreadsheet exercise.

The platform already ships a Campaign-Compose Orchestrator (architecture.md §10.1), driven by BullMQ and writing to the existing queues `content-generate`, `ad-deliver`, and `audit-ship`. That orchestrator is deterministic: it fans out fixed tasks, collects results, and gates on the hard compliance rules defined in §10.2 (per-vertical, per-region). It does not learn. It does not parallelise creative variants. It does not carry forward the winning door script from last week's solar run into this week's energy run. It does not assist the call centre with live objection handling or campaign-context retrieval. It does not compress and route the territory-intelligence signals that accumulate after every closed loop.

Three product surfaces are blocked on this gap:

1. **Marketing Studio** (services/content-studio + services/marketing) cannot auto-polish multi-variant creative, generate vertical-specific door scripts, or surface territory heat without manual prompt engineering per campaign.
2. **Inside-sales assist** cannot inject campaign context (running vertical, client brief, pitch stage) into call-centre agent tooling without a persistent, tenant-scoped skill memory.
3. **Territory intelligence** cannot synthesise attribution signals from previous closed loops into a ranked territory recommendation without a subagent that reads closed-loop data, applies a skill, and writes a structured recommendation for human approval.

The risk profile of doing this wrong is high. D2D runs on an audit-grade fintech spine: immutable hash-chained audit log (ADR-0008, S3 Object Lock 7yr, Merkle-rooted), idempotent POSTs, tenant-scoped RLS, region-pinned execution (ADR-0016), money as BigInt cents, and a hard rule that payout is instruct-only and never auto-debited (ADR-0019). Autonomous agents that can touch money, publish unapproved content, or execute code outside a sanctioned environment violate the platform's compliance contract with clients. Autonomy risk is real; the governance layer must be structural, not advisory.

The question this ADR answers: how do we introduce in-product agents that make the loop smarter, without taking on autonomy risk, without adding new infrastructure dependencies, and in a way that is fully auditable on the ADR-0008 Merkle spine?

---

## Decision

D2D will implement a **three-tier agent topology** — Orchestrator → Subagents → Tools — built entirely on existing primitives: BullMQ job-graphs, Postgres state tables, and the §10.1–§10.4 campaign orchestration machinery already in production. No new software dependencies are introduced.

### Tier 1 — Orchestrator

The existing Campaign-Compose Orchestrator (§10.1) is extended, not replaced, to act as the root orchestrator for agentic runs. When a campaign manager initiates a campaign-compose or territory-intelligence run, the orchestrator:

1. Validates the request against tenant RLS and region-pinning (ADR-0016, ADR-0020) before dispatching any child work.
2. Allocates a run-budget slice (token budget + wall-clock deadline) from the tenant's configured agent budget; this is a Postgres row, not an in-memory counter, so it survives worker restarts.
3. Emits a `run_started` event through the ADR-0008 transactional outbox, which is hash-chained into the Merkle spine and written to S3 Object Lock before the first subagent BullMQ job is enqueued.
4. Constructs a `campaign-context` hub document — a compact, provenance-stamped JSON blob containing the active vertical, client brief, territory, prior-run skill memory (human-approved only), and the §10.2 compliance gate configuration for this vertical and region.
5. Enqueues subagent jobs on the relevant BullMQ queues with the hub document attached as job data.

The orchestrator never writes to `services/payout`, `crm.send`, or `marketing.publish` directly. Those paths require a separate human-in-the-loop step (see Governance section).

### Tier 2 — Subagents

Subagents are BullMQ workers that receive a job, execute a scoped task, write their result and audit row to Postgres, and exit. They are stateless between invocations; state lives in Postgres. Each subagent:

- Inherits a **subset** of its parent orchestrator's tool allowlist; it can never exceed the parent's grant (subset-inheritance contract, enforced by the dispatch wrapper).
- Consumes a slice of the parent run-budget; if the slice is exhausted, the job fails closed — no partial output is promoted.
- Writes an audit row that references the parent run ID, forming a run tree (see State section).

The initial subagent roster, mapped to D2D loop stages:

| Subagent                | Queue                                    | Responsibility                                                                                   | Vertical gating                           |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `creative-polish`       | `content-generate`                       | Generate + score N creative variants for a given ad slot; returns ranked set                     | Charity / Commercial                      |
| `door-script-adapt`     | `content-generate`                       | Adapt base door script to territory + vertical using skill memory                                | Solar / Pest / Telecom / Energy / Charity |
| `call-sequence-suggest` | `content-generate`                       | Suggest call-centre follow-up sequence (day 1–7 cadence) from prior-run close-rate signals       | All verticals                             |
| `territory-rank`        | `content-generate`                       | Read closed-loop attribution signals, produce ranked territory recommendation as structured JSON | All                                       |
| `audit-package`         | `audit-ship`                             | Collate run outputs, hash, emit to outbox                                                        | All                                       |
| `compliance-gate`       | internal (synchronous pre-publish check) | Apply §10.2 hard gates before any output is queued for human review                              | Per-vertical rules                        |

Subagents that produce human-facing output — creative variants, door scripts, call sequences — always write to a `pending_review` staging table. Nothing reaches `marketing.review` or `crm.send` queues without a human explicitly promoting it. This is structural, not advisory: the BullMQ job that writes to `marketing.review` is only enqueued by the human-approval API endpoint, not by any subagent.

### Tier 3 — Tools

Tools are the atomic capabilities available to subagents. The allowlist is default-deny: a tool must be explicitly granted to a subagent in its dispatch wrapper configuration before the subagent can invoke it. The initial sanctioned tool set:

| Tool                                              | Grants                                                                            | Off every allowlist                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `db.read` (tenant-scoped, RLS-enforced)           | All subagents                                                                     | —                                                             |
| `db.write` (staging tables only)                  | `creative-polish`, `door-script-adapt`, `call-sequence-suggest`, `territory-rank` | Production payout tables, audit spine (write-only via outbox) |
| `queue.enqueue` (audit-ship only)                 | `audit-package`                                                                   | `ad-deliver` direct, `crm.send`, `marketing.publish`          |
| `llm.complete` (prompt-injection defended, §10.3) | All subagents                                                                     | —                                                             |
| `budget.check`                                    | All subagents                                                                     | `budget.modify`                                               |
| `skill-memory.read` (human-approved rows only)    | All subagents                                                                     | `skill-memory.write` (orchestrator only, after human merge)   |

No MCP tools, no external shell, no file-system workspace, no HTTP calls to unsanctioned endpoints. The tool registry is a Postgres table (`agent_tools`); the dispatch wrapper reads it at job start, not at worker boot, so additions require no deployment.

---

## Subagent Isolation Contract

Three invariants are enforced structurally, not by convention:

**Subset-inherited allowlists.** The orchestrator's own tool grant is the ceiling. When the orchestrator dispatches a subagent job it writes the granted tool set as a JSON column on the BullMQ job payload. The dispatch wrapper on the worker side resolves the intersection of the job-payload grant and the worker's registered tool set; the smaller set wins. A subagent cannot escalate its own grant; there is no grant-elevation API.

**Per-child budget slices.** The parent run's budget row is decremented by the child's allocated slice at enqueue time, not at completion. If the parent budget would go negative, the enqueue fails and the orchestrator receives a `BUDGET_EXCEEDED` result code, triggering the fail-closed path.

**Per-child audit rows forming a run tree.** Every BullMQ job writes a row to `agent_run_nodes` with columns `(run_id, parent_node_id, node_type, status, tool_calls JSONB, output_hash, created_at, completed_at)`. The `run_id` is the root orchestrator's ID; `parent_node_id` chains the tree. The `audit-package` subagent finalises the tree, hashes the full node set, and emits through the ADR-0008 outbox into the Merkle spine.

---

## Pattern Adoption, Reframed for Fintech

Five patterns from NousResearch/hermes-agent are adapted here:

**1. Tool-approval allowlists == agent governance (default-deny).** The hermes pattern uses allowlists to constrain tool calls during a run. In D2D's context this is the governance layer itself: the dispatch wrapper checks the `agent_tools` Postgres table on every tool invocation, logs the check outcome to the outbox, and raises a `TOOL_DENIED` fault code if the tool is not in the subagent's inherited grant. Governance is not a post-hoc check; it is load-bearing in the execution path.

**2. Human-merged skill curation = per-vertical procedural memory.** Hermes maintains a procedural memory of effective tool-call patterns. D2D reframes this as `skill_memory`: a Postgres table of winning creative formats, door-script openers, and call-sequence cadences, keyed by `(vertical, region, campaign_type)`. Subagents read approved rows. When a campaign closes and attribution signals confirm a skill performed above threshold, the orchestrator writes a candidate row with `status = 'pending_approval'`. A human (campaign manager) reviews the candidate in the platform UI and merges it. No skill is reused until a human has approved it. This is the learning loop, at human pace, with an audit trail.

**3. Per-variant and per-channel parallelisation.** Hermes uses subagent fan-out to parallelise independent tasks. The `creative-polish` subagent fans out N variant jobs on `content-generate` simultaneously — one BullMQ job per variant, same parent run ID. The orchestrator collects results, scores them using the stored skill-memory quality rubric, and surfaces the ranked set for human selection. Parallelism is bounded by the run budget slice; if the budget runs out mid-fan, completed variants are returned and incomplete variants fail closed.

**4. Provenance-stamped context compression.** Hermes compresses conversation context to fit model windows. D2D's equivalent is the `campaign-context` hub document: a compact provenance-stamped JSON blob assembled by the orchestrator before any subagent is dispatched. It contains the minimum context each subagent needs (vertical, region, client brief excerpt, relevant skill-memory rows, compliance gate config). The hub document's hash is recorded in the parent run node; subagents cannot modify it. This prevents context drift across a fan-out and ensures every subagent is operating from the same provenance-verified snapshot. The §10.3 prompt-injection defence (input sanitisation, system-prompt pinning) is applied once, at hub-document construction, not per subagent.

**5. Hub-and-spoke skill graph.** The `campaign-context` hub is the central spoke. Each vertical (charity, solar, pest, energy/gas, telecom) has a compliance-gated spoke that contains only the §10.2 rules and skill-memory rows relevant to that vertical. A subagent operating in the charity vertical cannot read solar skill rows or solar compliance gates. The spoke boundary is enforced by the RLS policy on `skill_memory` (`vertical` column in the tenant's RLS predicate), not by application logic.

---

## Governance is Structural

Every agent dispatch — orchestrator initialisation and every subagent job enqueue — writes an event through the ADR-0008 transactional outbox before the job is accepted by BullMQ. The outbox entry is hash-chained into the existing Merkle spine and persisted to S3 Object Lock with a 7-year retention policy. There is no code path by which an agent run can begin without an immutable audit record.

For high-stakes runs (defined as: runs that produce creative destined for paid media, runs that update skill memory, runs involving territory recommendations that will be actioned with budget), the orchestrator applies a constitutional-critique step before dispatching subagents. This is a synchronous LLM call that checks the run parameters against a set of platform principles (PII handling, FTC-compliant claims, client brand safety, no discriminatory targeting). The critique result — PASS or BLOCK with a structured reason — is written to the run node before the fan-out proceeds. A BLOCK result halts the run immediately; the orchestrator returns a `CONSTITUTIONAL_BLOCK` code to the campaign manager UI with the reason.

The deterministic §10.2 compliance gates fire after subagent output is produced and before it is staged for human review. These gates are per-vertical rule tables (not LLM judgement): they check for prohibited claims by vertical, required disclosures by region, and format constraints. A gate failure writes a `COMPLIANCE_BLOCK` event to the outbox and moves the run node to `failed` status. The constitutional critique is intentionally layered before these gates, not instead of them — constitutional critique catches intent-level risks, §10.2 gates catch rule-level violations.

Human-in-the-loop is enforced for two classes of output: (1) any content that will reach a consumer channel (ad creative, door script, call sequence) and (2) any skill-memory candidate that will be merged into the procedural store. The BullMQ jobs that enqueue work onto `marketing.review` and `crm.send` are only triggered by the human-approval API endpoint. Subagents write to `pending_review`; humans promote. Region-pinning (ADR-0016) is inherited by the agent execution context: the BullMQ worker pool is region-tagged, and the orchestrator enqueues jobs only to workers in the tenant's pinned region. PII never crosses a region boundary inside agent context windows or tool call payloads.

---

## State and Observability

Three new Postgres tables are added; no new services:

| Table             | Key columns                                                                                                                                                              | Purpose                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `agent_runs`      | `id`, `tenant_id`, `campaign_id`, `status`, `budget_tokens`, `budget_remaining`, `region`, `started_at`, `completed_at`                                                  | Root run record; one per orchestrator invocation |
| `agent_run_nodes` | `id`, `run_id`, `parent_node_id`, `node_type`, `subagent`, `status`, `tool_calls JSONB`, `output_hash`, `created_at`, `completed_at`                                     | Run tree; one row per subagent job               |
| `skill_memory`    | `id`, `tenant_id`, `vertical`, `region`, `skill_type`, `content JSONB`, `status` (pending/approved/deprecated), `approved_by`, `approved_at`, `performance_signal JSONB` | Human-merged procedural memory                   |

OTel spans are emitted from the orchestrator and each subagent worker using the existing §11 instrumentation. Every BullMQ job start and completion emits a span with `run_id`, `node_id`, `subagent`, and `status` attributes. The existing PagerDuty alerting on §11 receives two new alert rules: `agent_run.budget_exhausted` (severity: warning) and `agent_run.constitutional_block` (severity: critical). The run-tree view in the campaign manager UI reads from `agent_run_nodes` via a recursive CTE; no new backend surface is required.

---

## Failure and Fallback Matrix

| Fault condition                   | Immediate action                                                                                 | Campaign manager surface                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Budget exhausted mid-run          | Fail closed; return completed subagent results only; no partial promotion to `pending_review`    | Warning banner; partial results available for manual review                  |
| §10.2 compliance gate block       | Run node → `failed`; `COMPLIANCE_BLOCK` written to outbox                                        | Blocked with gate rule ID and explanation                                    |
| Constitutional critique BLOCK     | Run halted before fan-out; `CONSTITUTIONAL_BLOCK` to outbox                                      | Blocked with critique reason; run cannot be retried without parameter change |
| Tool denied by dispatch wrapper   | `TOOL_DENIED` fault; subagent job → `failed`; parent run → `degraded`                            | Alert: governance violation logged; run degraded, not silently continued     |
| Model error / timeout             | Job retried up to 3× (BullMQ built-in retry); after 3 failures → `failed`; budget slice released | Timeout notification; partial results returned if any completed              |
| Prompt injection detected (§10.3) | Subagent aborts; injection attempt written to outbox with full payload for forensic review       | Security alert (PagerDuty P2); run halted                                    |
| Region constraint violation       | Orchestrator refuses to enqueue; no job created                                                  | Hard error; campaign manager must select correct region                      |

The platform never publishes on uncertainty. If a run completes in `degraded` status (some subagents failed, some succeeded), the campaign manager must explicitly choose to promote the available partial results. There is no auto-promote path, even for non-degraded runs.

---

## Explicit Non-Adoption

The following capabilities are deliberately excluded and must not be added as extensions to this architecture without a new ADR:

- **Autonomous money movement.** `services/payout` is off every agent allowlist. Payout remains instruct-only per ADR-0019. Commission calculation subagents (future scope) may read `agent_runs` for attribution but can only write a payment instruction to a `pending_payout_review` staging table; a human executes the transfer.
- **Self-modifying production code.** No subagent has write access to the application codebase, migration files, or configuration tables beyond `skill_memory` candidates. Code changes go through the normal PR process.
- **Unsanctioned external tool calls.** There are no MCP tool integrations, no outbound HTTP from subagents, and no external API calls beyond the sanctioned LLM completion endpoint. The tool registry contains only the internal tools listed above.
- **Autonomous publish.** No subagent enqueues work directly onto `marketing.publish`, `ad-deliver` (for live campaigns), or `crm.send`. These queues remain human-gated.
- **New infrastructure dependencies.** LangGraph, Temporal, CrewAI, AutoGen, and all agent frameworks are rejected at this time (see Alternatives Considered). The orchestration logic runs as BullMQ workers, inside the existing Node.js service boundary, using existing Postgres and queue infrastructure.
- **Unscoped file/shell workspace.** No agent has access to a local file system, shell execution environment, or container escape surface.

---

## Consequences

**Positive.** The loop becomes self-improving at human pace: skill memory accumulates approved winning patterns across verticals and regions without introducing autonomous decision-making. Campaign-compose time decreases because the orchestrator can fan out variant generation in parallel rather than sequentially. The call centre receives context-enriched sequences calibrated to the territory's closed-loop signals. The constitutional critique and §10.2 gates compose cleanly: intent-level safety before rule-level compliance. The entire agent execution surface is auditable on the same Merkle spine as transactions, with no additional tooling. The subset-inheritance contract means a privilege-escalation bug in a subagent cannot exceed what the orchestrator was granted — a hard blast radius limit. There are no new services to operate, no new SLAs to meet on novel infrastructure.

**Negative.** The BullMQ job-graph model is less expressive than a purpose-built workflow engine for complex branching agent plans. Conditional fan-out (e.g., re-running only failed subagents with a revised hub document) requires explicit orchestrator logic rather than a framework-level concept like a DAG re-execution node. The human-in-the-loop requirement for every output is intentional but adds latency to the campaign-compose workflow; campaign managers must actively review and promote before any content is queued. Skill-memory growth is bounded by human review bandwidth — the system cannot autonomously absorb lessons faster than a human can approve them, which is a deliberate throttle but also a ceiling on learning velocity. The constitutional-critique step adds latency and token cost to every high-stakes run; this must be monitored against the §11 budget alerts.

---

## Rollout

**Phase 1 — Deterministic orchestration spine (US pilot).** Extend the existing Campaign-Compose Orchestrator with the `agent_runs` and `agent_run_nodes` tables, the audit-package subagent, and the run-tree OTel instrumentation. No LLM-driven subagents in production yet. This phase proves the isolation contract, the Merkle integration, and the run-tree view with zero autonomy risk.

**Phase 2 — Compliance-gated creative generation (US pilot, first three verticals).** Enable `creative-polish` and `door-script-adapt` subagents for solar, pest, and charity verticals. Skill memory initialised with manually authored seed rows; no learned rows yet. Human review gate active; constitutional critique active for any run producing paid-media creative. Measure: campaign-compose time, gate block rate, campaign manager review latency.

**Phase 3 — Skill curation loop + parallel polish (post-pilot, all regions).** Enable the skill-memory candidate pipeline: closed-loop attribution signals trigger candidate rows; campaign managers review in the platform UI. Enable per-variant parallelisation for `creative-polish`. Enable `call-sequence-suggest` for the call centre. Roll out to AU and SG regions with region-pinned worker pools (ADR-0016).

**Phase 4 — Territory intelligence subagent.** Enable `territory-rank` as a read-only synthesis subagent consuming closed-loop attribution data. Output is a structured JSON recommendation surfaced to the campaign manager; no autonomous action is taken on it. Validate recommendation quality against actual territory performance across 6–8 closed loops before considering any automation of territory selection.

---

## When to Revisit

This ADR should be reopened if: (1) BullMQ job-graph complexity exceeds what can be maintained without a dedicated workflow engine (trigger: more than 8 distinct subagent types or more than 3 levels of nesting in a single run); (2) the human-review bottleneck demonstrably limits platform revenue (measure: review queue age > 4 hours for > 10% of runs); (3) a new regulated capability (e.g., live commission calculation, real-time territory bidding) requires agent access to `services/payout` — at that point ADR-0019 must be amended first; (4) a security audit identifies a tool-allowlist bypass.

---

## Alternatives Considered

| Option                                                | Reason rejected                                                                                                                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LangGraph**                                         | New dependency; introduces its own state machine and persistence layer that would shadow the existing BullMQ + Postgres spine; not compatible with the no-new-deps constraint                                  |
| **Temporal.io**                                       | Heavyweight new service (Temporal server + workers); excellent for complex workflows but significant operational surface; deferred to a future ADR if Phase 1–2 proves BullMQ insufficient                     |
| **CrewAI / AutoGen**                                  | Python-first agent frameworks; D2D's service layer is Node.js; cross-language boundary adds operational complexity and a new runtime to secure; no gain over BullMQ workers given the constrained tool surface |
| **Fully autonomous agent (no human-in-loop)**         | Rejected on compliance and client-brand-safety grounds; an autonomous publish path is incompatible with the audit-grade fintech bar and the FTC risk profile                                                   |
| **Off-the-shelf LLM agent platform as orchestration** | Observability tools (LangSmith/Langfuse) are acceptable; using them as orchestration would route agent state through a third-party service, violating region-pinning (ADR-0016) and PII residency requirements |
