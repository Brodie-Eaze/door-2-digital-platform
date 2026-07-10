# Overnight repo-mining — morning brief

**Date:** 2026-06-03 · **Mode:** ideas-only mine → original artifacts · **Status:** complete
**Nothing was committed, merged, pushed, deployed, or given new dependencies.** Everything below is reviewable Markdown under `docs/research/overnight-mining-2026-06-03/`.

---

## What ran

A 9-agent swarm produced original D2D artifacts from **vetted notes** I extracted from four external repos. No agent re-read the untrusted repos; all four were first triaged by me (read-only, public, **all MIT-licensed, no prompt-injection found**). No external code was copied; no npm dependencies were introduced.

Cost: ~302k subagent tokens + one ~26k Sonnet repair call for the ADR (~5 min wall-clock). Within the budget cap.

---

## The artifacts

| File                                             | What it is                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `marketing-studio/00-skill-library.md`           | Architecture + index for a **D2D Marketing Studio skill library** — hub-and-spoke off a foundational `campaign-context` skill, organised by **loop stage** (warm-the-area → retarget → convert-assist → measure), slash-invocable, with the orchestrator selection logic and mandatory brand-safety/C2PA rails.                                        |
| `marketing-studio/skills/charity-fundraising.md` | Vertical campaign skill — ACNC/501(c)(3)/DGR gates, no "guaranteed impact", paid-solicitor state-clearance; pass/fail ad examples.                                                                                                                                                                                                                     |
| `marketing-studio/skills/solar.md`               | Solar — blocks "free solar / $0 down" without finance terms; CEC / FTC Green Guides; substantiated savings.                                                                                                                                                                                                                                            |
| `marketing-studio/skills/pest-control.md`        | Pest — blocks health claims; ACL substantiation; APVMA disclosure.                                                                                                                                                                                                                                                                                     |
| `marketing-studio/skills/energy-retail.md`       | Energy/gas — blocks locked comparison without DMO/VDO; AER / FCC.                                                                                                                                                                                                                                                                                      |
| `marketing-studio/skills/telecom-broadband.md`   | Telecom/broadband — FCC rules; substantiated speed/coverage.                                                                                                                                                                                                                                                                                           |
| `adr/ADR-0030-agent-orchestration.md`            | **ADR-0030** — agent orchestration for the intelligence layer (hermes patterns → our governance): three-tier Orchestrator→Subagents→Tools on existing BullMQ+Postgres, subset-inherited allowlists, human-merged skill curation, audit-logged on the ADR-0008 Merkle spine, explicit non-adoption (no autonomous money/publish/code), 4-phase rollout. |
| `mcp-integration-roadmap.md`                     | Curated MCP roadmap — honest that the awesome-list has SEO-spam; recommends only reputable servers, with security posture + a "do-NOT-wire" list.                                                                                                                                                                                                      |
| `repo-mining-triage.md`                          | Per-repo: what we took / skipped / why; the honest "why we did not bulk-integrate any of this code."                                                                                                                                                                                                                                                   |

---

## What we took vs skipped (honest)

- **coreyhaines31/marketingskills (MIT)** — took the _pattern_ (hub-and-spoke off a foundational context skill, slash-invocation, cross-referencing). Skipped its 44 generic skills — most are commodity and you already own them as Claude Code skills. **D2D's edge is the vertical + door-to-door + compliance-gated skills above**, which don't exist anywhere else.
- **NousResearch/hermes-agent (MIT)** — took the patterns (skill-curation loop, subagent parallelism, context compression, **tool-approval allowlists**) and reframed them for a regulated fintech context in ADR-0030. Skipped its multi-platform gateway, cron autonomy, and self-improving-in-prod loop (incompatible with our audit/no-autonomy bar).
- **punkpeye/awesome-mcp-servers (MIT)** — took it as a _catalog_, then curated hard. **Flagged honestly:** the list contains many low-quality/SEO-spam entries; the roadmap recommends only reputable servers and gates each behind security posture.
- **pewdiepie-archdaemon/odysseus (MIT)** — mostly **skipped**. It's a mature self-hosted ChatGPT/Claude-clone workspace with shell/file tools — not a fit for a regulated fintech platform. Only the AI email-triage and side-by-side model-comparison _ideas_ transfer (noted in the triage for inside-sales + the LLM router).

**Why no bulk code integration:** untrusted-code + supply-chain risk into a SOC2/PCI-scope codebase, the standing no-new-dependencies rule, and the fact that the value here is _patterns_, not their runtimes. The guardrails blocking the original bulk clone were correct.

---

## Ranked follow-ups (each needs your OK — all gated)

1. **Wire the vertical campaign skills into the real `services/content-studio`** as a review branch — turn the 5 skill specs into the Studio's actual generation prompts + the per-vertical hard-gate config. This is the biggest "bring the Studio to life" win. _(new branch, no deps, no deploy)_
2. **Adopt ADR-0030** — move it to `docs/adr/0030-…md` and start Phase 1 (the deterministic orchestration spine: `agent_runs` + `agent_run_nodes` tables + run-tree view). Pure existing-stack.
3. **Expand `docs/adr/0023-ai-content-provenance.md`** — flagged during the run as a stub that's now load-bearing for both architecture.md §10.3 and ADR-0030.
4. **MCP roadmap Phase 1** — wire the 1–2 lowest-risk reputable servers from the roadmap behind scoped creds + governance (nothing touching money/PII).

Say the word on any and I'll execute it as a reviewable branch — nothing ships without your call.
