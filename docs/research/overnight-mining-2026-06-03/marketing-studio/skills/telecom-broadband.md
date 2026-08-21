# d2d-telecom-warm-area

```yaml
name: d2d-telecom-warm-area
description: >-
  Generate a GEO-TARGETED "warm the area" pre-knock campaign for the
  TELECOM / BROADBAND (fibre) vertical inside the D2D Marketing Studio.
  Softens a specific territory across Meta / Google / TikTok 5-10 days
  BEFORE the field team knocks, then feeds the loop (MARKET -> KNOCK ->
  CALL CENTRE -> RETARGET -> CONVERT -> COMMISSION). Enforces FCC
  marketing-rule gates: speed/coverage claims substantiated, "unlimited"
  fair-use disclosed, all-in pricing + post-promo rate + contract/ETF
  terms shown, autopay/paper-fee parity. US-first. Operator-run under the
  client ISP's brand on an audit-grade tenant.
trigger_slash: /warm-telecom
trigger_nl:
  - 'warm the area for [ISP] in [territory] before we knock'
  - 'pre-knock fibre campaign for [zip/route]'
  - "geo-target broadband ads for next week's turf"
vertical: telecom-broadband-fibre
region_default: US
related_services:
  - services/marketing
  - services/content-studio
loop_stage: MARKET (stage 1 of 6)
status: production
owner: Marketing Studio
```

> **One-line:** Pre-warm a fibre territory so the door is half-open before the rep raises a knuckle — and so every impression, click, and form-fill becomes a tagged lead the call centre and the next area's targeting can use.

---

## 1. Trigger + when to use

**Invoke this skill when:**

- A client ISP has handed D2D a **territory** (zip set, carrier route, polygon, or named subdivision) and a **knock window** is scheduled within the next 5–15 days.
- The field ops calendar shows a turf assignment and the loop needs **stage 1 (MARKET)** to fire before reps arrive.
- An existing area underperformed on cold knocks and ops wants a **warm-up layer** before re-canvassing.
- The call centre is seeing low pickup on first-touch and wants **brand familiarity** seeded in the territory first.

**Do NOT invoke when:**

- No knock window is set (a warm-the-area campaign with no field follow-through wastes spend and breaks attribution — route to a brand-awareness skill instead, or hold).
- The territory is **outside the serviceable fibre footprint**. Warming addresses that cannot buy the product is the fastest way to generate complaints and an FCC-exposed "bait" pattern. **Footprint check is a hard gate (see §4).**
- The client is a reseller without rights to advertise the underlying carrier's speed marks — escalate to legal-hold review.

**Position in the loop:** This is **MARKET**. Its job is not to close — it is to (a) raise brand familiarity so the knock converts warmer, (b) capture self-serve intent (form-fills / calls) that feed the call centre as **pre-warmed leads**, and (c) drop the retargeting pixel + build the seed audience that **RETARGET** will re-engage after the knock. Output flows forward to KNOCK and feeds back into the **next area's targeting model**.

---

## 2. Required inputs

The compose step **refuses to run** if any of these are missing, malformed, or unverifiable. All inputs are tenant-scoped (RLS) and region-pinned; US-territory PII never leaves the US region.

### 2.1 Territory (`territory`)

| Field                       | Type     | Notes                                                                                                                       |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `geo_type`                  | enum     | `zip` \| `carrier_route` \| `polygon` \| `named_subdivision`                                                                |
| `geo_values[]`              | string[] | e.g. `["75204","75206"]` or GeoJSON polygon ref                                                                             |
| `serviceable_footprint_ref` | id       | **Required.** Pointer to the client's address-level fibre serviceability set. Used by the footprint gate.                   |
| `footprint_coverage_pct`    | int      | % of territory addresses that are actually serviceable. Drives the "where to buy" map and the coverage disclosure.          |
| `knock_window_start`        | date     | Field team arrival. Ads launch `knock_window_start − lead_days`.                                                            |
| `lead_days`                 | int      | Default 7 (range 5–15). Pre-warm runway.                                                                                    |
| `competitive_context`       | enum[]   | Incumbent(s) present: `cable_docsis` \| `fixed_wireless` \| `dsl` \| `other_fibre` \| `greenfield`. Shapes angle selection. |

### 2.2 Demographics (`demographics`)

- `household_density` (urban / suburban / rural-edge), `owner_renter_mix`, `median_hh_income_band`, `dominant_language(s)`, `age_skew`, `known_pain` (e.g. "DSL only," "frequent outages," "new construction"). Feeds audience build, angle ranking, and language/creative localization. **No targeting on protected classes** — demographics inform _creative and geo_, not exclusionary audience gating (see §4 fair-housing-adjacent note).

### 2.3 Brand kit (`brand_kit`)

- `client_legal_name`, `client_dba`, `brand_logo_ref`, `color_tokens`, `font_tokens`, `voice_guide`, **`approved_speed_marks[]`** (the exact tier names + advertised speeds the client is _contractually permitted_ to market, e.g. "Fibre 1 Gig — up to 1,000 Mbps"), `approved_claims_library` (pre-cleared substantiated claims), `disclosure_templates` (legal-approved fine print), `trademark_usage_rules`. The Marketing Studio renders all creative under the **client's brand**, never D2D's.

### 2.4 Offer (`offer`)

| Field                    | Type   | Notes                                                                                                                   |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `tier_name`              | string | Must match an `approved_speed_marks[]` entry.                                                                           |
| `advertised_speed`       | string | "up to X Mbps" framing required by gate.                                                                                |
| `monthly_price_cents`    | BigInt | Money as integer cents. **Promo price.**                                                                                |
| `promo_duration_months`  | int    | Length of promotional rate.                                                                                             |
| `post_promo_price_cents` | BigInt | **Required if** `promo_duration_months` is set. The "then $X/mo" rate.                                                  |
| `contract_term_months`   | int    | 0 = no contract.                                                                                                        |
| `etf_cents`              | BigInt | Early-termination fee. Required if `contract_term_months > 0`.                                                          |
| `equipment_fee_cents`    | BigInt | Router/gateway monthly fee, or 0 if included.                                                                           |
| `install_fee_cents`      | BigInt | Or 0/waived (state the waiver condition).                                                                               |
| `autopay_required`       | bool   | If price assumes autopay/paperless, the **non-autopay price** must be disclosed (fee-parity gate).                      |
| `data_policy`            | enum   | `truly_unlimited` \| `unlimited_with_fair_use` \| `capped`. If fair-use throttle exists, threshold must be disclosable. |
| `offer_expiry`           | date   | Drives urgency copy honestly.                                                                                           |

---

## 3. Brand-safety / compliance gates (HARD — block publish)

These run in `services/marketing` at compose time **and** again at the publish boundary. **Any FAIL blocks the publish POST** (idempotent; the blocked attempt is recorded). Every gate decision is written to the **immutable hash-chained audit log** with the offending field and rule id. High-stakes creative additionally gets a **constitutional critique** pass. Agent governance is always on: the compose agent's dispatch is audit-logged and governance-checked.

> **Telecom regulatory frame (US-first):** FCC marketing rules + Truth-in-Billing principles, FTC Act §5 (no unfair/deceptive acts), and the FCC **Broadband "Nutrition" Label** norms for all-in pricing, speed, and data-policy transparency. Speed and coverage claims must be **substantiated** and framed as "up to." AU deployments additionally layer ACL substantiation + ACMA; SG layers IMDA — but the gates below are the US baseline.

### 3.1 Hard BLOCKLIST (publish-blocking phrases / patterns)

| #   | Blocked                                                                                                        | Why                                                                         | Allowed instead (with substantiation)                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| B1  | **Unqualified speed claims** — "1 Gig speeds," "1,000 Mbps" stated as delivered                                | FCC/FTC: advertised speed must be "up to" and substantiated by network data | "Plans with speeds **up to** 1,000 Mbps" + `substantiation_ref`                                                    |
| B2  | **"Fastest" / "best" / "#1" without proof**                                                                    | Unsubstantiated superlative / comparative                                   | Only if `approved_claims_library` holds a dated, cited basis (e.g. third-party test, named + linked)               |
| B3  | **"Unlimited" with an undisclosed cap or throttle**                                                            | Deceptive if a fair-use throttle exists and is hidden                       | "Unlimited data" **only if** `data_policy = truly_unlimited`; else "Unlimited data (fair-use applies — see terms)" |
| B4  | **Price without all-in disclosure** — promo price with no equipment/install/post-promo/taxes context           | Truth-in-Billing / Broadband Label all-in pricing                           | Promo price **with** post-promo rate, equipment fee, install fee or waiver, "plus taxes & fees"                    |
| B5  | **Promo rate shown as the ongoing price** — "$50/mo" when it jumps after 12 mo                                 | Deceptive "then-price" omission                                             | "$50/mo for 12 mos, then $70/mo"                                                                                   |
| B6  | **Autopay/paperless price with no non-autopay disclosure**                                                     | Fee-parity; hidden surcharge                                                | "$50/mo w/ autopay & paperless billing; $55/mo without"                                                            |
| B7  | **Coverage/availability overstatement** — "available everywhere in [area]" when `footprint_coverage_pct < 100` | Bait pattern; FCC availability accuracy                                     | "Now available in **select** [area] addresses — check yours" + serviceability CTA                                  |
| B8  | **"No contract" with an undisclosed term/ETF**                                                                 | Contradicts `contract_term_months > 0`                                      | State actual term + ETF, or only say "no contract" when `contract_term_months = 0`                                 |
| B9  | **"Free" install/router with an undisclosed condition**                                                        | Deceptive "free"                                                            | "Free install with 12-mo plan" (state the condition)                                                               |
| B10 | **Fake urgency / countdown not tied to `offer_expiry`**                                                        | Deceptive scarcity                                                          | Real, dated deadline only                                                                                          |
| B11 | **Speed-mark or trademark misuse** — carrier marks the client can't use                                        | Trademark / licensing                                                       | Only marks present in `approved_speed_marks[]`                                                                     |
| B12 | **Targeting/creative implying exclusion by protected class** (housing-adjacent for home internet)              | Fair-housing-adjacent + platform policy (Meta Special Ad Category)          | Geo + interest only; run housing-sensitive flows under platform **Special Ad Category** where required             |
| B13 | **Health/EMF safety claims** ("safe radiation," "healthier than 5G")                                           | Unsubstantiated health claim                                                | Omit entirely                                                                                                      |
| B14 | **Implying govt affiliation / ACP-style subsidy unless enrolled & accurate**                                   | Deceptive affiliation                                                       | Only if `offer` carries a verified subsidy ref + exact terms                                                       |

**Matching is semantic, not just literal** — paraphrases of B1–B14 are caught by the gate's intent classifier, then human-reviewable.

### 3.2 REQUIRED DISCLOSURES (must be present + legible to pass)

A creative/landing page **fails** if any applicable disclosure is missing, illegible (contrast/size threshold), or not machine-detectable in the asset's text layer:

- **D1 — "Up to" speed framing** on every speed mention + `substantiation_ref` retained in audit.
- **D2 — All-in pricing block:** promo price, `promo_duration_months`, post-promo price, equipment fee, install fee/waiver-condition, "plus taxes & fees."
- **D3 — Contract & ETF:** term length + ETF, or explicit "no contract."
- **D4 — Data policy:** "truly unlimited" OR "fair-use applies" with pointer to threshold; cap stated if `capped`.
- **D5 — Autopay/paperless fee parity** if `autopay_required`.
- **D6 — Serviceability qualifier:** "Service availability and speeds vary by address — check yours" whenever `footprint_coverage_pct < 100`.
- **D7 — Offer expiry** date if urgency is used.
- **D8 — Advertiser identity:** client legal name/DBA on landing page; platform "Paid for by / Sponsored" honored.
- **D9 — C2PA provenance** on every AI-generated image/video asset; **legal-hold** flag honored (blocks delivery if active).

### 3.3 Gate ordering (fail-fast)

```
[Footprint gate] -> if territory not serviceable OR coverage data missing: HARD STOP (do not generate)
        |
[Input completeness] -> any required §2 field missing/malformed: BLOCK
        |
[Blocklist B1-B14] (semantic) -> any hit: BLOCK + log offending span + rule id
        |
[Disclosure D1-D9 present + legible + machine-detectable] -> any missing: BLOCK
        |
[Special Ad Category check] -> housing-adjacency: force SAC flags or BLOCK
        |
[C2PA + legal-hold] -> missing provenance / active hold: BLOCK delivery
        |
[Constitutional critique] (high-stakes creative) -> flags for human review
        |
PUBLISH (idempotent POST, audit-logged, per-org AI budget checked)
```

---

## 4. Generation steps

The orchestrator (`services/marketing` compose agent, governance-on) runs these in order. Subagents may parallelize creative variants; each variant re-enters the §3 gates independently.

### Step 0 — Load context + footprint gate

Pull `product-marketing-context` for this tenant/brand. Resolve `serviceable_footprint_ref`; compute `footprint_coverage_pct`. **If not serviceable or coverage unknown → HARD STOP** with a clear operator message (don't warm a dead territory).

### Step 1 — Audience build (geo + lookalike across platforms)

Build per-platform audiences, all anchored to the **serviceable footprint** (never the raw polygon if coverage < 100%):

- **Geo core (all platforms):**
  - **Meta:** location targeting by zip/radius **intersected with serviceable addresses**; if home-internet creative trips housing-adjacency → **Special Ad Category (Housing)** with its targeting limits. Age/gender broad; interests light (avoid over-narrowing a small turf).
  - **Google:** Performance Max / Demand Gen with **location targeting set to "presence: people in this area"** (not "interest"), radius around serviceable clusters; add **geo-intent search** ("fibre internet [neighborhood]," "[ISP] availability") as a companion Search campaign.
  - **TikTok:** Spark Ads, location + broad; lean creative-led (the algorithm finds the turf). Tight geo on small territories can starve delivery — widen radius slightly and let frequency caps protect spend.
- **Lookalike / similar audiences (seed from the loop's own data):**
  - Seed = **prior converted customers in adjacent, demographically-similar territories** (hashed, region-pinned). Meta **Lookalike 1–3%**, Google **Similar segments / audience signals on PMax**, TikTok **Lookalike**. This is where the loop compounds: each closed area's converters become the next area's seed.
  - **Exclusions:** existing customers (suppress), and **out-of-footprint** users. Frequency caps to avoid burning a small household count.
- **Retargeting seed (built now, fired later):** stand up the pixel/event dataset + a **"warm-area visitors"** custom audience so RETARGET has a population on day 1 post-knock (see §4 Step 6).

### Step 2 — Ad copy angles (rank by `competitive_context` + `known_pain`)

Generate a matrix; the compose agent ranks angles to the territory:

1. **"Fibre just reached your street."** (greenfield / new availability) — novelty + local specificity.
2. **"Stop paying cable prices for cable speeds."** (vs `cable_docsis`) — symmetrical-speed + value, all-in price honest.
3. **"Tired of DSL buffering?"** (vs `dsl` / rural-edge) — pain-relief.
4. **"A neighbor-by-neighbor rollout — we're in your area this week."** — primes the _knock_ explicitly (warm hand-off to field team).
5. **"Check if your address qualifies."** — serviceability-CTA-led (doubles as the footprint-honest angle; great where coverage < 100%).
6. **"Lock the intro rate before it ends [date]."** — honest urgency tied to `offer_expiry`.

Each angle is generated **with disclosures inline** so it can pass §3 as written.

### Step 3 — Image / video creative direction

Design DNA respected (EazePay navy lineage; **Inter + JetBrains Mono**; no glass, no aurora — clean, trustworthy, infrastructure-credible). All AI assets carry **C2PA**.

- **Image (FLUX / Ideogram):** clean fibre-home lifestyle (family streaming, WFH video call, gamer with low-ping) OR a **map-of-your-neighborhood "now lit" motif**; large legible speed mark with "up to"; the all-in price block as a designed element (not buried). Brand logo per `trademark_usage_rules`. Avoid stocky "data tunnel" clichés.
- **Video (Runway / HeyGen):** 6–15s. Open with local hook ("[Neighborhood], fibre's here"), show the speed/use-case benefit, end on **"Check your address"** + the honest price super. HeyGen presenter optional for a "local rep intro" that **pre-faces the knock** ("our team's in the area this week"). Captions burned in (sound-off). Disclosure super on-screen long enough to read (legibility = a D-gate).
- **Creative-direction guardrail:** the art director step cannot output a speed number, price, or "unlimited" without pulling the matching disclosure token — the asset is born compliant or it doesn't render.

### Step 4 — Landing-page hook (serviceability-first)

A dedicated, tenant-branded LP (client brand, advertiser identity D8):

- **Hook:** mirrors the winning angle. Hero = **address/serviceability checker** ("Enter your address — see if fibre's live on your street"). This is the honest core of a warm-area campaign: it converts intent _and_ filters out-of-footprint traffic _before_ a rep is dispatched.
- **Body:** the **all-in pricing block (D2)**, contract/ETF (D3), data policy (D4), autopay parity (D5), "up to" speeds (D1), serviceability qualifier (D6), expiry (D7).
- **Primary conversion:** address check → "Qualified" → **lead form (name, phone, address, best time)** → routed to the **call centre as a pre-warmed inbound** + flagged to field ops so the route knows who already raised a hand. "Not yet available" → email-capture for waitlist (feeds future-area demand signal).
- **Tracking:** UTم per platform/angle/territory; server-side conversion events back to Meta/Google/TikTok; every submission tagged with `territory_id` for attribution.

### Step 5 — Knock hand-off (MARKET → KNOCK)

Emit a **territory warm-up packet** to field ops: which addresses saw ads, who self-identified (qualified leads), top-performing angle (so the rep's door pitch matches the ad the resident already saw), and a "do-not-knock" suppression list (already-converted online + opt-outs). This is the seam that makes the knock _warm_.

### Step 6 — Retargeting audience (knocked-not-converted)

The loop's re-engagement layer, built so RETARGET fires the moment KNOCK + the 7-day CALL CENTRE window mature:

- **Source populations:**
  1. **Warm-area visitors** (pixel) who didn't submit.
  2. **Knocked-not-converted** — field dispositions ("not home," "interested-callback," "soft no") exported as a **hashed custom audience** (phone/email, region-pinned), uploaded to Meta/Google/TikTok.
  3. **Call-centre no-close** within the 7-day window.
- **Treatment:** sequenced retargeting — social proof + "we knocked, here's the offer in writing" + honest urgency (`offer_expiry`). **Suppress converters and opt-outs.** Each retargeted lead **returns into the system as a tagged lead** (source = `retarget`, with its disposition lineage) so the call centre can re-attempt and attribution stays intact.
- **Frequency + budget:** capped; per-org AI/media budget enforced; small-territory frequency guards.

### Step 7 — Compose, gate, publish

Assemble campaign object → run **full §3 gate chain** per asset → on PASS, **idempotent publish POST** per platform (audit-logged, C2PA attached, budget-checked). On any FAIL: block, log offending span + rule id, return a fix list. Nothing reaches a platform un-gated.

---

## 5. Example ad variants

### 5.1 PASS (4 on-brand, gate-clean)

> All four assume `offer`: Fibre 1 Gig, "up to 1,000 Mbps," $50/mo promo for 12 mos then $70/mo, no contract, router included, install waived w/ 12-mo plan, truly unlimited, autopay price w/ $5 non-autopay delta, `footprint_coverage_pct = 76`, expiry 2026-06-30.

**Variant A — New availability (Meta, single image)**

- **Headline:** Fibre just reached select streets in [Neighborhood]
- **Primary text:** Streaming, gaming, WFH — on a fibre line built for it. Plans with speeds **up to 1,000 Mbps**. **$50/mo for 12 months, then $70/mo** — no contract, router included, **plus taxes & fees**. Autopay & paperless price; **$55/mo** without. Truly unlimited data. **Service and speeds vary by address — check yours.** Offer ends 6/30.
- **CTA:** Check your address
- _Passes: D1 (up-to), D2 (all-in + then-price), D3 (no contract), D4 (truly unlimited), D5 (autopay parity), D6 (select + check), D7 (expiry). No B-hits._

**Variant B — vs cable (Google RSA-style)**

- **Headline:** Cable prices, finally fibre speeds | Up to 1,000 Mbps in [Area] | $50/mo for 12 mo, then $70
- **Description:** Switch to fibre: speeds up to 1,000 Mbps, no contract, router included. $50/mo for 12 months, then $70/mo, plus taxes & fees. Availability varies by address — check yours. Ends 6/30.
- **CTA:** See if you qualify
- _Passes: honest comparative (value, not unsubstantiated "fastest" → avoids B2), D1/D2/D3/D6/D7._

**Variant C — Pre-knock primer (TikTok Spark, 12s)**

- **On-screen / VO:** "[Neighborhood] — fibre's officially here. Our team's in your area this week. Speeds up to a gig. $50 a month for 12 months, then $70, no contract, router included, taxes & fees extra. Not on every street yet — tap to check your address before we knock."
- **Caption:** Fibre's live in [Neighborhood] 🚀 Check your address (link)
- **CTA:** Check your address
- _Passes: primes KNOCK; D1/D2/D3/D6 in VO + burned captions; honest "not every street" → no B7._

**Variant D — Serviceability-led (Meta, coverage<100%)**

- **Headline:** Is fibre live on your street yet?
- **Primary text:** We're lighting up [Area] block by block. Enter your address to see if you qualify today. If you do: speeds **up to 1,000 Mbps**, **$50/mo for 12 months, then $70/mo**, no contract, router included, plus taxes & fees ($55/mo without autopay). Truly unlimited. Ends 6/30.
- **CTA:** Check availability
- _Passes: footprint-honest by design (D6 is the hook), full D2/D1/D3/D4/D5/D7._

### 5.2 FAIL (2, with reason)

**Variant E — FAIL**

- **Headline:** Get blazing-fast 1,000 Mbps — only $50/mo!
- **Primary text:** The FASTEST internet in [Area]. Unlimited everything. Switch today!
- **CTA:** Sign up
- **Why it fails (blocks publish):**
  - **B1** — "1,000 Mbps" stated as delivered, not "up to."
  - **B2** — "FASTEST in [Area]" superlative with no `approved_claims_library` basis.
  - **B3** — "Unlimited everything" with no fair-use/cap disclosure context.
  - **B4/B5** — "$50/mo" with no post-promo rate, no equipment/install/taxes, promo shown as ongoing.
  - **D6 missing** — coverage is 76% but copy implies blanket availability (also trips **B7**).
  - _Result: HARD BLOCK; offending spans + rule ids logged; fix list returned._

**Variant F — FAIL**

- **Headline:** Free install + free router — no contract, ever!
- **Primary text:** Government-backed fibre savings for [Area] families. Safer than 5G. Lock in before midnight tonight!
- **CTA:** Claim your spot
- **Why it fails (blocks publish):**
  - **B9** — "Free install + free router" with the 12-mo condition omitted.
  - **B8** — "no contract, ever" while the offer's waiver conditions imply terms (contradiction without disclosure).
  - **B14** — "Government-backed … savings" implies subsidy/affiliation with no verified subsidy ref.
  - **B13** — "Safer than 5G" = unsubstantiated health/EMF claim.
  - **B10** — "before midnight tonight" countdown not tied to `offer_expiry` (real expiry is 6/30) → fake urgency.
  - **B12 risk** — "[Area] families" + home-internet may require **Special Ad Category**; flagged.
  - _Result: HARD BLOCK; constitutional critique additionally flags the affiliation + health claims._

---

## 6. Outputs + how results feed attribution & the next area

### 6.1 Campaign outputs (artifacts)

- **Campaign object** (per platform): audiences (geo+lookalike+retarget-seed), creatives (C2PA-stamped), budgets, schedule pinned to `knock_window_start − lead_days`.
- **Compliance evidence bundle:** gate results, disclosures present, substantiation refs, C2PA manifests, audit-log hash-chain pointers, Special-Ad-Category status, legal-hold state. SOC-2-grade evidence.
- **Territory warm-up packet** → field ops (addresses warmed, qualified hand-raisers, winning angle, do-not-knock list).
- **Retargeting audiences** pre-built for post-knock activation.
- **Tracking spec:** UTMs, server-side conversion events, `territory_id` tagging on every lead.

### 6.2 Attribution (closes the loop)

Every outcome is stitched to its territory and source so commission and learning are defensible:

- **Lead lineage:** `impression → click → address-check → lead-form / call → knock-disposition → call-centre-touch → retarget-touch → CONVERT → COMMISSION`, all under one `territory_id`, on the hash-chained ledger (money as BigInt cents).
- **Source tagging:** every lead carries `source ∈ {warm_area_self_serve, knock, call_centre, retarget}` + platform/angle — so D2D can see whether warming **lifted knock conversion** vs cold control turf.
- **Per-channel ROI:** spend (per-org budget) vs conversions per territory; cost-per-warm-lead, warm-knock close-rate lift, retarget recovery rate.

### 6.3 Feed-forward to the NEXT area's targeting

This is where the loop compounds:

- **Winning angle + creative** per `competitive_context` / demographic band → promoted into the **approved library** as the new default for similar territories.
- **Converters become the next lookalike seed** (hashed, region-pinned) → Step 1 of the next run starts warmer.
- **Footprint-honest CTR/close deltas** refine which `competitive_context` deserves which angle.
- **Disposition outcomes** (knock + call-centre) train the **next area's audience model** — which household profiles convert, which to suppress, what frequency works on small turf.
- **Spend efficiency curves** set the next area's `lead_days` and budget defaults.

---

## 7. Related skills

- **`product-marketing-context`** — foundational; load first for tenant brand/audience/positioning (hub-and-spoke).
- **`ad-creative`** — generic ad-copy iteration engine this skill specializes for telecom.
- **`paid-ads`** — cross-platform campaign structure / bidding the geo build sits on.
- **`page-cro` / `form-cro`** — optimize the serviceability LP + lead form.
- **`pii-first-design`** — hashed audiences, region-pinned PII, lead data handling (always-on).
- **`agent-governance`** + **`agent-audit-log`** — compose-agent dispatch governance + immutable record (always-on).
- **`constitutional-critique`** — high-stakes creative review pass.
- **`compliance-check`** — generic gate runner this vertical's blocklist/disclosures plug into.
- **`analytics-tracking`** — UTMs, server-side conversion events, attribution wiring.
- **`d2d-charity-warm-area`, `d2d-solar-warm-area`, `d2d-pest-warm-area`, `d2d-energy-warm-area`** — sibling vertical warm-area skills sharing the loop + gate scaffold.
- **`loop-engineering`** — the MARKET→KNOCK→CALL→RETARGET→CONVERT→COMMISSION spine this stage plugs into.
