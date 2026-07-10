# energy-retail-warm-the-area

```yaml
---
name: energy-retail-warm-the-area
description: >
  Generate a GEO-TARGETED "warm the area" campaign for the ENERGY/GAS RETAIL
  SWITCHING vertical — softens a specific territory BEFORE the D2D field team
  knocks, then feeds the loop. HARD COMPLIANCE GATES block publish on locked
  price-comparison claims without DMO/VDO reference (AER Retail Code / AEMC,
  Energy Made Easy parity), FCC marketing rules (US), and AER/state
  marketing-of-energy obligations. Invoke via /energy-warm-area or natural
  language ("warm up [suburb/ZIP] for the gas switch crew", "geo campaign for
  energy switching in [territory]").
studio: services/marketing + services/content-studio
vertical: commercial-field-sales / energy-gas-retail
loop_stage: MARKET (pre-knock warming) + RETARGET (knocked-not-converted)
region_aware: true # US / AU / SG — PII never leaves region; gates swap per region
invocation: [slash:/energy-warm-area, natural-language]
foundational_dependency: product-marketing-context # ALWAYS load first
governance: agent-governance ALWAYS on; every dispatch audit-logged
---
```

## 1. Trigger + when to use

**Trigger this skill when** a client has handed D2D an energy/gas retail switching territory and the field crew is scheduled to knock within the next **3–10 days**, and the operator wants the neighborhood pre-warmed so doors open warmer and close rates lift.

Concrete triggers:

- "Warm up [suburb / ZIP / postcode] before the energy crew hits it Thursday."
- "/energy-warm-area territory=North Geelong brand=Lumina Energy offer=12%-off-reference."
- A new `territory` row lands in the tenant with `vertical=energy_gas_retail` and `knock_start_date` set.
- Re-warm request for a territory the crew already canvassed → **retargeting** branch (knocked-not-converted).

**Do NOT use this skill for:**

- Solar PV sales → use `solar-warm-the-area` (different code: CEC / FTC Green Guides, "free solar" block).
- Telecom/broadband → use `telco-warm-the-area` (FCC marketing + speed-claim substantiation).
- Charity → use `charity-warm-the-area` (ACNC/state solicitor clearance).
- Any campaign WITHOUT a defined territory + knock date — warming with no field follow-through breaks the loop and wastes AI budget; refuse and explain.

**Position in the loop:** this is the **MARKET** stage (pre-knock) and, on re-run, the **RETARGET** stage. It does NOT close. It hands warmed lookalike + geo audiences and tagged leads to KNOCK → CALL CENTRE → CONVERT.

---

## 2. Required inputs

Load `product-marketing-context` FIRST (hub-and-spoke). It supplies the client's positioning, ICP, voice, and prior-area attribution. Then collect:

| Input                     | Field                     | Required | Notes / validation                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Territory**             | `territory.geo`           | ✅       | Polygon, suburb/postcode (AU), or ZIP/DMA (US). Region pins data residency. `knock_start_date` mandatory. Crew size + planned doors/day for budget sizing.                                                                                                                                                              |
|                           | `territory.energy_market` | ✅       | AU: NEM region (NSW/QLD/SA/TAS/ACT) or VIC (VDO market); WA/NT excluded unless contestable. US: dereg state + utility (e.g., TX ERCOT REP, PA/OH/IL ARES). Drives WHICH reference price gate applies.                                                                                                                   |
| **Demographics**          | `demo.profile`            | ✅       | Dwelling type (owner/renter — renters can switch retailer, not poles/wires), median bill band, life-stage, language mix. Renter-heavy areas change copy + offer eligibility.                                                                                                                                            |
| **Brand kit**             | `brand.kit_id`            | ✅       | EazePay-DNA locked: navy palette, Inter + JetBrains Mono, logo lockups, legal entity name, retailer authorisation/licence number, complaints + EWON/state-ombudsman line. No glass, no aurora.                                                                                                                          |
| **Offer**                 | `offer.terms`             | ✅       | The actual plan: % or $ off **the reference price** (AU: DMO/VDO; the only legal frame), c/kWh + daily supply, contract term, exit fees, conditional discounts, benefit-period end date, guaranteed-discount vs conditional. US: rate type (fixed/variable), term, ETF, MSF, renewal terms. **No offer = no campaign.** |
| **Reference price basis** | `offer.reference`         | ✅ HARD  | AU NEM: DMO (Default Market Offer, AER-set, current period). VIC: VDO (Victorian Default Offer, ESC-set). Must be the CURRENT period figure for the correct distribution zone + consumption benchmark. US: relevant utility "price to compare"/PTC. This is the spine of every compliant comparison.                    |
| **Authorisation**         | `client.retailer_auth`    | ✅ HARD  | Proof the client is an authorised retailer (AU: AER retailer authorisation or exemption) / licensed supplier (US state PUC licence). Unauthorised → block all publish.                                                                                                                                                  |
| **Budget cap**            | `org.ai_budget_cents`     | ✅       | Per-org AI budget cap (BigInt cents). Generation + media spend draw down; hard stop at cap.                                                                                                                                                                                                                             |
| **Legal hold flag**       | `org.legal_hold`          | auto     | If set, creative is generation-frozen; gate blocks publish.                                                                                                                                                                                                                                                             |

If any ✅ field is missing, **stop and request it**. If any **HARD** field is missing or fails validation, the campaign cannot reach publish — emit a blocking error with the specific gate.

---

## 3. Brand-safety / compliance gates (HARD — block publish)

These run as an **automated gate pass** before ANY asset is delivered to Meta/Google/TikTok. The gate is **deny-by-default**: an asset publishes only if it clears every check. Every gate decision is written to the immutable hash-chained audit log with the asset hash, rule ID, verdict, and (on fail) the offending span. Governance runs a constitutional critique on every generated asset before the gate.

### 3.1 BLOCKLIST — phrases/claims that HARD-BLOCK publish

Detected via deterministic phrase match + LLM intent classification (both must pass). Any hit ⇒ asset quarantined, not published.

**Locked / unreferenced price-comparison (the core vertical gate):**

- ❌ Any **price, %, $, or "save"/"cheaper"/"lower" comparison that does NOT carry the DMO/VDO (AU) or price-to-compare (US) reference in the same creative.** This is the #1 block. "Save 30%" alone = FAIL. "Save up to 30% off the reference price (DMO)" with the basis = candidate PASS.
- ❌ "Cheapest energy" / "lowest prices in [area]" / "beat any rate" — unqualified superiority / comparative claims without substantiation.
- ❌ "Guaranteed savings" / "you WILL save $X" — savings depend on usage; no guaranteed-dollar claims. Conditional/up-to framing only, with basis.
- ❌ Comparison to a named competitor's price without a substantiated, dated, like-for-like basis (same distribution zone, same benchmark consumption, same period).
- ❌ Stating a discount **without** disclosing it is off the reference price, the benefit-period end date, and whether it is conditional (e.g., pay-on-time).

**Misleading switching / urgency:**

- ❌ "Free electricity" / "$0 energy" / "no bills."
- ❌ "Your power will be cut off / disconnected unless you switch" — false disconnection threat.
- ❌ "Government rebate — switch now to claim" implying the _switch_ unlocks a government concession it does not. Concession/rebate eligibility is set by the scheme, not the retailer.
- ❌ "Act now — prices rising tonight" style false scarcity not tied to a real, dated price change.
- ❌ Implying D2D/the brand is "from the network", "from your current retailer", a government body, or AER/ESC/AEMO.

**US-specific (FCC + state UDAP / deceptive marketing):**

- ❌ Robotext/SMS to numbers without prior express written consent (TCPA) — gate blocks any SMS audience lacking consent provenance.
- ❌ "No cancellation fee" when an ETF exists; rate-type ("fixed") used where the plan is variable/indexed.
- ❌ Teaser rate shown without the variable/renewal terms (slamming-adjacent deceptive framing).

**Cross-cutting platform + provenance:**

- ❌ Missing **C2PA provenance** on any AI-generated image/video → block (proves AI origin, anti-deepfake).
- ❌ Asset generated while `org.legal_hold = true` → block.
- ❌ Targeting that violates platform special-ad / housing-adjacent or sensitive-attribute rules, or that targets a protected class.
- ❌ Spend that would breach `org.ai_budget_cents` → block before media buy.

### 3.2 REQUIRED DISCLOSURES — must be present to PASS

An asset with a price/savings claim publishes ONLY if it carries, legibly, in the creative or its mandatory expandable disclosure block (and on the landing page above the fold):

1. **Reference-price basis** — "Comparison is against the [DMO/VDO/price-to-compare] for [distribution zone], [benchmark annual usage], [current period]." (AU AER/ESC requirement; the legal frame for all energy advertising.)
2. **Conditional vs guaranteed** — if any discount is conditional (pay-on-time, direct debit), say so and state the guaranteed component.
3. **Benefit-period end date** — when the advertised rate/discount ends and what happens after.
4. **Full plan link** — link to the plan's Energy Price Fact Sheet / Basic Plan Information Document (AU) or EFL / Terms of Service (US: Electricity Facts Label in TX).
5. **Retailer identity + licence** — legal entity, retailer authorisation/licence number, "Authorised retailer" line. Not "the network", not government.
6. **Complaints + ombudsman** — EWON/EWOV/state energy ombudsman (AU) or state PUC complaint line (US).
7. **Exit/cancellation fees + contract term** — if any.
8. **AI provenance** — C2PA manifest attached; "AI-assisted creative" label where platform requires.
9. **Consent basis** for SMS/retargeting audiences (US TCPA / AU Spam Act + Privacy Act) recorded in audit log.

> **Region swap:** the gate loads the correct ruleset from `territory.energy_market`. AU-NEM ⇒ DMO; VIC ⇒ VDO; US-state ⇒ that state's PUC marketing rules + FCC + price-to-compare. PII for the territory never leaves its region (RLS + region-pin).

**Gate output:** `{asset_hash, verdict: PASS|BLOCK, rules_evaluated[], failures[{rule_id, span, reason}], disclosures_present[], audit_chain_id}`. BLOCK is terminal until creative is regenerated and re-gated. No human can override a HARD block without a logged, dual-control exception (and never for a false-disconnection or unlicensed-retailer hit).

---

## 4. Generation steps

All sub-steps dispatch through the Marketing Studio compose orchestrator. Every agent dispatch is **allowlisted + audit-logged + governance-checked** (allowlist == agent governance). POSTs to ad platforms are **idempotent** (idempotency key = `org_id:territory_id:asset_hash`) so retries never double-spend or duplicate-publish.

### Step 0 — Context + guardrail load

Pull `product-marketing-context` (positioning, voice, ICP). Load the region ruleset from `territory.energy_market`. Confirm `client.retailer_auth` valid and `offer.reference` is the CURRENT period figure for the correct zone/benchmark. If not → stop.

### Step 1 — Audience build (geo + lookalike, cross-platform)

Build three audience layers per platform (Meta, Google, TikTok), region-pinned, idempotent:

- **A. Geo core (warming).** Tight radius/polygon around the territory `knock` route. Meta: pin-drop radius / postcode list; Google: location targeting + radius; TikTok: location targeting. Layer demographics from `demo.profile` (dwelling, life-stage, language). Exclude protected-class targeting; respect special-ad-category constraints. This is the "soften the street" layer — frequency-capped so households see the brand 2–4× before the knock.
- **B. Lookalike / similar.** Seed = the client's prior CONVERTED switchers (hashed, consented) from earlier areas (the loop's attribution output). Meta Lookalike (1–3%), Google Similar/optimized targeting, TikTok Lookalike — then **intersect with the geo polygon** so lookalikes only fire inside the target territory. No seed list with valid consent provenance ⇒ skip lookalike, geo-only.
- **C. Suppression.** Exclude existing customers of the client (no poaching own base), known opt-outs, and any household already converted. Hashed match only.

Hashing: emails/phones SHA-256 normalized before upload; raw PII never leaves region; only hashes go to platform custom audiences.

### Step 2 — Ad copy angles (generate, then gate)

Generate copy via the studio LLM (Claude/GPT) across these energy-specific angles, each engineered to clear §3:

1. **Reference-price clarity** — "Know exactly what you'd pay vs the [DMO/VDO]." Leads with the legal frame as the _hook_, not a hidden disclosure.
2. **Bill-shock relief (post-seasonal)** — empathy for a high quarter; "see if a switch could lower your next bill" (conditional, no guarantee).
3. **Local + human ("we're in your neighborhood")** — primes the knock: "Our team's in [suburb] this week to help locals compare plans." Sets expectation that a real person will visit — lifts door-open rate.
4. **Simplicity / switching is easy** — "Switching retailers takes minutes; your power never goes off." (true; counters the #1 objection without false claims).
5. **Concession/eligibility (where true)** — "Already on a concession? You keep it when you switch." Factual, never "switch to unlock a rebate."

Each variant generated with its mandatory disclosure block pre-attached. Then **run §3 gate**. Quarantine fails; keep passes.

### Step 3 — Image / video creative direction

Brief FLUX/Ideogram (image) and Runway/HeyGen (video) under the brand kit. **C2PA manifest attached at generation** — non-negotiable.

- **Look:** EazePay navy, Inter headlines / JetBrains Mono for the rate figures and disclosure. Clean, civic, trustworthy — NOT glossy "too good to be true." No glass, no aurora, no stock "happy family in front of mansion."
- **Image:** local-feel residential street/suburb cues (generic, not a real identifiable home), a clear rate card showing the offer **next to the reference price** as a visual element, brand lockup + licence line. The comparison-to-reference is baked into the art so the claim can't appear unreferenced.
- **Video (15–30s, pre-knock):** a brand-rep to-camera (HeyGen avatar or client talent) — "Hi [suburb], we're in your area this week to help you compare your plan against the [DMO/VDO]. No pressure — just clarity." On-screen lower-third carries disclosures; end card = licence + ombudsman + plan-document link. Primes the door knock by putting a face to the brand.
- **Creative QA:** OCR every rendered asset for embedded text and re-feed to §3 (catches claims that live only in pixels). Verify C2PA present. Block any asset where the rate appears without the reference.

### Step 4 — Landing-page hook

Single region-pinned LP per territory, tagged with the area code for attribution.

- **Above the fold:** the offer stated **against the reference price**, with all §3 required disclosures visible (not buried) — basis, conditional/guaranteed, benefit-period end, plan-document link, licence, ombudsman.
- **Hook:** "See your plan vs the [DMO/VDO] in 30 seconds." Optional address/usage input to personalize the comparison — but the comparison engine must use the correct zone + benchmark; never show a fabricated "you'll save $X."
- **Primary CTA:** "Book a visit / Have our local team call you" → primes KNOCK + CALL CENTRE rather than forcing instant online sign-up. Captures consent (TCPA/Spam Act language logged).
- **Pixel/tags:** Meta Pixel + CAPI, Google tag, TikTok pixel — server-side, consent-gated. Every event hashed + region-pinned. Lead writes back as a **tagged lead** into the tenant with `territory_id`, `source=warm`, `consent_id`.

### Step 5 — Retargeting audience (knocked-not-converted)

The loop's re-engagement engine. After the crew canvasses, field-app outcomes (`knocked`, `not_home`, `interested_no_close`, `declined`) flow back. Build:

- **Knocked-not-converted custom audience:** households the crew reached but didn't close (`interested_no_close`, plus `not_home` for a soft retry), hashed → platform custom audience. Returns to the household as a **tagged retargeting lead** with a continuity message: "Missed our team in [suburb]? Compare your plan vs the [DMO/VDO] here." Same §3 gates apply.
- **Hand-back to CALL CENTRE:** `interested_no_close` also surfaces in the inside-sales queue with the warm-ad + knock context attached, so the 7-day close window is informed. (AI email/SMS triage routes inbound replies to the inside-sales inbox.)
- **Suppress** `declined` (do-not-contact) and anyone now converted. Honor opt-outs immediately; log.
- **Frequency cap** retargeting; never harass. No false urgency.

Every audience create/update is idempotent and audit-logged with the hashed-match count (not the PII).

---

## 5. Example ad variants

### ✅ PASS (4) — on-brand, gate-clear (AU NEM example; swap DMO→VDO in VIC, →price-to-compare in US)

**A. Reference-price clarity**

- **Headline:** See your rate vs the DMO before you decide
- **Primary text:** Our local team is in North Geelong this week helping neighbours compare. Lumina's Home Saver plan is 12% below the Default Market Offer (DMO) reference price for your area* — guaranteed, not conditional. Power never goes off when you switch. *Vs DMO for [zone], [benchmark usage], current period. Plan details + Energy Price Fact Sheet at the link. Authorised retailer Lumina Energy (auth. #XXXX). Complaints: EWON.
- **CTA:** Compare My Plan

**B. Bill-shock relief**

- **Headline:** Higher winter bill? See if a switch could help
- **Primary text:** A rough quarter? Compare Lumina's Home Saver against the DMO reference price for your area* and see where you'd land — no guaranteed dollar figure, just a clear, like-for-like comparison. Our team's knocking in your neighbourhood this week if you'd rather talk it through. *Basis, benefit-period end date & full plan info at the link. Authorised retailer (auth. #XXXX). EWON for complaints.
- **CTA:** See the Comparison

**C. Local + human (knock primer)**

- **Headline:** We're in [suburb] this week
- **Primary text:** Hi neighbours — Lumina's local team is door-knocking [suburb] to help you compare your energy plan against the DMO* in a few minutes. No pressure, no jargon. Prefer we call instead? Book a time. *Comparison vs DMO for your distribution zone, current period; conditions & plan documents at the link. Authorised retailer Lumina Energy (auth. #XXXX).
- **CTA:** Book a Visit

**D. Switching-is-easy (objection-killer)**

- **Headline:** Switching retailers won't cut your power
- **Primary text:** Same poles, same wires, same reliable supply — only your plan changes. Lumina's Home Saver sits 12% under the DMO reference price for your area,* with no exit fees. Takes minutes. *Vs DMO, [zone], [benchmark], current period; benefit period ends [date]. Full terms + Fact Sheet linked. Authorised retailer (auth. #XXXX). EWON for complaints.
- **CTA:** Start the Switch

### ❌ FAIL (2) — quarantined, with reason

**E. FAIL — locked comparison + guaranteed-savings**

- **Headline:** Save 30% on your energy bills — guaranteed!
- **Primary text:** Switch to Lumina today and slash your power bill. Cheapest energy in [suburb], guaranteed. Don't wait — prices go up tonight!
- **CTA:** Switch Now
- **GATE VERDICT:** `BLOCK` — (1) "Save 30%" with **no DMO/VDO reference** → locked unreferenced price-comparison (§3.1 core gate); (2) "guaranteed" savings → savings depend on usage, no guaranteed-dollar/percent claim; (3) "cheapest energy… guaranteed" → unsubstantiated superiority claim; (4) "prices go up tonight" → false/undated scarcity. No required disclosures present. Terminal until regenerated.

**F. FAIL — false disconnection threat + impersonation**

- **Headline:** Action required: your power may be disconnected
- **Primary text:** Records show your area is being switched to a new network rate. To avoid disconnection, confirm your new plan with us today. A representative from your energy provider will visit shortly.
- **CTA:** Confirm Now
- **GATE VERDICT:** `BLOCK` — (1) false disconnection threat (§3.1 misleading switching — never overridable); (2) "your energy provider"/"the network" → impersonation implying the brand is the incumbent retailer or network operator; (3) fabricated "records show… being switched" → deceptive. No reference price, no licence, no disclosures. Quarantined; flagged to governance for review.

---

## 6. Outputs + how results feed the loop

**Artifacts written (tenant-scoped, region-pinned, audit-logged):**

- `campaign_manifest.json` — territory, market, offer, reference basis, audiences (geo/lookalike/suppression) with hashed-match counts, creative set (asset hashes + C2PA manifest IDs), gate verdicts, idempotency keys, AI-budget draw (cents).
- Published ad sets across Meta/Google/TikTok (idempotent), each tagged `territory_id` + `loop_stage=MARKET`.
- Region-pinned landing page with consent-gated pixels and area tag.
- `gate_report.json` — every asset's PASS/BLOCK, rules evaluated, failures, disclosures present, audit_chain_id.
- `retarget_audience.json` (post-knock) — knocked-not-converted hashed audience + inside-sales hand-back queue.

**Attribution + next-area feedback (the loop closes here):**

- Warm-stage impressions/frequency/clicks/LP leads (by household where consented) join with **field-app knock outcomes** and **call-centre close outcomes** on `territory_id` + hashed identifier → per-territory funnel: _warmed → door-opened → interested → closed → commission_.
- This produces the **lift signal**: did warming raise door-open and close rates vs unwarmed control streets? Stored as the territory's performance record.
- **Converted switchers (consented, hashed)** become the **lookalike seed for the NEXT territory** (Step 1B) — so each area's winners train the next area's targeting.
- **Winning angles/creatives** (gate-passed, high LP→lead, high door-open) are promoted; losers retired. Skill-curation loop refines the angle library after each campaign (procedural memory) — without copying any external creative.
- **Compliance evidence**: the hash-chained gate + audit trail is SOC 2 / AER-marketing evidence — provable that no locked, unreferenced, or deceptive energy claim ever published.

Commission events (on CONVERT) reconcile back against the territory's warm-spend (money as BigInt cents) for true CAC-per-area.

---

## 7. Related skills

- **product-marketing-context** — foundational; load FIRST for positioning/voice/ICP (hub-and-spoke).
- **solar-warm-the-area** / **telco-warm-the-area** / **pest-warm-the-area** / **charity-warm-the-area** — sibling vertical warming skills (different gates).
- **ad-creative** / **copywriting** — generic copy generation (this skill adds energy gates + loop wiring on top).
- **paid-ads** — cross-platform delivery mechanics (Meta/Google/TikTok) this skill orchestrates.
- **retargeting-audience-builder** — shared hashed-custom-audience tooling for the knocked-not-converted return path.
- **pii-first-design** / **pii-tagger** — classify + region-pin + tenant-scope all territory PII before any write.
- **agent-governance** + **agent-audit-log** — ALWAYS-on dispatch governance + immutable record.
- **constitutional-critique** — high-stakes output pass before the §3 gate.
- **compliance-check** — generic gate runner; this skill supplies the energy ruleset (DMO/VDO, AER retail code, FCC).
- **analytics-tracking** — pixel/CAPI/server-side event wiring for the landing page.
- **multi-tenant-isolation-audit** — verify RLS + region-pin before publish.

---

**End state:** a gate-passed, C2PA-provenanced, geo + lookalike warming campaign live across Meta/Google/TikTok for one territory, a consent-captured landing page, a ready knocked-not-converted retargeting path, and an attribution wire that turns this area's converts into the next area's targeting seed — with an immutable audit trail proving no locked, unreferenced, or deceptive energy claim ever shipped.
