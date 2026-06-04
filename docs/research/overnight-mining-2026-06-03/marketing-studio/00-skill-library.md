# D2D Marketing Studio Skill Library — Architecture & Index

> **System:** `services/content-studio` + `services/marketing` (the in-product AI "Marketing Studio")
> **Pattern:** Hub-and-spoke prompt/skill library with a foundational context skill, slash-invocation, cross-referencing, and an orchestrator that selects + chains skills.
> **Mission:** Geo-warm a territory **before** the field team knocks, retarget the non-converts, assist the close, and feed attribution back into the next area's targeting — under the **client's** brand, on a **dedicated audit-grade tenant**, behind **hard per-vertical compliance gates**.
> **Engineering bar:** audit-grade fintech. Immutable hash-chained audit, idempotent POSTs, tenant-scoped (RLS), region-pinned (US/AU/SG — PII never leaves region), money as BigInt cents. Agent governance ALWAYS on. Design DNA: EazePay navy, Inter + JetBrains Mono, no glass, no aurora.

---

## 0. Design principles (what makes this ORIGINAL, not a clone)

The vetted reference (`coreyhaines31/marketingskills`) taught us **three patterns only** — a foundational context skill every spoke consults first, a `## Related Skills` cross-reference block, and slash-or-natural-language invocation. We adopt the **shape**; the substance below is specific to D2D's loop, verticals, and compliance gates. No external code or text is copied.

1. **The loop is the spine, not the funnel.** Generic marketing libraries organize by channel (SEO/paid/email). D2D organizes by **loop stage** — `Warm-the-area → Knock → Call-centre → Retarget → Convert → Commission` — because the asset's job is to change what happens at a **door** in a **specific territory**, not to drive a web signup. Every skill declares which loop stage it serves.
2. **Geo-before-people.** Every Warm-the-area skill is **territory-scoped first** (polygon/ZIP/SA2 + walk-sheet window) and audience-scoped second. The asset exists to make a neighborhood recognize the brand **before** the knock — measured by knock-acceptance lift, not CTR.
3. **Compliance is a gate, not a guideline.** Per-vertical rules (charity solicitor clearance, solar "free/$0-down", pest health claims, energy DMO/VDO) are **hard publish-blocks** wired into a single `brand-safety-gate` skill every generation step calls. A blocked asset never reaches a delivery API.
4. **Provenance is mandatory.** Every generated image/video/audio is **C2PA-signed** and every copy asset carries a content credential + hash before it can be attached to an ad. No provenance manifest → no publish. This is the same discipline as the immutable money ledger, applied to creative.
5. **Hub-and-spoke, enforced.** A spoke that acts without first loading `campaign-context` is a bug. The orchestrator refuses to dispatch any spoke whose run-record lacks a `context_ref` pointing at a frozen context snapshot.
6. **Operator-first economics.** D2D runs the campaign with its **own** field team, call centre, marketing dept, and creative studio. Skills assume D2D owns delivery and the client owns the **brand + territory + offer truth** — so brand assets and offer claims are _inputs the client warrants_, and substantiation evidence is a _required attachment_, not a nice-to-have.

---

## 1. Hub-and-spoke architecture

```
                         ┌───────────────────────────────────────────────┐
                         │   HUB:  /campaign-context   (load first)       │
                         │   org · vertical · territory · brand ·         │
                         │   compliance · offer-truth · budget · region   │
                         └───────────────────────┬───────────────────────┘
                                                 │ context_ref (frozen snapshot)
        ┌──────────────────┬─────────────────────┼─────────────────────┬──────────────────┐
        ▼                  ▼                     ▼                     ▼                  ▼
  WARM-THE-AREA        RETARGET            CONVERT-ASSIST           MEASURE          CROSS-CUTTING
  /geo-warm-ads     /knock-retarget     /callcentre-script-kit   /campaign-readout  /brand-safety-gate
  /neighbor-proof   /lookalike-expand   /doorstep-leavebehind    /territory-attrib  /provenance-sign
  /territory-       /seasonal-rewarm    /objection-microcopy     /lift-experiment   /legal-hold-check
   landing                                                                          /budget-governor
  /multilingual-                                                                     /vertical-policy-pack
   localize
                                  ▲                                   ▲
                                  └──────── consult ──────────────────┘
                          ORCHESTRATOR: /campaign-compose  (selects + chains spokes)
```

- **Hub** = `campaign-context`. The single source of campaign truth. Every spoke's **Step 0** is "load the frozen context snapshot or refuse."
- **Spokes** = ~14 stage/vertical campaign skills. Each is slash-invocable (`/geo-warm-ads`) **and** natural-language triggerable ("warm up the Mesa AZ territory for the solar push").
- **Cross-cutting skills** = mandatory services every spoke calls inline (brand-safety, provenance, legal-hold, budget). They are _not_ optional spokes; they are the rails.
- **Orchestrator** = `campaign-compose`. Decomposes a campaign brief into a stage chain, dispatches spokes (parallel where independent), and is the only thing that writes the final publish-eligible bundle.

---

## 2. The foundational skill — `/campaign-context` (the hub)

**File:** `skills/_hub/campaign-context.md`
**Trigger:** Auto-loaded by `campaign-compose` before any spoke; directly invocable as `/campaign-context [org_id] [campaign_id]` to inspect or refresh the snapshot.
**Why it's the hub:** It is the **only** skill permitted to read raw org/territory/brand/compliance records. It compiles them into a **frozen, hash-stamped context snapshot** (`context_ref`) that every other skill consults — so a spoke never re-derives compliance state, never guesses the brand, and never reads cross-tenant data. If the underlying facts change mid-campaign, the hub re-freezes and bumps `context_ref`; in-flight assets bound to a stale ref are flagged for re-gate.

### 2.1 What every campaign skill must load first (the context contract)

| Block                              | Facts compiled                                                                                                                                                                  | Used downstream for                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Org / tenant**                   | `org_id`, tenant region pin (US \| AU \| SG), RLS scope, AI budget cap + spend-to-date, legal-hold status, kill-switch state                                                    | Region-correct delivery, budget refusal, hold refusal                     |
| **Vertical**                       | One of `charity` \| `solar` \| `pest` \| `energy_telco`; sub-type (e.g. `pest:residential`, `energy:gas`)                                                                       | Selects the **vertical policy pack** (the right hard-gate set)            |
| **Territory**                      | Polygon / ZIP+4 / AU SA2 / SG planning-area set; walk-sheet window (knock start/end dates); field-team crew IDs; prior-area attribution carry-in                                | Geo-targeting bounds; warm-before-knock timing; lookalike seeding         |
| **Brand (client-owned)**           | Locked logo/wordmark + C2PA brand-asset hashes, color tokens, voice rules, banned phrases, required disclaimers, approved spokespeople/likeness rights                          | Brand-safety gate; creative generation guardrails; provenance pinning     |
| **Offer-truth (client-warranted)** | The exact, substantiated offer + **evidence attachments** (e.g. solar savings basis, charity DGR/501(c)(3) status, energy DMO/VDO reference figure, APVMA product registration) | Claim substantiation; turns "free/guaranteed" language into gated/blocked |
| **Compliance state**               | Charity: paid-solicitor **cleared-state list** + registration IDs; per-vertical code refs (ACNC/COC, CEC/Green Guides, ACL/APVMA, AER/FCC)                                      | **Delivery geo-clearance**; per-claim block rules                         |
| **Channel / accounts**             | Connected Meta/Google/TikTok ad accounts, pixel/CAPI dataset IDs, allowed placements                                                                                            | Where assets may be delivered; audience destinations                      |
| **Loop position**                  | Current stage(s) active for this campaign; prior-stage outputs (knocked-not-converted set handle, retarget audiences)                                                           | Stage selection; retarget seeding; attribution close-out                  |

### 2.2 Hub guarantees (enforced, not advisory)

- **Snapshot is frozen + hashed.** `context_ref = blake3(snapshot)`; recorded in the hash-chained audit. Spokes embed `context_ref` in every run-record and every asset's provenance manifest.
- **Refuse-on-stale.** If `legal_hold = true`, `kill_switch = true`, or `budget_remaining ≤ 0`, the hub returns a **refusal context** — spokes that receive it must hard-stop and emit a governance event. No partial generation.
- **PII never leaves region.** The hub resolves the region pin once; audience-building skills receive only **hashed, region-local** identifiers (SHA-256 of normalized email/phone), never raw PII, and never a cross-region destination.
- **Cleared-state mask.** For charity, the hub attaches a delivery geo-mask = (territory ∩ cleared-solicitor states). Warm-the-area skills cannot target outside the mask; the gate blocks any creative whose delivery polygon escapes it.

---

## 3. The skill index — ~14 D2D campaign skills

Grouped by **loop stage**; each row notes the verticals it specializes for. All are slash-invocable and consult the hub first. Files live under `skills/<stage>/<name>.md`.

### Stage 1 — Warm-the-area (pre-knock geo-warming)

| #   | Skill (slash)            | Job                                                                                                                                                              | Vertical specialization                                                     | Key hard gates                                                                                                   |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `/geo-warm-ads`          | Generate the multi-platform warm-up ad set (copy + image/video) geofenced to the territory, timed to land **before** the walk-sheet window                       | All four; pulls vertical policy pack                                        | Solar free/$0-down block; charity cleared-state geo-mask; energy DMO/VDO ref; provenance-sign all media          |
| 2   | `/neighbor-proof`        | Build _local_ social-proof creative — "X households in [suburb] already…", neighborhood landmarks, crew-intro cards — to make the brand familiar before the door | Charity (community impact framing), Solar/Pest/Energy (local installs/jobs) | Charity **no "guaranteed impact"**; substantiate counts from offer-truth evidence; no fabricated testimonials    |
| 3   | `/territory-landing`     | Generate the territory-specific landing/QR microsite the warm ads point to (brand-locked, disclosure-complete, lead-capture wired to the tenant)                 | All four; injects required disclosures per vertical                         | DGR/501(c)(3) tax-deductibility disclosure; AER/FCC + DMO/VDO line; APVMA chemical-name line; pixel/CAPI consent |
| 4   | `/multilingual-localize` | Localize warm-up creative + disclosures for the territory's language mix (US ES, AU community languages, SG EN/ZH/MS/TA) without losing legal meaning            | All four                                                                    | Re-run brand-safety **per language**; disclosures must remain legally equivalent, not just translated            |

### Stage 2 — Retarget (re-engage non-converts after the knock)

| #   | Skill (slash)       | Job                                                                                                                                                                            | Vertical specialization              | Key hard gates                                                                                              |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 5   | `/knock-retarget`   | Turn the **knocked-not-converted** set into a hashed custom audience + matched re-engagement creative; on click, the lead returns **tagged** to the call centre                | All four                             | Hashed-only audiences (no raw PII, region-local); suppress do-not-contact; honor charity cleared-state mask |
| 6   | `/lookalike-expand` | Seed lookalike/expansion audiences from converters in **this** territory to warm the **next** adjacent area                                                                    | All four                             | Seed only from consented converters; no sensitive-trait targeting; region-pinned modeling                   |
| 7   | `/seasonal-rewarm`  | Re-warm a previously-worked territory on the right trigger (solar = post-bill-shock season; pest = pest-season onset; charity = appeal calendar; energy = DMO/VDO reset dates) | All four; trigger logic per vertical | Re-validate offer-truth + substantiation (figures may be stale); fresh provenance + gate pass               |

### Stage 3 — Convert-assist (help the field + call centre close)

| #   | Skill (slash)            | Job                                                                                                                                     | Vertical specialization               | Key hard gates                                                                                                         |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 8   | `/callcentre-script-kit` | Generate the inside-sales 7-day follow-up scripts, voicemail, SMS, and email matched to the warm creative the household already saw     | All four; claim language per vertical | No unsubstantiated claims in scripts; charity disclosure scripted; SMS consent + opt-out; quiet-hours/state rules      |
| 9   | `/doorstep-leavebehind`  | Generate the printed/digital door-hanger + leave-behind QR card the field team carries, brand-locked and disclosure-complete            | All four                              | Same disclosure set as landing; APVMA chemical-name on pest leave-behinds; provenance on printed artwork               |
| 10  | `/objection-microcopy`   | Produce vertical objection→response microcopy (price, trust, "is this a scam", "is my donation tax-deductible") for field + call-centre | All four                              | Responses cite only substantiated facts; no pressure/deception patterns; charity tax-deductibility answered accurately |

### Stage 4 — Measure (close the loop, feed the next area)

| #   | Skill (slash)       | Job                                                                                                                                       | Vertical specialization                                  | Key hard gates                                                                                     |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 11  | `/campaign-readout` | Generate the per-territory stakeholder readout: warm-spend → knock-acceptance lift → call-centre conversion → commission, brand-clean     | All four; vertical-appropriate KPIs (donations vs sales) | Stands alone, current facts only (no changelog); money as BigInt cents; no PII in shareable output |
| 12  | `/territory-attrib` | Compile the attribution model (which warm assets lifted which doors) into the **training signal** the next area's `geo-warm-ads` consults | All four                                                 | Aggregate/hashed only; region-local; immutable attribution record                                  |
| 13  | `/lift-experiment`  | Design + read the geo-holdout experiment (warmed vs control blocks) to prove warming caused the lift, not coincidence                     | All four                                                 | Pre-registered holdout; no peeking-driven claims; results feed offer-truth honestly                |

### Cross-cutting (rails — every spoke calls these; not standalone campaigns)

| #   | Skill (slash)                            | Job                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | `/vertical-policy-pack`                  | The single resolver that, given the vertical, returns the exact hard-gate rule set (charity \| solar \| pest \| energy_telco). `brand-safety-gate` loads it; spokes never hard-code rules. _(Counts as the 14th library skill; it is the compliance brain the others share.)_ |
| —   | `/brand-safety-gate`                     | The mandatory pre-publish checker every generation step calls. Loads the vertical policy pack + brand block; **blocks** on any violation. (Rail, always present.)                                                                                                             |
| —   | `/provenance-sign`                       | C2PA-signs every media asset and stamps content credentials + hash on every copy asset; **no manifest → no publish**. (Rail.)                                                                                                                                                 |
| —   | `/legal-hold-check` + `/budget-governor` | Refuse generation/delivery under legal hold, kill-switch, or exhausted AI budget cap. (Rails; mirror the hub's refuse-on-stale.)                                                                                                                                              |

> **Why ~14 and not 44:** the reference library's generic skills (cold-email, generic SEO, popups, pricing) are **commodity** for D2D. The library is deliberately small and **vertical + door-to-door + compliance-gated**, which is D2D's defensible edge.

---

## 4. The standard skill-file shape

Every spoke is a single Markdown file with the **same seven-section contract**. The orchestrator and the gates rely on these sections being present and machine-readable (front-matter + fixed headings). Below is the canonical template, then a worked example.

### 4.1 Canonical template

```markdown
---
name: geo-warm-ads
slug: /geo-warm-ads
stage: warm-the-area # warm-the-area | retarget | convert-assist | measure
verticals: [charity, solar, pest, energy_telco]
requires_context: true # MUST load campaign-context first
emits: [ad_copy, ad_image, ad_video, audience_geo]
governed: true # agent-governance + audit-log always on
---

## Trigger

Slash: `/geo-warm-ads`. Natural language: "warm up <territory> before the <vertical> push",
"pre-warm <suburb/ZIP>", "geo ads to soften the area for the knock".

## Inputs (from the frozen context_ref + call args)

- context_ref (REQUIRED — refuse if missing/stale/refusal-context)
- territory polygon/ZIP/SA2 + walk-sheet window
- vertical + offer-truth + substantiation evidence refs
- brand block (locked assets, voice, banned phrases, required disclaimers)
- channel accounts + allowed placements + budget_remaining
- prior-area attribution carry-in (optional)

## Brand-safety gates (HARD — block publish)

- Call /vertical-policy-pack(vertical) -> rule set.
- Run /brand-safety-gate on EVERY generated variant BEFORE it is publish-eligible.
- Vertical specifics (examples): solar -> block "free solar"/"$0 down" w/o finance terms,
  substantiate savings; charity -> block "guaranteed impact", enforce DGR/501(c)(3)
  disclosure + cleared-state geo-mask; pest -> block health claims, require APVMA
  chemical-name; energy/telco -> block locked price-comparison w/o DMO/VDO reference.
- Region pin honored; PII hashed/region-local only.

## Generation steps

1. Load context_ref; if refusal-context -> STOP + emit governance event.
2. Resolve vertical policy pack + brand block.
3. Draft copy variants (Claude/GPT) within voice + banned-phrase guardrails.
4. Generate media (FLUX/Ideogram image; Runway/HeyGen video) pinned to brand assets.
5. Geo-bound the audience to (territory ∩ cleared/eligible mask); set walk-sheet timing.
6. Gate: /brand-safety-gate on each variant -> drop/repair violators.
7. Provenance: /provenance-sign every surviving asset (C2PA + hash).
8. Budget: /budget-governor reserves spend; refuse if cap exceeded.
9. Hand publish-eligible bundle back to /campaign-compose (idempotent POST).

## Outputs

- Publish-eligible asset bundle: {copy[], media[] (C2PA-signed), audience_geo,
  schedule}, each carrying context_ref + provenance manifest + gate verdict.
- Audit record (hash-chained): inputs digest, variants, gate results, costs (BigInt cents).

## Related Skills

- Upstream: /campaign-context (hub), /campaign-compose (orchestrator)
- Rails: /vertical-policy-pack, /brand-safety-gate, /provenance-sign, /budget-governor
- Next stage: /knock-retarget (consumes knocked-not-converted), /territory-landing (destination)
- Measure: /territory-attrib (this run becomes next area's training signal)
```

### 4.2 Section semantics (the contract the system enforces)

- **Trigger** — both slash and ≥3 natural-language phrasings, so the router resolves intent either way.
- **Inputs** — must name `context_ref` as REQUIRED. A spoke with `requires_context: true` that runs without a valid ref is rejected by the orchestrator and logged as a governance violation.
- **Brand-safety gates** — names the **hard** blocks and always delegates the rule set to `/vertical-policy-pack` (no hard-coded compliance — one place to update law).
- **Generation steps** — numbered, deterministic, gate-and-provenance steps explicit and non-skippable; Step 1 is always "load context or refuse."
- **Outputs** — every asset carries `{context_ref, provenance_manifest, gate_verdict}`; money is BigInt cents; an immutable audit record is emitted.
- **Related Skills** — the cross-reference graph (upstream hub, rails, next-stage, measure) that lets the orchestrator chain without hard-coding the DAG.

---

## 5. The orchestrator — `/campaign-compose` (selection + chaining)

**File:** `skills/_orchestrator/campaign-compose.md`
**Role:** The only component that turns a **campaign brief** into a **published, attributed loop**. It selects spokes, chains them across stages, runs independent work in parallel, and is the **sole writer** of the publish-eligible bundle. It never bypasses a rail.

Patterns adapted (with fintech security) from `NousResearch/hermes-agent`: a **skill-curation loop** (post-campaign, propose refinements to spokes as procedural memory), **subagent parallelization** (independent spokes run as isolated, governed sub-dispatches), **context compression** (summarize long attribution history into the next area's seed), and **tool-approval allowlists reframed as agent governance** (every dispatch is allow-listed, audit-logged, and constitutionally checked for high-stakes output).

### 5.1 Selection logic

1. **Freeze context.** Call `/campaign-context` → `context_ref`. If refusal-context (hold / kill-switch / no budget) → stop, surface reason, log.
2. **Resolve stages.** From the brief's intent + `loop position`, pick the active stage set:
   - New territory, pre-knock → **Warm-the-area** (`geo-warm-ads`, `neighbor-proof`, `territory-landing`, `multilingual-localize` if multilingual).
   - Post-knock, non-converts exist → **Retarget** (`knock-retarget`, then `lookalike-expand` to seed the next area).
   - Field/call-centre active → **Convert-assist** (`callcentre-script-kit`, `doorstep-leavebehind`, `objection-microcopy`).
   - Campaign closing → **Measure** (`campaign-readout`, `territory-attrib`, `lift-experiment`).
3. **Filter by vertical.** Keep only spokes whose `verticals` include the campaign vertical; bind the matching `/vertical-policy-pack`.
4. **Walk the `Related Skills` graph.** Use each selected spoke's cross-references to pull required upstream/rail/next-stage skills — the DAG is **derived from the files**, not hard-coded.

### 5.2 Chaining + execution

```
freeze context_ref
  └─ Warm-the-area  ── parallel ──▶ {geo-warm-ads, neighbor-proof, territory-landing}
                                      (multilingual-localize fans out per language)
        every asset ▶ brand-safety-gate ▶ provenance-sign ▶ budget-governor
  ── after walk-sheet window + knock data ──▶
     Retarget ── {knock-retarget (seed: knocked-not-converted, hashed)} ──▶ lookalike-expand (seeds NEXT area)
  ── call-centre 7-day window ──▶
     Convert-assist ── {callcentre-script-kit, doorstep-leavebehind, objection-microcopy}
  ── campaign close ──▶
     Measure ── {campaign-readout, territory-attrib ▶ feeds next area's geo-warm-ads, lift-experiment}
```

- **Parallel where independent:** within a stage, spokes with no data dependency are dispatched as **isolated, governed sub-agents**; results reconcile before the gate batch.
- **Sequential where the loop demands it:** Retarget waits on real knock outcomes; Measure waits on conversions. The orchestrator gates stage transitions on **real loop events**, not timers alone.
- **Idempotent + handoff-typed:** each stage hands the next a structured artifact (e.g. `audience_geo`, `knocked_not_converted_handle`, `attribution_signal`) via an idempotent POST keyed on `(campaign_id, stage, context_ref)` — re-runs don't double-spend or double-publish.
- **Closed loop:** `territory-attrib` output is written as the **seed** the next area's `geo-warm-ads` consults — the system literally trains the next territory on the last one.
- **Governance on every dispatch:** each sub-dispatch is audit-logged (`agent-audit-log`), governance-checked (`agent-governance`), and — for high-stakes output (claims, charity solicitation copy) — passed through `constitutional-critique` before it can become publish-eligible.

### 5.3 Refusal & escalation

The orchestrator **stops the whole chain** (not just the spoke) if any of: legal hold, kill-switch, budget cap hit, a gate that cannot be satisfied (e.g. charity territory has **zero** cleared states), or a stale `context_ref` that re-freezes into a refusal-context. It surfaces a human punch-list (the things only Brodie/the client can resolve — registration, substantiation evidence, finance terms) and logs the stop immutably.

---

## 6. The publish pipeline — brand-safety + C2PA provenance (mandatory)

**No asset reaches a delivery API (Meta/Google/TikTok via `services/marketing`) until it clears every gate below.** The gates are the same rails every spoke calls inline; the orchestrator runs them again as a **final batch** before publish — defense in depth.

```
generated asset
  │
  ├─▶ [1] /legal-hold-check + /budget-governor
  │       hold? kill-switch? cap exceeded?  ── any yes ─▶ BLOCK + governance event
  │
  ├─▶ [2] /vertical-policy-pack(vertical)  → load exact hard-gate rules
  │
  ├─▶ [3] /brand-safety-gate
  │       • brand: locked logo/voice/banned-phrase conformance vs brand block hash
  │       • claims: every offer claim has substantiation evidence in offer-truth
  │       • vertical hard blocks:
  │           charity   → no "guaranteed impact"; DGR/501(c)(3) disclosure present;
  │                       delivery polygon ⊆ cleared-solicitor states
  │           solar     → no "free solar"/"$0 down" w/o finance terms; savings substantiated
  │           pest      → no health claims; APVMA chemical-name present (AU)
  │           energy/telco → no locked price-comparison w/o DMO/VDO reference figure
  │       • region: delivery + audience region == tenant pin; PII hashed/region-local
  │       ── any violation ─▶ BLOCK (drop or route to /…-repair) + immutable verdict
  │
  ├─▶ [4] /provenance-sign  (C2PA)
  │       • media: embed C2PA manifest — generator (FLUX/Ideogram/Runway/HeyGen),
  │         prompt digest, brand-asset hash, context_ref, org_id, region, timestamp;
  │         sign with the tenant's provenance key
  │       • copy: attach content-credential record + blake3 hash bound to context_ref
  │       ── no valid manifest ─▶ BLOCK (cannot publish unsigned)
  │
  ├─▶ [5] immutable audit append (hash-chained)
  │       inputs digest · all variants · gate verdicts · provenance manifest ids ·
  │       costs (BigInt cents) · dispatch governance record
  │
  └─▶ [6] PUBLISH  (idempotent POST to delivery API; key = asset_hash + context_ref)
          delivered geo-bounded to (territory ∩ eligible/cleared mask)
```

**Guarantees this pipeline gives Brodie (the solo operator) and the client:**

- **A blocked claim can never go live** — the gate sits _before_ the delivery API, and the policy pack is the single place law is encoded (update once, applies everywhere).
- **Every live asset is provenance-traceable** — given any delivered ad, the C2PA manifest + audit chain reconstruct _who/what/which model/which context/which evidence_ produced it. This is the creative analogue of the immutable money ledger.
- **PII never leaves its region; audiences are hashed** — the hub resolves the pin once; gates re-verify at publish.
- **Charity solicitation respects the law** — delivery is masked to cleared states; an uncleared territory simply cannot be warmed, and the orchestrator escalates that as a human punch-list item rather than silently shipping.
- **It's auditable end-to-end** — hash-chained audit + per-dispatch governance records mean the whole loop (warm → knock → retarget → convert → commission) is defensible in a regulator or platform review.

---

## 7. File-tree summary

```
services/content-studio/skills/
├── _hub/
│   └── campaign-context.md            # THE HUB — load first, freezes context_ref
├── _orchestrator/
│   └── campaign-compose.md            # selects + chains spokes, sole bundle writer
├── _rails/                            # mandatory, called inline by every spoke
│   ├── vertical-policy-pack.md        # (#14) the shared compliance brain
│   ├── brand-safety-gate.md           # hard publish-blocker
│   ├── provenance-sign.md             # C2PA + content credentials
│   ├── legal-hold-check.md
│   └── budget-governor.md
├── warm-the-area/
│   ├── geo-warm-ads.md                # (#1)
│   ├── neighbor-proof.md              # (#2)
│   ├── territory-landing.md           # (#3)
│   └── multilingual-localize.md       # (#4)
├── retarget/
│   ├── knock-retarget.md              # (#5)
│   ├── lookalike-expand.md            # (#6)
│   └── seasonal-rewarm.md             # (#7)
├── convert-assist/
│   ├── callcentre-script-kit.md       # (#8)
│   ├── doorstep-leavebehind.md        # (#9)
│   └── objection-microcopy.md         # (#10)
└── measure/
    ├── campaign-readout.md            # (#11)
    ├── territory-attrib.md            # (#12)
    └── lift-experiment.md             # (#13)
```

**Invocation, in one line:** a user (or the field-ops planner) types `/campaign-compose warm Mesa-AZ for the solar push` → the orchestrator freezes `campaign-context` → selects Warm-the-area spokes filtered to `solar` → each generates under the solar policy pack → every asset clears brand-safety + C2PA + budget → publishes geo-bounded ads that soften the neighborhood **before** the crew knocks — and the resulting attribution becomes the seed that warms the next territory.
