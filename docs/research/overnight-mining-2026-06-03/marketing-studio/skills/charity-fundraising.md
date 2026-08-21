# D2D Marketing Studio — Charity Fundraising: Geo-Warm Campaign

```yaml
---
name: campaign-charity-geowarm
description: >
  Generate a GEO-TARGETED "warm the area" campaign for the CHARITY FUNDRAISING
  vertical that softens a specific territory BEFORE the field team knocks, then
  feeds The Loop. Use when a charity client hands D2D a territory and the field +
  call-centre teams are about to run it. Produces compliance-gated ad creative
  (Meta/Google/TikTok), a landing-page hook, retargeting audiences for
  knocked-not-converted households, and attribution wiring that trains the next
  area's targeting. Invoke via /campaign-charity-geowarm or natural language
  ("warm up the Tucson territory for the children's hospital appeal").
slash: /campaign-charity-geowarm
vertical: charity-fundraising
loop_stage: MARKET (pre-knock) + RETARGET (post-knock)
service: services/marketing + services/content-studio
regions: [US, AU, SG]
governance: always-on # every agent dispatch audit-logged + governance-checked
hard_gates: publish-blocking # see COMPLIANCE GATES — fail = no delivery
provenance: C2PA-required # all generated image/video signed
related:
  - campaign-context # FOUNDATIONAL — read first, every time
  - retarget-knocked-not-converted
  - attribution-loopback
  - paid-delivery-meta-google-tiktok
  - creative-studio-flux-runway
  - agent-governance
  - agent-audit-log
  - constitutional-critique
---
```

## 1. Purpose & The Loop position

This skill owns the **MARKET** stage of The Loop for charity fundraising, and seeds the **RETARGET** stage.

```
[ MARKET ] -> KNOCK -> CALL CENTRE -> RETARGET -> CONVERT(donation) -> COMMISSION
   ^you                                  ^you seed it                      |
   |________________ attribution trains the NEXT area's targeting _________|
```

The campaign runs **3–10 days ahead** of the field team's first knock in a defined territory so that when the canvasser introduces "[Charity] — you may have seen us around the neighbourhood," there is genuine prior exposure: a warmer door, a shorter pitch, a higher pledge-conversion rate. It is **brand-lift + recall infrastructure**, not a direct-response donation funnel — though it captures the warm online givers too, and tags every household it touches so the call centre and retargeting layer can re-engage non-converts.

Charity is the **highest-scrutiny** D2D vertical. Solicitation is regulated at the state/jurisdiction level, tax-deductibility is a legal representation, and "guaranteed impact" language is the single fastest way to a regulator complaint. The compliance gates below are **hard**: a campaign that fails them does not publish — the orchestrator returns the failing artifact for revision rather than delivering it.

## 2. Trigger & when-to-use

**Invoke when ALL of these hold:**

- A charity client has handed D2D a **territory** (polygon, ZIP/postcode set, or radius) and a knock **start date**.
- The org tenant has a verified **charity registration record** on file (see required inputs) for every jurisdiction the territory touches.
- The client wants the neighbourhood **pre-warmed** (brand lift) and/or wants **retargeting** of households the field team reaches.

**Slash:** `/campaign-charity-geowarm --territory=<id> --knock-date=<ISO> [--objective=brand-lift|warm-plus-online|retarget-only]`

**Natural language:** "Warm up the 85718 territory for the children's hospital before Thursday's knock," "Build the pre-knock ads for the surf-rescue appeal in Cronulla."

**Do NOT use for:** commercial verticals (use the solar/pest/energy/telco skills — different gates); national/un-geofenced brand campaigns (this skill is territory-scoped by design); pure email/SMS donor reactivation of an EXISTING donor file (that's a CRM journey, not a geo-warm).

**Stop and escalate (do not generate) if:**

- Registration is **missing, lapsed, or pending** for any jurisdiction the territory touches.
- The charity is a **paid solicitor / commercial co-venturer** engagement and the required **state clearances** are not on file for the delivery states.
- The offer copy the client supplied contains **outcome guarantees** or **unsubstantiated efficiency ratios** that the client refuses to amend.

## 3. Required inputs

The orchestrator refuses to proceed until every input below is present and validated. Missing → block with a precise "need this field" message, not a silent default.

### 3.1 Territory

| Field                       | Type                         | Notes                                                                                                         |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `territory_id`              | string                       | D2D internal id; maps to the field route.                                                                     |
| `geometry`                  | polygon \| zip_set \| radius | The geofence. Stored region-pinned.                                                                           |
| `jurisdictions`             | string[]                     | Derived from geometry: ISO country + state/territory codes the polygon intersects. Drives the clearance gate. |
| `knock_start` / `knock_end` | ISO date                     | Field window. Ads launch `knock_start − lead_days`.                                                           |
| `lead_days`                 | int (default 5)              | How far ahead to warm.                                                                                        |
| `population_estimate`       | int                          | For reach/frequency planning + budget sanity.                                                                 |

### 3.2 Demographics & signals

- Census/área profile: age bands, household income bands, language(s), homeownership, household composition.
- **Cause-affinity signals** (interest proxies only — never inferred protected-class targeting): e.g., "pet ownership" for an animal shelter, "youth sports" for a children's charity, "outdoor/coastal" for surf rescue.
- Prior-area learnings (from `attribution-loopback`): which angles/creatives/audiences converted in demographically-similar adjacent territories.
- **Exclusions:** suppression list (existing donors if client wants net-new only; prior opt-outs; DNC where applicable).

### 3.3 Brand kit (client-supplied, tenant-scoped)

- Registered charity legal name + trading name; logo lockups (light/dark); **EazePay-navy-compatible** palette OR client palette; typefaces (default Inter / JetBrains Mono if none).
- **Registration identifiers:** ABN + ACNC status + DGR endorsement (AU); EIN + 501(c)(3) determination + state charity registration numbers (US); UEN + COC (SG).
- Approved spokesperson/beneficiary imagery with **signed model/usage releases** (critical — see gates; beneficiary consent is itself a compliance artifact).
- Tone guide; words the charity will/won't use; any prior regulator correspondence flags.

### 3.4 Offer

- Ask type: **recurring** (monthly pledge) and/or **one-off**.
- Suggested amounts / ask ladder; what the money funds (program description, **factually stated**).
- **Tax-deductibility status** of the gift (DGR / 501(c)(3) deductible vs non-deductible) — drives the required disclosure string.
- Fundraising mechanism if paid solicitor: who solicits, the disclosure that a paid fundraiser is involved, and the **cleared states** list.
- Landing destination (client domain or D2D-hosted tenant page) + pledge/payment processor.

## 4. COMPLIANCE / BRAND-SAFETY GATES (hard, publish-blocking)

Every generated artifact (each ad headline, primary text, image, video, landing hook, retargeting copy) passes through the gate chain **before** it can be queued for delivery. The chain runs as a governed agent dispatch: **audit-logged**, **governance-checked**, and for any artifact that makes a factual/impact claim, a **constitutional-critique** pass. A single FAIL blocks the whole artifact; a gate cannot be overridden inside this skill (override requires a logged human compliance sign-off at the tenant level, out of scope here).

### Gate 0 — Registration & jurisdiction clearance (delivery scoping)

- **HARD BLOCK** if any `jurisdiction` in the territory lacks a current, verified registration record:
  - AU: **ACNC** registered + (if claiming deductibility) **DGR**-endorsed.
  - US: **state charitable solicitation registration** in EACH state the territory touches (≈40 states require it) — _and_ if a **paid solicitor / professional fundraiser**, the **state clearance/bond/contract-filing** for that solicitor in that state.
  - SG: **COC** (Commissioner of Charities) / registered charity or IPC status as applicable.
- **Delivery is geo-fenced to cleared jurisdictions only.** If the territory polygon spills into an uncleared state/postcode, the delivery audience is **clipped** to cleared geography and the clip is logged. Uncleared spill is never delivered "just a little."
- Paid-solicitor campaigns: delivery allowlist = intersection(territory, solicitor-cleared states). Empty intersection → block.

### Gate 1 — Prohibited claims blocklist (BLOCK on match)

Match is case-insensitive, lemma-aware, and includes obvious paraphrases. Any hit fails the artifact.

- **"Guaranteed impact" family** — BLOCK: "guaranteed," "we guarantee," "your donation will save," "will cure," "ends [hunger/homelessness/cancer]," "100% goes to," "every dollar saves a life," "guaranteed to help," "promise to fix." Charitable outcomes are aspirational, never guaranteed.
- **Deceptive efficiency / overhead** — BLOCK unverifiable ratios: "100% to the cause," "$X feeds a child for a year," "every cent," "zero overhead," "no admin costs" — _unless_ the exact figure is client-substantiated AND carries the program-cost basis; default behaviour is to BLOCK and rewrite to qualified language ("helps fund," "supports," "contributes to").
- **Tax / financial misstatement** — BLOCK: "tax-free," "get your money back," "the government pays," "fully refundable," or any deductibility claim when the gift is **not** DGR/501(c)(3)-deductible.
- **Urgency/coercion & false scarcity** — BLOCK: "last chance to save them," "they'll die without you today," "only [n] left to be rescued," manufactured countdowns tied to beneficiary harm.
- **Vulnerable-audience & protected-class targeting** — BLOCK any audience spec that targets or excludes by protected attributes, or that uses "financial hardship"/age-vulnerability proxies to find easy-to-pressure donors. Cause-affinity interest targeting only.
- **Misrepresentation of relationship** — BLOCK: implying government endorsement, implying the donation is a bill/tax, or implying the field team are volunteers if they are paid solicitors.
- **Beneficiary dignity** — BLOCK exploitative "poverty-porn" framing flagged by the creative critic (identifiable suffering minors without consent, dehumanising depiction).

### Gate 2 — Required disclosures (BLOCK if absent)

The artifact must carry the applicable disclosures **legibly** (ad: in primary text or pinned; landing page: above the fold or one click via persistent footer; video: on-screen ≥3s + caption). Generation **injects** these from the brand kit; the gate verifies presence + correctness.

- **Charity identity:** registered legal name + jurisdiction id where required (ABN/EIN/UEN; registration #).
- **Tax-deductibility:** if DGR/501(c)(3)-deductible → the exact deductibility statement ("Donations of $2 or more are tax-deductible in Australia" / "[Org] is a 501(c)(3); contributions are tax-deductible to the extent allowed by law"). If **NOT** deductible → an explicit non-deductibility statement; silence is a FAIL.
- **Paid-solicitor disclosure** (where a professional fundraiser solicits and/or the state mandates it): the state-specific "a portion of your donation may be retained by a professional fundraiser" / financial-disclosure-available statement, plus any state-mandated registration line.
- **State registration disclosures:** states that mandate a specific solicitation-disclosure sentence (e.g., a "registration does not imply endorsement" line) must have that exact sentence present for delivery into that state.
- **Recurring-gift terms:** if the ask is monthly, disclose it's recurring, the amount, the cadence, and how to cancel.
- **Provenance:** all AI-generated imagery/video carries **C2PA** content credentials; synthetic or composited beneficiary imagery is labelled and must have releases. Missing C2PA signature → FAIL.

### Gate 3 — Substantiation & governance

- Every **factual** claim (programs, numbers, beneficiary stories) must trace to a client-provided source in the brand kit; unsourced facts FAIL.
- **constitutional-critique** runs on any impact/efficacy statement; flagged → revise or drop.
- **Legal hold:** if the org/territory is under legal hold, generation is read-only and delivery is blocked.
- **PII / region:** audience PII (for custom/lookalike + retargeting) is hashed client-side and **never leaves its region** (US/AU/SG pinned). Cross-region delivery of a region's PII → FAIL.
- **Platform policy:** flag against Meta/Google/TikTok social-issue/fundraising ad policies (e.g., Meta special-category & fundraiser rules, Google ad policies for charities) — non-compliant placements are dropped from the plan.

> **Gate outcome contract:** each artifact returns `{ gate: PASS | FAIL, failed_rule?: string, evidence?: string }`. The compose orchestrator delivers ONLY the PASS set, writes the full PASS+FAIL ledger to `agent-audit-log`, and surfaces FAILs with reasons for human review.

## 5. Generation steps

Run as a governed, parallelized compose (builder + creative + compliance-critic subagents; every dispatch audit-logged; allowlisted tools only). Order:

**Step 1 — Load context (mandatory first).** Pull `campaign-context` for this org: positioning, voice, prior-area learnings, suppression lists, AI budget cap. Do not generate before this loads.

**Step 2 — Resolve jurisdiction clearance (Gate 0).** Intersect territory geometry with cleared jurisdictions (and solicitor-cleared states if paid-solicitor). Produce the **delivery geofence** = cleared ∩ territory. If empty → stop. Record the clip.

**Step 3 — Audience build (geo + affinity + lookalike across Meta / Google / TikTok).**

- **Geo core:** the delivery geofence (polygon/radius/ZIP/postcode), de-duped, suppression-applied. This is the spine — the field route, mirrored online.
- **Affinity overlay:** cause-relevant interests/behaviours (Step 3 inputs) — no protected-class, no hardship proxies.
- **Lookalike/seed:** seed from prior-area **converted donors** in demographically-similar territories (hashed, region-pinned) → 1–3% lookalike clamped to the geofence. Meta: Custom Audience seed → LAL ∩ geo. Google: Customer Match seed → similar-segments + radius. TikTok: Lookalike from hashed seed ∩ geo.
- **Frequency plan:** target ~3–6 impressions/household across the lead window (recall, not fatigue).
- **Reserve a control/holdout slice** of the geofence (no ads) so brand-lift on knock-conversion is measurable.

**Step 4 — Ad copy angles.** Generate 3–4 on-brand angles, each qualified (no Gate-1 language), each carrying injected disclosures:

1. **Neighbourhood / local-proof** — "[Charity] is in [Town] this week." Builds the "you may have seen us" recall the canvasser leans on.
2. **Mission-story** — a true, sourced beneficiary outcome, dignity-preserving, past-tense ("helped fund," not "will save").
3. **Recurring-supporter** — frames the monthly pledge as ongoing community membership; recurring terms disclosed.
4. **Trust / transparency** — registered-charity identity, deductibility, where money goes (qualified) — pre-empts the doorstep skepticism objection.

**Step 5 — Creative direction (image/video; FLUX/Ideogram + Runway/HeyGen; C2PA-signed).**

- **Image:** authentic local/community texture; real-feeling not stocky; brand lockup + disclosure-safe area; navy/Inter system unless client palette. No identifiable suffering minors without releases. C2PA on every asset.
- **Video (6–15s):** hook in 2s ("Your neighbourhood, this week"), mission in the middle, ask + disclosures on-screen ≥3s + open-caption. HeyGen avatar only with disclosed synthetic labelling; Runby b-roll labelled AI-generated via C2PA.
- All imagery of beneficiaries requires **signed releases** on file (gate-checked).

**Step 6 — Landing-page hook.** A territory-aware page (D2D tenant or client domain): headline mirrors the winning angle; one true mission paragraph; the **ask ladder** (recurring + one-off); **disclosures above the fold or persistent footer** (deductibility, registration, paid-solicitor if applicable, recurring terms); pledge/payment via the client processor; pixel/tag for retargeting; **idempotent** pledge POST; money handled as **BigInt cents**. The canvasser and call centre can reference the same page (consistent claims everywhere).

**Step 7 — Retargeting audience (knocked-not-converted).** Define the audience the field team will _feed_: households **knocked but not converted** are exported from the field app as a **hashed custom audience** (region-pinned), tagged `knocked_no_convert`, suppressed from the cold geo audience, and enrolled in a **soft re-engagement** sequence (trust/transparency + recurring-supporter angles — never the urgency family). A re-engaged click **returns as a tagged lead** to the call centre with full context ("warmed → knocked → clicked retargeting → call"). All copy re-passes Gates 1–3. See `retarget-knocked-not-converted`.

**Step 8 — Gate everything, then assemble.** Run every artifact through Gates 0–3. Deliver only the PASS set to `paid-delivery-meta-google-tiktok`, geofenced to the cleared delivery audience, within budget cap. Write the PASS+FAIL ledger to `agent-audit-log`.

## 6. Example ad variants

### PASS (deliverable)

**A — Neighbourhood / local-proof (Meta feed, AU DGR charity)**

- **Headline:** Coastal Rescue is in Cronulla this week
- **Primary text:** Our volunteer crews keep this stretch of coast safe year-round. Over the next few days you might see our team around the neighbourhood — we'd love your support to help fund rescue training and equipment. Coastal Rescue Australia Ltd (ABN 00 000 000 000) is an ACNC-registered charity. Donations of $2 or more are tax-deductible in Australia.
- **CTA:** Learn more
- _Why it passes:_ local recall + qualified "help fund," no guarantee, identity + deductibility disclosed, dignity intact.

**B — Trust / transparency (Google Display, US 501(c)(3))**

- **Headline:** Where your gift goes — Riverside Children's Fund
- **Primary text:** We support meals, tutoring, and after-school programs for kids across Riverside County. You may meet a member of our team in your neighbourhood this week. Riverside Children's Fund is a registered 501(c)(3) (EIN 00-0000000); contributions are tax-deductible to the extent allowed by law.
- **CTA:** See our programs
- _Why it passes:_ qualified program description, identity + deductibility disclosed, no overhead/efficiency claim, no urgency.

**C — Recurring-supporter (TikTok in-feed, AU)**

- **Headline:** Become a monthly mate of the shelter
- **Primary text:** A monthly gift helps fund food and care for rescue animals in your area. Join as a recurring supporter from $15/month — cancel anytime. Paws Haven (ABN 00 000 000 000), an ACNC-registered charity with DGR status; gifts of $2+ are tax-deductible.
- **CTA:** Become a supporter
- _Why it passes:_ recurring terms (amount/cadence/cancel) + identity + deductibility disclosed, "helps fund" qualified.

**D — Paid-solicitor, cleared-state (Meta, US professional fundraiser)**

- **Headline:** Supporting veterans across the state
- **Primary text:** Your gift helps fund counselling and housing-assistance programs for local veterans. [Charity] is a registered 501(c)(3) (EIN 00-0000000); contributions are tax-deductible to the extent allowed by law. Solicitations are conducted by [Fundraiser], a paid professional fundraiser; a portion of each donation is retained by the fundraiser. Financial disclosure information is available on request.
- **CTA:** Learn more
- _Why it passes:_ paid-solicitor + financial-disclosure language present; delivery geofenced to states where this solicitor is cleared.

### FAIL (blocked — do not deliver)

**E — FAIL (guaranteed impact + false efficiency)**

- **Headline:** $30 guarantees a hot meal for a child tonight — 100% goes to the cause
- _Failed rule:_ Gate 1 — "guarantees" (outcome guarantee) + "100% goes to the cause" (unverifiable efficiency). Rewrite to "Your $30 gift helps fund meals for local children" and drop the overhead claim unless client-substantiated with cost basis.

**F — FAIL (missing deductibility disclosure + coercion + no identity)**

- **Headline:** They'll go hungry tonight unless you act now — last chance
- **Primary text:** Don't let them suffer. Donate immediately.
- _Failed rules:_ Gate 1 — coercive/false-urgency framing tied to beneficiary harm; Gate 2 — no charity identity, no tax-deductibility statement, no registration id. Blocked on multiple counts.

## 7. Outputs & loopback

**Delivered artifacts (PASS set only):**

- Geofenced campaign live on Meta/Google/TikTok, clipped to cleared jurisdictions, with control/holdout slice.
- Territory landing page (idempotent pledges, BigInt cents, retargeting pixel).
- Retargeting custom-audience definition for `knocked_no_convert` + soft re-engagement sequence.
- **Audit bundle:** hash-chained ledger of every artifact's gate result (PASS+FAIL), disclosures injected, delivery geofence + clip log, C2PA manifests, agent-dispatch governance records.

**How results feed attribution (`attribution-loopback`):**

- **Pre-warm lift:** compare door-conversion in warmed cells vs the holdout → quantified brand-lift per territory.
- **Online conversions:** pledges via the landing page tagged to angle/creative/audience/placement.
- **Knock-to-call-to-retarget chain:** each household carries its journey state (warmed → knocked → no-convert → retargeted → clicked → call-centre lead → converted), money as BigInt cents, attributed to source.
- **Commission:** converts (door, phone, online) tie back to field rep + campaign for `COMMISSION`.

**How it trains the NEXT area's targeting:**

- Winning **angles**, **creatives**, **audience definitions**, and **lift deltas** are written back to `campaign-context` as prior-area learnings, keyed by demographic profile.
- The next territory's audience build **seeds its lookalike** from this area's converted donors (hashed, region-pinned) and **down-weights** angles/creatives that failed to lift here.
- Gate FAIL patterns feed the blocklist tuning (recurring near-misses become explicit blocked phrases), so the studio gets _more_ compliant over time, not just faster.

## 8. Related skills

- **`campaign-context`** — FOUNDATIONAL; read first every run for positioning, voice, suppression, budget cap, prior-area learnings.
- **`retarget-knocked-not-converted`** — builds the hashed custom audience + soft re-engagement that returns non-converts as tagged call-centre leads.
- **`attribution-loopback`** — closes the loop; lift measurement + feeds the next area's targeting.
- **`paid-delivery-meta-google-tiktok`** — geofenced multi-platform delivery within budget cap.
- **`creative-studio-flux-runway`** — FLUX/Ideogram image + Runway/HeyGen video, C2PA-signed.
- **`agent-governance` / `agent-audit-log` / `constitutional-critique`** — the always-on governance, immutable audit, and high-stakes critique layer wrapping every dispatch.

---

The skill is complete and ready to save. Suggested path:

**`/Users/Brodie/d2d/services/marketing/skills/campaign-charity-geowarm.md`**

Key design decisions: charity treated as the highest-scrutiny vertical with publish-blocking gates organized as a 4-tier chain (Gate 0 jurisdiction clearance → Gate 1 prohibited-claims blocklist → Gate 2 required-disclosures → Gate 3 substantiation/governance), each artifact returning a `{gate, failed_rule, evidence}` contract so only the PASS set delivers while the full PASS+FAIL ledger hash-chains into the audit log. The skill is positioned on the MARKET + RETARGET stages of The Loop, seeds lookalikes from prior-area converted donors (hashed, region-pinned), reserves a holdout slice for brand-lift measurement against door-conversion, and writes winning angles/creatives back to `campaign-context` to train the next territory. The 6 examples are split 4 PASS / 2 FAIL with the FAILs citing exact failed rules (guaranteed-impact + false-efficiency; coercion + missing deductibility/identity).
