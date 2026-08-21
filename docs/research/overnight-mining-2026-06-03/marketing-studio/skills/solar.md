# Solar Territory Warm-Up Campaign

```yaml
---
name: solar-territory-warmup
description: >
  Generates a geo-targeted "warm the area" residential-solar campaign that softens a
  specific territory BEFORE the D2D field team knocks, then feeds the loop. Builds
  geo + lookalike audiences across Meta/Google/TikTok, writes compliance-gated ad
  copy + creative direction, a landing-page hook, and a knocked-not-converted
  retargeting audience. Hard gates BLOCK publish on "free solar"/"$0 down" without
  finance terms, unsubstantiated savings, and missing required disclosures
  (FTC Green Guides US / Clean Energy Council code AU). Outputs feed attribution and
  the next area's targeting.
vertical: commercial-field-sales/solar
loop_stage: MARKET (pre-knock) + RETARGET (post-knock)
invoke:
  slash: /solar-warmup
  natural_language:
    - 'warm up [territory] for solar before we knock'
    - 'build a solar pre-knock campaign for [zip/suburb]'
    - 'geo-target [area] for the solar client'
checks_first: product-marketing-context # hub-and-spoke: load org/brand/offer first
governance: agent-governance # ALWAYS on; dispatch audit-logged
region_pinning: [US, AU, SG] # PII never leaves its region
audit: append-only, hash-chained
---
```

## 1. Trigger + when to use

Run this skill when a solar client has **handed D2D a territory** and the loop needs its first stage lit: paid ads that warm the neighborhood **before a single door is knocked**, plus the retargeting audience that catches the doors that were knocked but didn't convert.

**Use it when:**

- A new territory is assigned (zip cluster, suburb, postcode set, or drawn polygon) and the knock window opens in 5–14 days. Pre-warm needs ~7 days of impression frequency to lift door-open and close rates before reps arrive.
- A territory was worked once, conversion was soft, and you want to re-warm + retarget the knocked-not-converted set before a second sweep.
- The call centre is about to start its 7-day inside-sales follow-up and wants air cover (the prospect sees the brand on Instagram the same week the rep calls).

**Do NOT use it when:**

- No on-brand asset kit or approved offer exists yet → run `product-marketing-context` first; this skill **hard-stops** without a brand kit and an approved offer.
- The vertical isn't residential solar (commercial/utility-scale solar, batteries-only, or roofing) → wrong gate set; use the matching vertical skill.
- The offer economics involve a finance product (loan/PPA/lease) but **no finance terms have been supplied** → the gate will block every variant; collect APR/term/total-cost first.

This is a **MARKET-stage + RETARGET-stage** skill in the D2D loop:
`MARKET (this skill) → KNOCK → CALL CENTRE → RETARGET (this skill) → CONVERT → COMMISSION → attribution trains the NEXT area.`

## 2. Required inputs

The compose orchestrator refuses to start generation until all four blocks resolve. Missing fields are returned as a structured `inputs.missing[]` list, not guessed.

### 2.1 Territory (`territory`)

```yaml
territory:
  id: TERR-2026-0418-AZ-TUC-NE # immutable, used as attribution join key
  region: US # US | AU | SG — pins PII residency + gate pack
  geo_type: zip_cluster # zip_cluster | postcode_set | polygon | radius
  geo_values: ['85718', '85750', '85715'] # OR GeoJSON polygon OR {center_latlng, radius_m}
  market_label: 'Tucson NE foothills' # human label for reports
  knock_window: { start: 2026-06-12, end: 2026-06-26 }
  utility: 'Tucson Electric Power' # for substantiated-savings baseline (US: utility avg rate)
  prior_passes: 0 # >0 unlocks re-warm + retarget mode
```

### 2.2 Demographics (`audience_profile`)

```yaml
audience_profile:
  homeownership: owner_occupied_only # REQUIRED — renters cannot install; gate enforces
  dwelling: detached_single_family # excludes apartments/strata where install is blocked
  roof_signal: { age_max_years: 25, hoa_flag: surface } # HOA surfaced to copy, not hidden
  est_household_income: '>=75k'
  age_range: [30, 70]
  exclusions: ['recent_installers_180d', 'do_not_contact_list'] # suppression sets
  lookalike_seed: prior_converts_solar # source for LAL; see 5.1
```

### 2.3 Brand kit (`brand_kit`) — from the client's tenant, immutable per campaign

```yaml
brand_kit:
  org_id: org_solartx_001
  legal_entity: 'SunRidge Solar LLC' # exact legal name for disclosures
  logos: { primary: c2pa://asset/9a1.., mono: c2pa://asset/9a2.. }
  palette: { primary: '#0A1F44', accent: '#3B82F6' } # client's, NOT EazePay navy (that's product chrome)
  fonts: ['Inter', 'JetBrains Mono']
  tone: 'confident, plain-spoken, no hype'
  approved_claims_library: claims://org_solartx_001 # pre-substantiated savings statements ONLY
  licenses: { contractor_license_no: 'ROC-XXXXXX', state: 'AZ' } # required in some-state ad disclosures
```

### 2.4 Offer (`offer`) — the gate's source of truth

```yaml
offer:
  headline_offer: "Lock today's rate before the season fills up"
  finance:
    present: true # if true, finance_terms is MANDATORY
    type: loan # loan | PPA | lease | cash_only
    finance_terms: # REQUIRED when present:true — feeds Reg Z/TILA disclosure
      apr_pct: 6.99
      term_months: 240
      total_cost_disclosure: 'Total cost of system financed: $X over 240 mo at 6.99% APR.'
      lender_legal_name: 'Acme Financing Inc.'
  savings_basis: # REQUIRED — substantiation evidence for any savings claim
    method: 'modeled_vs_utility_avg'
    utility_avg_rate_cited: '$0.146/kWh (TEP 2026 residential avg)'
    assumptions_disclosure: 'Estimate based on average usage; actual savings vary.'
    evidence_ref: doc://substantiation/solartx-tep-2026.pdf
  incentives: # ITC etc. — must be stated as "may qualify", never guaranteed
    federal_itc: { mention: true, qualifier_required: true }
```

## 3. Brand-safety / compliance gates (HARD — block publish)

Every generated artifact (copy, image text overlay, video script, landing hook, ad-set name) passes through the **Solar Gate** before it can be queued for delivery. A gate failure sets `publish_status: BLOCKED`, writes the reason to the append-only audit log, and returns the offending span with a fix suggestion. **No human override path inside this skill** — a blocked claim must be edited or routed to legal-hold review; it cannot be force-published.

Region selects the pack: **US → FTC Green Guides + Reg Z/TILA + state contractor-license rules**; **AU → Clean Energy Council New Energy Tech Consumer Code + ACL**; **SG → EMA/consumer-protection baseline**. US is primary.

### 3.1 BLOCKLIST — phrases/claims that block publish

| #   | Blocked pattern (case-insensitive, stem-matched)                                                                     | Why it blocks                                                                       | Allowed only if                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| B1  | `free solar`, `solar for free`, `get solar free`                                                                     | Implies no cost; deceptive when any finance/lease exists                            | Never in residential D2D paid copy — **hard block, no exception**                                                        |
| B2  | `$0 down`, `zero down`, `no money down`, `nothing down`                                                              | Finance term used as a hook without Reg Z/TILA terms                                | `offer.finance.present=true` AND full `finance_terms` present AND APR + term + total-cost shown in the **same** creative |
| B3  | `eliminate your bill`, `no more electric bill`, `bill goes to zero`, `never pay the utility again`                   | Unsubstantiated absolute savings; almost always false (grid connection/fees remain) | Never — block. Use modeled, qualified language (see 3.2)                                                                 |
| B4  | `guaranteed savings`, `guaranteed to save`, `save $X guaranteed`                                                     | Absolute guarantee without substantiation                                           | Only if a **written savings guarantee product** exists in `approved_claims_library` with evidence_ref; otherwise block   |
| B5  | `100% green`, `zero emissions`, `carbon neutral`, `eco-friendly` (bare)                                              | FTC Green Guides §260.4/§260.6 — unqualified general-benefit/carbon claims          | Block bare; allow only specific, substantiated, qualified form ("reduces grid electricity use," with basis)              |
| B6  | `free money from the government`, `government pays for it`, `free government solar`                                  | Misrepresents the ITC (a tax credit, conditional)                                   | Never — block. ITC only as "you **may qualify** for a federal tax credit; consult a tax advisor"                         |
| B7  | `government program ending`, `act now before the deadline`, `last chance`, `expires tonight` (when no real deadline) | False urgency; CEC code bans high-pressure (AU); deceptive (US)                     | Only with a **verifiable** dated deadline in `offer`; the date must be rendered                                          |
| B8  | `pre-approved`, `you're approved`, `instant approval`                                                                | Credit-decision representation D2D cannot make in a warm-up ad                      | Never in warm-up copy — block                                                                                            |
| B9  | Income/savings figures with no basis (`save $200/mo`) where `savings_basis.evidence_ref` is absent                   | Unsubstantiated savings                                                             | Block unless a substantiation doc is attached AND the assumption qualifier renders                                       |
| B10 | Free/$0/guarantee claim in **image or video text overlay** (OCR-scanned), not just primary text                      | Gates apply to pixels, not just the copy field                                      | Same conditions as B1/B2/B4                                                                                              |

### 3.2 REQUIRED disclosures — must render or publish is blocked

| #   | Disclosure                                                                                                                                                                                | Where                                                                   | Condition                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| D1  | Advertiser legal name (`brand_kit.legal_entity`) + "Paid for by"                                                                                                                          | Every ad's footer/disclaimer field                                      | Always                                                           |
| D2  | Savings qualifier: "Estimate based on average usage; actual savings vary."                                                                                                                | Same creative as any savings claim                                      | Whenever any savings figure/claim appears                        |
| D3  | Finance terms: APR, term, total cost (`finance_terms`)                                                                                                                                    | Same creative + linked landing page                                     | Whenever B2 condition is used (any "$0 down"/financing language) |
| D4  | ITC qualifier: "You may qualify for a federal tax credit; consult a tax advisor. Not tax advice."                                                                                         | Same creative as any incentive mention                                  | Whenever `incentives.federal_itc.mention=true`                   |
| D5  | Contractor license # (`brand_kit.licenses`)                                                                                                                                               | Landing page minimum; ad footer where state requires (e.g., AZ, NV, CA) | Region/state-conditional                                         |
| D6  | **US**: state charitable/solicitation rules N/A; **AU**: CEC signatory line "Approved under the New Energy Tech Consumer Code" + cooling-off notice; **SG**: cooling-off where applicable | Landing page + ad footer                                                | Region-conditional (AU/SG)                                       |
| D7  | Cooling-off / no-obligation line: "Booking a quote is free and no-obligation."                                                                                                            | Landing page hook + lead form                                           | Always (reduces deceptive-inducement risk + lifts opt-in)        |

### 3.3 Gate mechanics

- **Pre-generation guard:** the copy model is system-prompted with the blocklist so it avoids B-patterns at source; the gate is the independent verifier, not the only line of defense.
- **Two-pass scan:** (1) deterministic stem/regex match over all text fields; (2) OCR pass over rendered image/video frames (B10) so banned claims can't sneak in as pixels.
- **Provenance:** every approved asset is stamped **C2PA**; a creative without provenance cannot be queued.
- **Legal-hold:** any artifact touching B4/B7/B9 (the "argue-able" ones) routes to a `legal_hold` queue with the evidence_ref attached for human sign-off before delivery. B1/B3/B6/B8 are non-negotiable hard blocks.
- **Audit:** each gate decision (`pass`/`block`/`hold`) is one append-only, hash-chained record: `{artifact_hash, rule_id, decision, reviewer, ts}`. This is the regulator-facing evidence trail.
- **Per-org AI budget cap** is checked before any generative call; over-cap returns `BLOCKED: budget` (not a silent spend).

## 4. Generation steps

Orchestrated as governed sub-steps; each generative dispatch is audit-logged. Steps 4.1–4.6 produce the campaign object; nothing is delivered until §3 passes on **all** artifacts.

**4.0 Context load (hub-and-spoke).** Call `product-marketing-context` for `org_id` → pull positioning, voice, approved-claims library, prior-pass learnings for this market. Refuse if absent.

**4.1 Audience build (geo + lookalike, cross-platform).**

- **Geo layer (all platforms):** convert `territory.geo_values`/polygon into each platform's geo primitive — Meta = pin-drop radius or zip list, Google = location targeting (zip/radius) + "people in / regularly in this location" (never "interested in"), TikTok = region/zip targeting. Apply `audience_profile` (owner-occupied, detached, income, age). Attach suppression: recent installers, DNC, existing customers.
- **Lookalike layer:** seed = `lookalike_seed` (hashed prior converts for this client/region). Build LAL 1–3% on Meta and a Similar-audience equivalent on Google/TikTok, **constrained to the territory geo** (LAL ∩ geo) so spend stays inside the patch the field team will walk.
- **Frequency plan:** target ~3–5 impressions/household across the 7 days pre-knock; cap to avoid fatigue.
- **PII boundary:** hashing + custom-audience upload happen **in-region**; raw PII never crosses US/AU/SG. Hashed audiences are idempotent (same seed → same audience id; re-runs don't duplicate).

**4.2 Ad copy angles (compliance-safe by construction).** Generate 6–8 candidates across these angles, all written to clear §3:

- **Local proof:** neighbors in the named market already went solar (community signal).
- **Rate-control / certainty:** lock predictable energy costs vs. rising utility rates (cite `utility_avg_rate_cited`, qualified).
- **No-obligation quote:** the soft CTA — "see your numbers," free, no pressure (D7).
- **Incentive-awareness (qualified):** "you may qualify for incentives" + D4, never "free government money."
- **Heads-up / pre-knock honesty:** "A local SunRidge advisor will be in [market] this week" — primes the door, ethical and conversion-positive.
  Each candidate is emitted with its required disclosures pre-attached so the gate sees a complete unit.

**4.3 Image / video creative direction.**

- **Image (FLUX/Ideogram):** real-looking suburban rooftops consistent with the **local** roof/architecture style; daytime; client palette (`brand_kit.palette`); logo lockup; **any text overlay restricted to approved-claims language** (overlay text is OCR-gated, B10). No stock "money raining" / "free" badges. C2PA stamp on export.
- **Video (Runway/HeyGen):** 9–15s vertical. Script = one angle from 4.2 + spoken disclosure or on-screen disclosure card (D1/D2). HeyGen avatar permitted as a "local advisor" only with a real-name/role consistent with the field team; no fake testimonials, no fabricated savings figures on screen.
- **Localization:** insert `market_label` and (if cleared) the utility name to make the patch feel addressed, not blasted.

**4.4 Landing-page hook.** Single-purpose page, matched to the warm-up promise:

- Hero = rate-control / local-proof angle (mirrors the winning ad), sub-head with D2/D7.
- Primary action = **book a no-obligation quote** (date/time → routes to call centre + flags the address for the knock route). Secondary = "what to expect when our advisor visits."
- Footer renders **D1, D3 (if financing), D4, D5, D6** — the full disclosure stack lives here even when an ad only carries the short form.
- Form captures consent + region; lead is written idempotently and tagged `source: warmup`, `territory_id`, joinable to attribution.

**4.5 Retargeting audience (knocked-not-converted).** _(prior_passes>0, or post-first-knock)_

- Field app + call centre emit a **knocked-not-converted** event per address/contact (status: `knocked_no_sale`, `not_home`, `callback_pending`).
- Hash contact identifiers **in-region** → build/refresh a custom audience per platform; tagged so a re-engaged click **returns as a tagged lead** (`source: retarget`, original `door_id`) back into the call-centre queue — closing the loop instead of leaking the spend.
- Copy shifts to gentle re-engagement (objection-aware: "still thinking it over? here's your estimate, no pressure" + D2/D7). Same §3 gates apply. Auto-suppress anyone who later converts.

**4.6 Assemble + gate + queue.** Build the campaign object (campaigns/ad-sets/ads per platform), run §3 across **every** artifact incl. OCR pass, attach C2PA + disclosures, write the audit chain, check AI-budget cap, then queue idempotently for delivery (re-running compose with the same `territory.id` updates, never duplicates).

## 5. Example ad variants

Region = US. `offer.finance.present=true` (loan, 6.99% APR / 240mo), `savings_basis.evidence_ref` present, `incentives.federal_itc.mention=true`. Advertiser = "SunRidge Solar LLC".

### 5.1 PASS — Local proof + no-obligation

- **Headline:** Foothills homeowners are going solar this season
- **Primary text:** Your neighbors in the Tucson NE foothills are switching to solar to get ahead of rising TEP rates. See your custom estimate — it's free and no-obligation. You may qualify for a federal tax credit; consult a tax advisor.
- **CTA:** Get my free estimate
- _Passes:_ no B-pattern; D2 (qualifier on landing + implied), D4 (ITC qualifier), D7 (no-obligation), D1 in footer. ITC stated as "may qualify."

### 5.2 PASS — Rate certainty (substantiated)

- **Headline:** Lock in predictable energy costs
- **Primary text:** TEP residential power averages $0.146/kWh and tends to climb. Modeled solar can lower what you buy from the grid. Estimate based on average usage; actual savings vary. Book a free, no-pressure quote.
- **CTA:** See my numbers
- _Passes:_ savings claim is modeled + qualified (D2), cites the substantiated baseline (`evidence_ref`), no absolute/guarantee language, no B3/B4. "lower what you buy from the grid" avoids "eliminate your bill."

### 5.3 PASS — Financing stated correctly (B2 condition met)

- **Headline:** Own your system — financing available
- **Primary text:** Go solar with $0 down. Financing: 6.99% APR for 240 months; total financed cost shown before you sign, through Acme Financing Inc. Paid for by SunRidge Solar LLC. Free, no-obligation quote.
- **CTA:** Check my options
- _Passes:_ "$0 down" (B2) allowed **because** APR + term + lender + total-cost are present in the same unit (D3) and `finance.present=true`. D1 rendered. No B8 ("approved") language.

### 5.4 PASS — Pre-knock heads-up

- **Headline:** A local solar advisor will be in your neighborhood this week
- **Primary text:** A SunRidge advisor is visiting the Tucson NE foothills this week with free, no-obligation solar estimates. Prefer to book a time instead? Tap below. Paid for by SunRidge Solar LLC.
- **CTA:** Book a time
- _Passes:_ ethical pre-warm, no claims to substantiate, D1 + D7 present, no urgency/B7.

### 5.5 FAIL — "free solar"

- **Headline:** Get FREE solar panels installed
- **Primary text:** Government program pays for your panels — $0 down, no more electric bills, guaranteed savings!
- **CTA:** Claim free solar
- **❌ Blocked — reasons:** **B1** ("free solar"), **B6** ("government program pays"), **B2** ("$0 down" with no finance terms rendered), **B3** ("no more electric bills"), **B4** ("guaranteed savings", no evidence). Four hard blocks; non-overridable. Routed nowhere — must be rewritten.

### 5.6 FAIL — false urgency + unsubstantiated figure

- **Headline:** Solar tax credit ENDS TONIGHT — act now
- **Primary text:** Save $250/month, guaranteed. You're pre-approved. Don't miss your last chance for free government money.
- **CTA:** Lock in before midnight
- **❌ Blocked — reasons:** **B7** (false deadline, no verifiable date in `offer`), **B9** ("$250/month" with no `evidence_ref`), **B4** ("guaranteed"), **B8** ("pre-approved" — a credit decision D2D can't represent), **B6** ("free government money"). Missing **D2/D4**. Hard block + legal-hold on the savings figure.

## 6. Outputs + how results feed the loop

### 6.1 Campaign object (returned + persisted, tenant-scoped, hash-chained)

```yaml
campaign:
  id: CMP-2026-0603-TERR-2026-0418-AZ-TUC-NE
  territory_id: TERR-2026-0418-AZ-TUC-NE
  loop_stage: MARKET
  platforms:
    meta:   { campaign_id, adsets:[geo, lal_geo], ads:[5.1,5.2,5.3,5.4], audiences:[geo_id, lal_1_3_id] }
    google: { campaign_id, geo_targeting, similar_audience_id, rsa_assets }
    tiktok: { campaign_id, region_targeting, similar_audience_id, video_assets }
  creatives: [ {asset_hash, c2pa_id, gate:PASS, disclosures:[D1,D2,D4]} , ... ]
  blocked:   [ {asset_hash, rules:[B1,B6,B2,B3,B4], status:BLOCKED}, {…B7,B9,B4,B8,B6…} ]
  landing_page: { url, variant, disclosures:[D1,D3,D4,D5,D7] }
  retarget_audience: { knocked_not_converted_id (refresh: per-event), tag: source=retarget }
  frequency_plan: { target_imp_per_hh: 4, window: 2026-06-12..06-26 }
  audit_chain_head: sha256:…
  ai_budget: { spent_cents, cap_cents, status: OK }
```

### 6.2 Attribution feed

Every downstream event carries `territory_id` + `campaign_id` as join keys, producing a closed-loop record per territory:

- **Pre-warm exposure** (impressions/reach/frequency, by zip) → **door-level outcome** (knocked / opened / sold / callback) from the field app → **call-centre** 7-day close outcome → **warm-up-attributable conversions** (lead `source=warmup` or `source=retarget` that became a sale).
- Computes per-territory: **lift** (door-open + close rate vs. cold baseline / prior pass), **cost per booked quote**, **cost per install**, **retarget recovery rate** (knocked-not-converted who converted after retargeting).
- Persisted append-only so the same numbers reproduce in any stakeholder report (no changelog — current facts only).

### 6.3 How it trains the NEXT area's targeting

- **Winning angle + creative** (by CTR→booked-quote→install, not just clicks) are written back to `product-marketing-context` as the org's solar priors → next territory's 4.2/4.3 start from proven copy.
- **Converting audience traits** (the actual buyers' geo/demographic signal) refresh the **lookalike seed** → tighter LAL for the next patch.
- **Best frequency / lead-time** (days of pre-warm that maximized door-open lift) tune the next `knock_window` offset.
- **Block patterns that recurred** feed the pre-generation system prompt so future drafts avoid them at source (skill-curation loop: each run sharpens the next).

## 7. Related skills

- **product-marketing-context** — hub skill; load org positioning/voice/approved-claims **before** this runs (hard dependency).
- **ad-creative** — bulk headline/primary-text variation engine this skill calls for copy generation.
- **paid-ads** — cross-platform campaign structure, bidding, and budget pacing that wraps the audiences built here.
- **image** / **video** — creative generation (FLUX/Ideogram, Runway/HeyGen) used in 4.3, C2PA-stamped.
- **page-cro** / **form-cro** — optimize the 4.4 landing-page hook + no-obligation lead form for booked-quote rate.
- **compliance-check** + **constitutional-critique** — independent verifier behind §3 gates and legal-hold routing for high-stakes claims.
- **agent-governance** + **agent-audit-log** — ALWAYS-on dispatch governance + the append-only record every step writes to.
- **pii-first-design** + **pii-tagger** — region-pinned hashing + classification for audience uploads and lead capture.
- **analytics-tracking** — wires the §6.2 attribution events (UTM/territory_id/campaign_id) end-to-end.
- **Sibling vertical campaign skills** — `charity-territory-warmup`, `pest-control-territory-warmup`, `energy-telco-territory-warmup` (same loop + warm-up pattern, **different gate packs**).
