# Overnight Source-Mining Triage — Four MIT Repos vs. Door 2 Digital

**Date:** 2026-06-03 · **Scope:** Pattern extraction only. No external code or text copied. No new software dependencies introduced. No URLs fetched. All four repos confirmed public, MIT-licensed, no prompt-injection found in vetted notes.

**Bottom line:** We mined four repos for _patterns_, captured them in D2D-native artifacts, and integrated **zero lines** of their code. The highest-value take is a hub-and-spoke skill architecture for the Marketing Studio (from `marketingskills`) and a security-reframed agent self-improvement loop (from `hermes-agent`). The MCP catalog yielded a short server shortlist after hard curation. `odysseus` contributed three transferable UX ideas and was otherwise correctly rejected as out-of-scope for a regulated fintech platform.

---

## 1. coreyhaines31/marketingskills

**What it is:** A library of 44 Markdown "marketing skills" organized in a **hub-and-spoke** topology. A single foundational `product-marketing` skill is the hub; every other skill checks it first to learn product, audience, and positioning before acting. Spokes cross-reference each other via a "Related Skills" section. Each skill is invocable two ways: by slash-command (`/cro`, `/seo-audit`) or by natural language. Nine functional areas — conversion, content, SEO, paid, measurement, retention, growth, strategy, sales.

**License:** MIT.

**Patterns D2D adopted (and the artifact that captured them):**

| Pattern                                    | D2D adaptation                                                                                                                                                                              | Captured in                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hub skill every spoke consults first       | A foundational **`campaign-context`** skill holding the org's vertical, brand voice, territory, compliance regime, and loop stage. Every Marketing Studio skill reads it before generating. | `services/content-studio` skill registry; new `campaign-context.md` spoke-hub |
| "Related Skills" cross-referencing         | Each D2D campaign skill links its upstream/downstream loop neighbors (e.g. `retarget-audience` ↔ `knock-attribution` ↔ `inside-sales-followup`).                                            | Skill front-matter `related:` field                                           |
| Dual invocation (slash + natural language) | Vertical campaign skills are slash-invocable (`/solar-ad`, `/charity-appeal`, `/pest-creative`) inside the Studio and also reachable by NL from the campaign-compose orchestrator.          | `services/marketing` command surface                                          |
| Nine-area functional taxonomy              | Reused as an _internal map_ to ensure coverage, not as the product surface.                                                                                                                 | Internal skill-coverage matrix                                                |

**What we explicitly SKIPPED, and why:**

- **~40 of the 44 skills are commodity** (`ab-testing`, `analytics`, `emails`, `popups`, `pricing`, `schema`, `social`, etc.). They describe generic B2B/SaaS growth motion. D2D's edge is the opposite: **vertical + door-to-door + compliance-gated** skills that no generic library contains. We are not porting generic skills; we are authoring D2D-native ones.
- **Their text/wording** — not copied. The patterns (topology, cross-ref, dual-invoke) are structural and uncopyrightable; the prose is theirs and stays theirs.
- **SaaS-centric assumptions** baked into skills like `paywalls`, `signup`, `onboarding`, `free-tools`, `aso` — irrelevant to an operator-run, brand-under-client field-sales model. Skipped wholesale.

**Why it matters for the LOOP:** The hub-and-spoke fit is exact. The Studio's job is to MARKET (pre-warm a territory before the knock) and RETARGET (re-engage knocked-not-converted). A hub skill that injects _this org, this vertical, this territory, this compliance gate_ into every generation is the cleanest way to keep ad creative on-brand and inside the hard gates (no "free solar," no "guaranteed impact," DMO/VDO reference present).

---

## 2. NousResearch/hermes-agent

**What it is:** A self-improving agent framework. Relevant patterns: a **skill-curation loop** (the agent generates/tests/refines reusable skills _after_ each task, building procedural memory); **subagent parallelization** (isolated agents for parallel workstreams via RPC tool-calling); **context compression** (LLM summarization to preserve semantics over long horizons); **tool-approval allowlists** (command allowlists for secure delegation in restricted envs); FTS5 cross-session search; persistent user modeling; MCP integration; cron automations.

**License:** MIT.

**Patterns D2D adopted (reframed with fintech security), and the artifact:**

| hermes pattern                       | D2D reframe                                                                                                                                                                           | Captured in                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Skill-curation loop (post-task)      | After a campaign-compose run, the orchestrator proposes a refined reusable skill — but it lands in a **review queue, not auto-merged**. Every promotion is a governed, audited event. | campaign-compose orchestrator; promotion gated by `agent-governance` + `agent-audit-log` |
| Subagent parallelization             | Parallel workstreams for a single campaign brief: copy (Claude/GPT), image (FLUX/Ideogram), video (Runway/HeyGen), compliance-gate check — fanned out, then reconciled.               | `services/marketing` compose fan-out                                                     |
| Tool-approval allowlists             | **Allowlist == agent governance.** Each agent dispatch is constrained to an explicit tool/command allowlist; anything outside is refused and logged.                                  | `agent-governance` (always-on); per-agent allowlist manifest                             |
| Context compression                  | Long-horizon campaign threads summarized to preserve attribution/decision semantics without unbounded context.                                                                        | Orchestrator memory layer                                                                |
| Cross-session search / user modeling | Deferred — useful later for inside-sales agent recall across a 7-day close window.                                                                                                    | Backlog (not built)                                                                      |

**What we explicitly SKIPPED, and why:**

- **Self-modifying / auto-promoting skills.** A regulated platform cannot let an agent silently rewrite its own behavior. We keep the _loop_ but insert a **human/governance gate** on every skill promotion — this is the single most important reframe. Their "self-improving, autonomous" framing is replaced with "self-_proposing_, human-approved, fully audited."
- **Unrestricted tool-calling and shell access.** Out of scope. Every dispatch is allowlist-bound, audit-logged, and constitutional-critiqued for high-stakes output. Agent governance is ALWAYS on.
- **Their persistence/storage layer** (FTS5 etc.) — pattern noted, code not adopted. D2D storage is tenant-scoped, RLS-enforced, region-pinned; we will not inherit a foreign persistence model.

**Why it matters for the LOOP:** The compose step (MARKET + RETARGET) is genuinely a parallel, multi-modal, long-horizon agent problem. hermes is the best _shape_ reference we found for it. Reframed through agent governance, it becomes auditable: every dispatch logged, every high-stakes creative constitutionally critiqued, every skill promotion reviewable — exactly the bar D2D already holds for agent dispatch.

---

## 3. punkpeye/awesome-mcp-servers

**What it is:** The canonical, community-maintained MCP server catalog (88k stars). Comprehensive — and _because_ it's open and SEO-attractive, it is **heavily polluted with low-quality and SEO-spam entries**. Value is entirely in curation, not in the list itself.

**License:** MIT.

**What D2D took:** A **hard-curated shortlist** of reputable, stack-relevant servers to _evaluate_ (not auto-adopt). Candidates, mapped to where they'd serve in the loop:

| MCP server                           | Loop / ops role                                                         |
| ------------------------------------ | ----------------------------------------------------------------------- |
| **Stripe**                           | COMMISSION + billing rails                                              |
| **microsoft/playwright-mcp**         | Browser automation for ad-platform delivery checks (Meta/Google/TikTok) |
| **awslabs/mcp**                      | Region-pinned infra (US/AU/SG residency)                                |
| **hashicorp/terraform-mcp-server**   | IaC for tenant provisioning                                             |
| **cloudflare/mcp-server-cloudflare** | Edge / WAF / brand-safety perimeter                                     |
| **Postgres MCP**                     | Tenant-scoped data (RLS)                                                |
| **Slack MCP**                        | Ops + alerting                                                          |
| **Sentry MCP**                       | Observability                                                           |
| **Brave / web-search MCP**           | Competitor + territory research                                         |

Captured in: an **MCP candidate register** (vendor-vetting backlog), each entry flagged "evaluate under vendor-check + dependency-supply-chain before any wiring."

**What we explicitly SKIPPED, and why:**

- **The SEO-spam tail.** The majority of catalog entries are low-signal, abandoned, single-author, or keyword-stuffed for GitHub visibility. We treated the catalog as _adversarial input_: default-deny, allowlist only first-party / well-known-vendor servers (Stripe, Microsoft, AWS, HashiCorp, Cloudflare, Sentry).
- **Any "install and try" of unknown servers.** An MCP server is executable code with network/tool access — wiring one is a **supply-chain decision**, not a convenience. None are adopted on the strength of a catalog listing.
- **The catalog itself as a dependency.** We extracted names into our own register and discarded the source.

**Discipline applied:** No server moves from "candidate register" to "wired" without passing `vendor-check`, `dependency-supply-chain`, and a PCI/SOC2-scope review. Stars are not a security control.

---

## 4. pewdiepie-archdaemon/odysseus

**What it is:** A mature self-hosted AI workspace (FastAPI, 38k stars) — chat + agents + research + email/calendar + local model serving, with shell/file tooling. Effectively a self-hostable ChatGPT/Claude clone.

**License:** MIT.

**Transferable IDEAS D2D took (ideas only — no code), and the artifact:**

| Idea                          | D2D application                                                                                                                                            | Captured in                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AI email triage               | Triage the **inside-sales inbox** during the 7-day CALL-CENTRE close window — classify, prioritize, surface knocked-not-converted replies as tagged leads. | Inside-sales inbox concept note (backlog) |
| Side-by-side model comparison | Feeds the **LLM router eval** — compare Claude/GPT outputs for ad copy on quality + compliance-pass rate before routing.                                   | LLM router eval harness (design note)     |
| Multi-step research synthesis | Territory/competitor research synthesis to inform the _next_ area's geo-targeting.                                                                         | Research-synthesis backlog item           |

**What we explicitly SKIPPED — and this is most of the repo, by design:**

- **The entire self-hosted ChatGPT/Claude clone.** D2D is not building a general AI workspace. A chat-with-everything app is the _opposite_ of an audit-grade, tenant-scoped, hard-gated fintech platform. Rejected as a product-shape.
- **Shell and local-file tools.** Categorically incompatible with our security posture (tenant isolation, RLS, region-pinning, agent allowlists). An agent with shell/file access cannot satisfy our governance model. Hard no.
- **Local model serving.** Not aligned with our managed, region-pinned, audited LLM routing; introduces an unvetted serving surface. Skipped.
- **Email/calendar as a general workspace feature.** We took the _triage idea_ for one specific inbox; we did **not** take the general PIM/workspace surface.

**Honest assessment:** ~85% of `odysseus` is out-of-scope. Its value to D2D is three narrow UX ideas, each of which we will rebuild natively inside the loop with our own governance, isolation, and provenance. The repo is a good _idea quarry_, not a foundation.

---

## Why we did NOT bulk-integrate any of this code

Four independent reasons, any one of which is sufficient:

1. **Untrusted code.** "MIT-licensed, 88k stars, no prompt-injection found in our notes" clears _legal_ and _first-pass_ hurdles — it does **not** clear a security review. None of these repos has been read line-by-line by us, dependency-audited, or threat-modeled. Stars are popularity, not assurance. We treat all four as untrusted input and extract patterns, not payloads.

2. **Supply-chain exposure.** Pulling a repo (especially MCP servers and a FastAPI workspace with shell/file tools) means inheriting its transitive dependency tree, its update cadence, and its compromise surface. For a platform handling PII across US/AU/SG with money as BigInt cents, every imported package is attack surface we'd then own. The `awesome-mcp-servers` SEO-spam problem is a live illustration of why catalogs are adversarial.

3. **No-new-dependencies rule (standing constraint).** D2D's engineering bar forbids introducing new software dependencies casually. Patterns are free; packages are debt. We deliberately captured every learning as a D2D-native artifact (a skill, an orchestrator behavior, a register entry) that adds **zero** to the dependency graph.

4. **SOC 2 / PCI scope containment.** Every executable component in our boundary expands audit scope and must carry evidence (access controls, change management, vendor assessment). Bulk-importing four codebases — one with local model serving and shell access — would balloon SOC 2 scope and risk dragging untrusted code into PCI territory. Re-implementing the _handful_ of patterns we actually want, natively and governed, keeps scope tight and auditable. Cheaper to build the 10% we need than to certify the 90% we don't.

**Net:** patterns in, code out. Every adopted idea lives in a D2D artifact under our own audit, tenancy, region-pinning, and agent-governance — not as a foreign import.

---

## Highest-leverage follow-ups — ranked, for Brodie to approve

1. **Build the `campaign-context` hub skill** (from `marketingskills` hub-and-spoke). Single foundational skill holding org vertical, brand voice, territory, compliance regime, loop stage — consulted by every Marketing Studio generation. _Highest leverage: it's the spine that keeps all AI creative on-brand and inside hard gates. Everything else hangs off it._

2. **Author the first 3–4 vertical, compliance-gated campaign skills** as slash-invocable spokes: `/charity-appeal` (paid-solicitor state-clearance + DGR/501(c)(3) disclosure), `/solar-ad` (block "free solar"/"$0 down"; CEC/FTC Green Guides), `/pest-creative` (block health claims; APVMA disclosure), `/energy-telco-offer` (DMO/VDO reference required). _This is D2D's actual moat — vertical + door-to-door + compliance gates no generic library has._

3. **Wire the governed skill-curation loop into campaign-compose** (from `hermes-agent`, reframed): post-run skill _proposals_ → review queue → governance + audit on promotion. _Compounds quality of the Studio over time without ceding control — the self-improving flywheel, made auditable._

4. **Stand up the compose fan-out with allowlist governance** (from `hermes-agent`): parallel copy/image/video/compliance-gate subagents, each allowlist-bound, every dispatch audit-logged, high-stakes creative constitutionally critiqued. _Directly powers the MARKET and RETARGET loop stages; bakes governance into the hot path._

5. **Open the MCP candidate register and run `vendor-check` on the top 3** — Stripe, Postgres MCP, Sentry MCP — before any wiring. _Highest-value, lowest-risk servers; gate each through `dependency-supply-chain` + PCI/SOC2-scope review. Default-deny the rest._

6. **Draft the inside-sales inbox triage concept** (from `odysseus`): AI triage of the CALL-CENTRE inbox over the 7-day close window, surfacing knocked-not-converted replies as tagged leads back into the loop. _Concrete CONVERT-stage win; spec it before building._

7. **Spec the LLM router eval harness** (from `odysseus` side-by-side comparison): score Claude vs GPT ad copy on quality **and** compliance-pass rate to drive routing. _Turns model choice into a measured decision, not a default; feeds straight into the compliance gates._
