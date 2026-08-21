# Campaign: Residential Pest Control (Pre-Knock "Warm the Area")

> **Loop position:** `MARKET` → KNOCK → CALL CENTRE → RETARGET → CONVERT → COMMISSION.
> This skill owns the **MARKET** stage for the pest-control vertical: geo-targeted ads that
> warm a _named territory_ in the **3–7 days before** the field team arrives, so doors open
> warmer and the call centre has air cover. Every artifact it emits is tagged with the
> `territory_id` and `campaign_id` so KNOCK / CALL / RETARGET inherit attribution, and the
> post-mortem trains the **next** area's targeting.

---

## 1. Trigger + When To Use

**Slash:** `/campaign-pest-control <territory_id | suburb | ZIP/postcode>`
**Natural language:** "warm Carindale for the pest crew next week", "pre-knock pest campaign
for ZIP 85048", "soften the Westside route before Tuesday".

**Use when ALL of the following hold:**

- A pest-control **client tenant** is live (dedicated, audit-grade, RLS-scoped) and the client
  has handed D2D a **territory** with a **knock window** (the date range the field team works it).
- The territory has a **`territory_id`** in `territory-planner` (boundary polygon + region pin).
- The client's **brand kit** and **at least one compliant offer** exist in the tenant.
- You are running the **MARKET** stage — i.e. you want demand-side warming, _not_ a knock list.

**Do NOT use when:**

- The vertical is solar, energy/telco, alarms, roofing, or charity → use the matching
  `campaign-*` skill. Pest gates (APVMA/EPA chemical disclosure, health-claim block) are
  vertical-specific and will incorrectly pass/fail other verticals.
- You only need a **retargeting** pass on already-knocked doors → call
  `retargeting-audience-builder` directly (this skill _seeds_ that audience but does not own it).
- The client wants a **claim that cannot be substantiated** (e.g. "kills 100% of termites
  forever") → the gate will block; do not attempt to launder it through creative.
- **Termite / structural / WDO (wood-destroying organism) inspection offers** that imply a
  building is "termite-free" or "safe" → these carry building-defect + duty-of-disclosure risk.
  Route to `legal-hold` for client legal sign-off before this skill will publish.

**Pre-flight (HARD):** This skill **MUST** call `campaign-context` first (Section 3). It will not
generate creative without product/audience/positioning + region + the client's active offer.

---

## 2. Required Inputs

All inputs are tenant-scoped and resolved by ID from the client tenant. Missing a **HARD**
input aborts before any generation (and any chemical/claim field is itself gated in Section 4).

| Group                   | Field                  | Req             | Notes                                                                                                                                                                              |
| ----------------------- | ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Territory**           | `territory_id`         | HARD            | Resolves boundary polygon + `region` (US/AU/SG) from `territory-planner`.                                                                                                          |
|                         | `knock_window`         | HARD            | `{start,end}` dates the field team works it. Ad flight = `knock_window.start − 5d` → `knock_window.end`.                                                                           |
|                         | `radius_or_polygon`    | HARD            | Polygon preferred; else center + radius (cap 8 km / 5 mi to keep spend on-route).                                                                                                  |
|                         | `route_density`        | soft            | Doors/day planned — sizes the warming budget so reach ≈ planned knocks ×N.                                                                                                         |
|                         | `local_pest_pressure`  | soft            | Season/region signal (e.g. AU summer: ants/cockroaches/mosquitoes/spiders/termites; US Sun Belt: scorpions/ants/roaches). Drives angle selection, NEVER a health claim.            |
| **Demographics**        | `audience_profile`     | HARD            | Homeowner skew, dwelling type (detached/townhouse), tenure, HH income band, life-stage. Renters down-weighted (decision-maker mismatch).                                           |
|                         | `language_locale`      | soft            | e.g. `en-US`, `en-AU`; spawns localized variants.                                                                                                                                  |
|                         | `exclusions`           | HARD-default    | Auto-excludes <18; excludes health/medical interest segments (gate, Section 4).                                                                                                    |
| **Brand kit**           | `brand_kit_id`         | HARD            | Logo lockups, palette, fonts, tone, legal entity name, **license/registration numbers** (e.g. pest-control business license / AU pesticide licence), approved disclaimer block.    |
|                         | `brand_voice`          | soft            | Defaults to calm-professional, reassurance-led (no shock/disgust).                                                                                                                 |
| **Offer**               | `offer_id`             | HARD            | The promoted offer. MUST carry substantiation refs (Section 4).                                                                                                                    |
|                         | `offer_terms`          | HARD            | Price, what's included, contract length, cancellation, "from $" basis, any guarantee scope + its real terms.                                                                       |
|                         | `service_guarantee`    | soft            | If a re-service/"come-back-free" guarantee exists, its **exact** terms (re-treatment ≠ eradication guarantee).                                                                     |
| **Product / chemistry** | `treatment_products[]` | HARD-if-claimed | Each product's **registered name + active constituent + AU APVMA reg-no / US EPA reg-no**. Required whenever creative names/implies a specific chemical, "treatment", or efficacy. |
| **Ops**                 | `attribution_keys`     | HARD            | `{tenant_id, client_id, territory_id, campaign_id}` stamped on every asset, UTM, audience, pixel/CAPI event.                                                                       |
|                         | `ai_budget_cap`        | HARD            | Per-org AI spend cap (gen + media). Generation halts at cap; logs to `agent-audit-log`.                                                                                            |
|                         | `channels[]`           | soft            | Subset of `{meta, google, tiktok}`. Default all three; TikTok auto-dropped where client policy or region disallows.                                                                |

---

## 3. Foundational Context (read FIRST — hub-and-spoke)

Before any audience, copy, or creative work, **call `campaign-context`** (the foundational
spoke every D2D campaign skill checks first) and load, for THIS client tenant:

1. **Product & positioning** — services offered (general pest, ants, roaches, spiders, rodents,
   termites/WDO), service model (one-off vs recurring/quarterly), warranty/guarantee posture.
2. **Audience truth** — who actually converts on doors in this region; objection patterns
   ("is it safe around kids/pets?", "do I have to leave the house?", price).
3. **Voice & no-go list** — banned words/claims the client legal team has already vetoed.
4. **Region** — drives the **legal regime switch**: AU ⇒ APVMA + ACL; US ⇒ EPA + FTC; SG ⇒ NEA.
5. **Active offer + substantiation library** — the evidence backing any claim (label data,
   service-guarantee terms, "from $" basis).

If `campaign-context` lacks any of the above, **stop and request it**; do not infer chemistry,
guarantees, or efficacy. Inference here is a compliance incident, not a creativity shortcut.

---

## 4. Brand-Safety / Compliance Gates (HARD — block publish)

> These gates run in `brand-safety-gate` against **every** generated asset (headline, primary
> text, description, image, video script, on-screen text, landing hook). **Any** failure sets
> `gate_status = BLOCKED` and the asset **cannot** be delivered to Meta/Google/TikTok. Gates are
> evaluated by a governed agent; the dispatch + verdict are written to `agent-audit-log`, and
> high-stakes ambiguity escalates to `constitutional-critique`. **Fail-closed**: if a claim's
> substantiation cannot be resolved, it is treated as failing.

### 4.1 Regime switch (by `region`)

- **AU:** Australian Consumer Law (ACL) — no misleading/deceptive conduct; all efficacy/price
  claims substantiated. **APVMA**: only registered products; **disclose the active constituent
  (chemical name) + APVMA registration number** wherever a product/treatment efficacy is claimed.
- **US:** **FTC Act §5** (substantiation; no deceptive claims) + **FIFRA/EPA** — only
  EPA-registered products may be advertised with pesticidal claims; **no claims inconsistent with
  the registered label**; disclose **EPA registration number** when a product/efficacy is named.
- **SG:** **NEA** vector-control/pesticide framework — licensed operator + registered products.

### 4.2 HARD BLOCKLIST (publish blocked if matched, case/inflection-insensitive)

**A. Health / disease claims (ZERO tolerance):**

- "prevents/stops/protects against **disease**", "**disease-carrying**", "**health hazard /
  health risk** to your family", "stops **Lyme / Zika / dengue / Ross River / hantavirus /
  Hendra / asthma / allergies**", "protects your **family's health**", "**sanitize / sterilize**
  your home", "**germ-free**", any implication the service is a **medical/health** intervention.
- Reason: pest control is not a medical service; disease-prevention claims are unsubstantiated,
  high-harm, and outside ACL/FTC substantiation tolerance and the registered label.

**B. Absolute / permanence / guarantee-of-result claims:**

- "**100%**", "**permanent / forever / for life**", "**total / complete / guaranteed
  eradication**", "**never see a bug again**", "**eliminate ALL pests**", "**termite-proof**",
  "**we kill everything**".
- Reason: unverifiable; ACL/FTC misleading. A **re-service guarantee** ("free re-treatment within
  the service period") is allowed **only** stated as a _service_ term — never as eradication.

**C. Safety mischaracterization:**

- "**100% safe**", "**completely safe**", "**non-toxic**" (when products are registered
  pesticides), "**chemical-free**" (when chemicals are used), "**harmless**", "**totally safe for
  kids & pets**" as an unqualified absolute.
- Allowed instead: factual, label-consistent phrasing — e.g. _"licensed, registered products
  applied by trained technicians; follow re-entry guidance on the label"_ — paired with the
  required disclosure (4.3).

**D. Fear / disgust / shock creative:**

- Gore, infestation "horror" imagery, extreme close-up swarms designed to disgust, dehumanizing
  scare copy ("your home is **crawling** / **infested** / a **breeding ground**"), exploitation
  of fear for kids' safety. Reason: platform shock-content policy + brand safety + ACL "undue
  pressure". Tone = calm reassurance.

**E. Audience / targeting violations:**

- Any audience including **under-18**; any **health/medical condition** interest or inferred
  sensitive segment (allergy sufferers, immunocompromised, pregnancy); ethnicity/religion
  proxies. Special-ad-category-style restraint applied even where not platform-mandated, per
  D2D governance.

**F. Misuse / DIY-danger:**

- Any copy instructing consumers to **apply, mix, or handle pesticides** themselves, or naming
  application **rates/dilutions**. Reason: off-label-use facilitation under FIFRA/APVMA.

**G. Price/offer deception:**

- "**free**" treatment with undisclosed contract lock-in; "**from $X**" without the real basis;
  unqualified "**lowest price**"; countdown/"only today" urgency that isn't true.

### 4.3 REQUIRED DISCLOSURES (must be PRESENT or asset is blocked)

1. **Advertiser identity** — legal entity + that it's a paid ad under the client's brand.
2. **Licence/registration** — pest-control business **licence number** (region-appropriate) in
   landing page footer; on-ad where space allows.
3. **Chemical disclosure (gate-critical)** — whenever an ad/landing page **names or implies a
   specific product or its efficacy**, disclose the **active constituent (chemical name)** and
   **APVMA reg-no (AU) / EPA reg-no (US)**. If creative makes only a _general_ service offer with
   **no** product/efficacy claim, a product-name disclosure isn't triggered — but the safety/
   substantiation gates still apply.
4. **Claim substantiation pointer** — every efficacy/savings/price claim links to an entry in the
   client substantiation library (`offer_id` → evidence ref). No evidence ⇒ claim stripped/blocked.
5. **Offer terms** — price basis, inclusions, contract length, cancellation, guarantee _scope_
   (re-service vs result).
6. **Safety/use guidance** — direct to follow label re-entry guidance; no DIY application copy.
7. **C2PA provenance** — all AI image/video signed with content credentials; unsigned synthetic
   media is **blocked** from delivery (`creative-provenance-c2pa`).
8. **Privacy** — landing page consent + privacy link; data region-pinned (PII never leaves region).

### 4.4 Gate evaluation order (fail-closed)

```
load asset
  → regime switch (region)
  → BLOCKLIST scan A–G        (any hit ⇒ BLOCKED + reason)
  → DISCLOSURE presence 1–8   (any missing ⇒ BLOCKED + reason)
  → substantiation resolve    (unresolved claim ⇒ BLOCKED)
  → C2PA signature check      (unsigned synthetic ⇒ BLOCKED)
  → audience-policy check (E) (under-18 / sensitive ⇒ BLOCKED)
  → constitutional-critique   (if ambiguous/high-stakes)
  → PASS ⇒ gate_status=CLEARED, sign, eligible to deliver
  → write verdict (asset_hash, rule_ids, verdict) to agent-audit-log (hash-chained)
```

---

## 5. Generation Steps

Orchestrated by `services/marketing` (delivery) + `services/content-studio` (creative). Every
agent dispatch is governed + audit-logged. Money/budgets handled as BigInt cents.

### Step 0 — Context + guardrail load

Call `campaign-context` (Section 3). Pull `region`, offer, substantiation library, voice/no-go,
and pre-load Section 4 rules so generation is **gate-aware** (cheaper to not generate violations
than to filter them).

### Step 1 — Audience build (geo + lookalike, per channel)

- **Geo (primary):** Constrain to `radius_or_polygon`. **Polygon/pin-drop** targeting where the
  channel supports it; else radius cap 8 km / 5 mi centered on route. Flight = knock_window − 5d.
- **Core demo overlay:** `audience_profile` (homeowner skew, detached-dwelling, tenure, income
  band, life-stage). **Renters down-weighted.** **Hard-exclude** under-18 + sensitive health
  segments (gate E).
- **Lookalikes (seed = converters, NOT raw PII):**
  - **Meta:** 1–3% LAL from a **hashed** custom audience of prior-territory **converters**, region-pinned, constrained to the polygon.
  - **Google:** Customer Match (hashed) → similar segments + in-market "Pest Control Services", geo-fenced.
  - **TikTok:** LAL from hashed converter list; auto-dropped if region/client policy disallows.
- **Cross-territory learning:** seed weights come from `attribution-loopback` (which prior-area
  features predicted door-conversion). **Suppress** existing customers + open opportunities.
- **Provenance:** seed lists are hashed, region-pinned, IDs only; never export raw PII to a platform.

### Step 2 — Ad copy angles (gate-aware; pick 3–4 to ship)

All angles avoid health/permanence/safety-absolute language by construction:

1. **Local + seasonal** — "Pest season's here on the <suburb> side." (Season as _timing_, never disease.)
2. **Heads-up / pre-knock priming** — "Our local pest team is in <suburb> this week." (Warms the knock; raises door-open rate.)
3. **Reassurance / process** — "Licensed technicians, registered products, clear pricing." (Directly answers the safety objection without claiming "100% safe".)
4. **Offer / value** — "First service from $<X> — re-service free within your plan period." (Real terms; guarantee = service, not result.)
5. **Pets & family considerate** — "We treat with pets & kids in mind — applied by trained techs, follow simple re-entry guidance." (Label-consistent; NOT "100% safe".)
6. **Social proof / local** — "<N> <suburb> homes serviced this season." (Only if substantiated.)

### Step 3 — Image / video creative direction

- **Visual system (EazePay DNA):** navy base, Inter (display) + JetBrains Mono (data/price/reg-no
  chips); clean, trustworthy, **no glass, no aurora**, no gradients-for-drama.
- **Image (FLUX / Ideogram):** uniformed technician at a tidy suburban home; family/pet present
  _relaxed and at ease_ (reassurance, never peril); branded van/badge; legible price + disclosure
  chip. **Banned:** bug close-ups meant to disgust, infestation scenes, hazmat-style fear framing.
- **Video (Runway / HeyGen, 9–15s):** hook (local + seasonal) → trust beat (licensed, registered)
  → offer (from $X, re-service term) → CTA. On-screen disclosure chip (chemical name + reg-no when
  a product is shown) persists. **HeyGen avatar / AI footage ⇒ C2PA-signed**, else blocked.
- **Per-channel cuts:** 1:1 + 4:5 (Meta), 16:9 + responsive (Google Demand Gen/PMax), 9:16 (TikTok).
- **Provenance:** every synthetic asset signed; unsigned = blocked (4.3 #7).

### Step 4 — Landing-page hook (warm → capture)

- **Above the fold:** location-matched headline ("<Suburb> pest control — book your visit"),
  reassurance subhead (licensed + registered, transparent pricing), single primary CTA
  (**Book / Get a quote / Request a callback**) feeding the **call centre** within 7 days.
- **Trust block:** licence/reg numbers, service-guarantee _scope_, "what to expect on the day"
  (incl. follow label re-entry guidance).
- **Disclosure footer (gated):** entity, licence no., chemical name + APVMA/EPA reg-no (if a
  product is named), offer terms, privacy/consent, paid-ad identity.
- **Instrumentation:** UTM = `{campaign_id, territory_id, channel, variant}`; pixel/CAPI fires
  `LeadSubmitted` (hashed, region-pinned) → idempotent POST to tenant; routes to inside-sales queue.
- **Region pin:** page + form data resident in the territory's region; PII never crosses region.

### Step 5 — Retargeting seed (knocked-not-converted → tagged lead)

This skill **provisions the structure** that `retargeting-audience-builder` fills once KNOCK runs:

- After the field team works the window, **knocked-not-converted** doors (consent-captured) are
  **hashed** → **custom audience**, region-pinned, scoped to `territory_id`.
- Retargeting flight runs the **CALL-CENTRE 7-day** window: reassurance + offer-reminder creative
  (same gates), re-engaging non-converts; a click/booking **returns as a tagged lead** to the
  inside-sales queue (idempotent), attributed to the original `territory_id`.
- **Suppressions:** converted, opted-out, do-not-knock, existing customers.

### Step 6 — Gate, sign, schedule

Run **every** asset through `brand-safety-gate` (Section 4). CLEARED-only assets are C2PA-signed
and scheduled to the flight. **BLOCKED** assets return to Step 2/3 with the failing `rule_id`.
Full run (inputs hash, assets, verdicts, spend plan) is written hash-chained to `agent-audit-log`.

---

## 6. On-Brand Example Ad Variants

> Region shown = **AU** (APVMA). For **US**, swap the disclosure to **EPA Reg. No.** and FTC
> substantiation. `{...}` = tenant/offer values resolved at generation; reg-no shown because a
> product/treatment is named.

### PASS 1 — Pre-knock priming (Meta, 4:5)

- **Headline:** Our local pest team is in {Carindale} this week
- **Primary text:** Seeing more ants and spiders as the weather warms? Our licensed technicians
  are working the {Carindale} area this week. Registered products, trained techs, clear pricing —
  first general pest service from ${129}, with free re-service within your plan period. Tap to book
  a visit or request a callback.
- **CTA:** Book a visit
- **Disclosure chip:** {Entity Pty Ltd}, Pest Control Licence {###}. Treatment: {Active Constituent}
  — APVMA Reg. No. {#####}. Offer terms apply.
- _Why it passes:_ season-as-timing (no disease), no permanence/safety-absolute, real offer +
  guarantee scope, chemical + reg-no disclosed, calm tone, books to call centre.

### PASS 2 — Reassurance / process (Google Demand Gen, 1:1 + 16:9)

- **Headline:** Pest control done properly in {Carindale}
- **Primary text:** Licensed technicians. Registered products applied to label. Transparent
  pricing with no surprises — and free re-service within your plan period if pests come back.
  Get a quote for your home today.
- **CTA:** Get a quote
- **Disclosure chip:** {Entity}. Licence {###}. Products registered with the APVMA; active
  constituent + Reg. No. on request/landing page. Terms apply.
- _Why it passes:_ answers the safety objection factually (not "100% safe"), re-service framed as
  _service_ term, substantiation pointer present, no shock imagery.

### PASS 3 — Pets & family considerate (TikTok, 9:16, HeyGen + C2PA)

- **Headline:** Treating your {Carindale} home with pets & kids in mind
- **Primary text:** Our trained technicians use registered products and walk you through simple
  re-entry guidance on the day, so you know exactly what to expect. First service from ${129}.
  Book online in two minutes.
- **CTA:** Book online
- **Disclosure chip:** {Entity}, Licence {###}. {Active Constituent} — APVMA Reg. No. {#####}.
  Follow product label directions. C2PA-signed.
- _Why it passes:_ "with pets & kids in mind" + "follow re-entry guidance" is label-consistent and
  avoids "100% safe / non-toxic"; AI video is provenance-signed.

### PASS 4 — Local + seasonal value (Meta, 1:1)

- **Headline:** {Carindale} pest season — get ahead of it
- **Primary text:** Warmer months mean more ants, cockroaches and spiders around the home. Book a
  general pest service from ${129} with {Entity}'s licensed local team. Free re-service within your
  plan period. Limited visit slots while we're in your area this week.
- **CTA:** Book a visit
- **Disclosure chip:** {Entity}, Licence {###}. Treatment: {Active Constituent} — APVMA Reg. No.
  {#####}. Offer & guarantee terms apply.
- _Why it passes:_ scarcity is _true_ (route is in-area that week), no health claim, guarantee =
  service, chemical + reg-no disclosed.

---

## 7. FAIL Examples (blocked — with reason)

### FAIL 1 — Health claim + permanence + safety-absolute (multi-gate)

- **Headline:** Protect your family's health — eliminate ALL disease-carrying pests for good
- **Primary text:** Our 100% safe, non-toxic treatment permanently kills every pest and stops the
  germs that make your kids sick. Guaranteed total eradication or it's free!
- **CTA:** Eliminate pests forever
- **BLOCKED — rule hits:**
  - **4.2.A** "family's health", "disease-carrying", "germs that make your kids sick" — health/
    disease claim (zero tolerance).
  - **4.2.B** "eliminate ALL", "permanently", "every pest", "total eradication", "forever" — absolute/permanence.
  - **4.2.C** "100% safe", "non-toxic" (registered pesticide) — safety mischaracterization.
  - **4.3 #3** no chemical name / APVMA reg-no despite efficacy claims.
  - _Verdict:_ BLOCKED, returned to Step 2; cannot be reworded to pass — the _claims themselves_
    are unsubstantiable.

### FAIL 2 — Fear/disgust shock + DIY misuse + fake urgency

- **Headline:** Your home is CRAWLING with filth — see what's hiding in your walls 🐜🤢
- **Primary text:** This infestation could be breeding RIGHT NOW. Don't wait — grab our pro-grade
  poison and spray it yourself today. ⏰ Offer ends in 1 hour!
- **CTA:** Spray it yourself now
- **BLOCKED — rule hits:**
  - **4.2.D** "CRAWLING with filth", disgust emoji, "infestation breeding right now" — fear/disgust shock.
  - **4.2.F** "grab our pro-grade poison and spray it yourself" — DIY pesticide-misuse facilitation (FIFRA/APVMA).
  - **4.2.G** "Offer ends in 1 hour" with no real basis — false urgency.
  - **4.3 #6** instructs consumer self-application — banned.
  - _Verdict:_ BLOCKED; tone + DIY instruction are disqualifying regardless of offer accuracy.

---

## 8. Outputs

Returned to `services/marketing` and persisted on the tenant (RLS, region-pinned), all stamped
with `attribution_keys`:

1. **Campaign package** — per-channel campaign/ad-set/ad structures (Meta/Google/TikTok), each
   `gate_status=CLEARED`, C2PA-signed, with flight = `knock_window − 5d → knock_window.end`.
2. **Audience manifest** — geo (polygon/radius) + demo overlay + lookalike specs; hashed seed refs
   (IDs only); suppression lists. Region-pinned.
3. **Creative set** — copy variants (headline/primary/CTA/disclosure), image + video assets with
   content credentials; mapping of each asset → cleared `rule_ids`.
4. **Landing page** — deployed variant(s) with UTM + pixel/CAPI wiring; disclosure footer; consent.
5. **Retargeting seed spec** — the knocked-not-converted audience definition for
   `retargeting-audience-builder` to populate post-KNOCK (custom audience, 7-day CALL window).
6. **Gate report** — every asset's verdict + `rule_ids` + substantiation refs (SOC 2 evidence).
7. **Audit record** — hash-chained `agent-audit-log` entry: inputs hash, dispatches, governance
   verdicts, spend plan (BigInt cents), C2PA signatures.
8. **Budget ledger** — planned vs cap (BigInt cents); halt event if `ai_budget_cap` hit.

---

## 9. Attribution + Loopback (feeds the next area)

Hand off to `attribution-loopback`:

- **Stamp continuity:** `campaign_id`/`territory_id` flow MARKET → KNOCK → CALL → RETARGET →
  CONVERT, so a commissionable conversion ties back to the warming spend that softened the door.
- **Pre-knock lift:** compare door-open / first-call-close rate in warmed vs control sub-areas to
  quantify warming's marginal effect (the value proof for the MARKET stage).
- **Channel/angle ROI:** CPL, knock→close lift, retarget recovery, blended CAC per channel/angle/
  creative — winning angles/creatives promoted, losers retired.
- **Next-area training:** converter features (geo, demo, dwelling, season, angle) feed the **next**
  territory's lookalike seed weights + angle ranking in Step 1. The loop compounds: each area's
  results sharpen the following area's targeting.
- **Compliance feedback:** any post-publish platform rejection or claim challenge updates the
  Section 4 blocklist/disclosure rules (continuous gate hardening).

---

## 10. Related Skills

- **`campaign-context`** — FOUNDATIONAL hub; read first, every run (product/audience/positioning/region/offer).
- **`territory-planner`** — owns `territory_id`, boundary polygons, region pins, knock windows.
- **`retargeting-audience-builder`** — populates the knocked-not-converted custom audience this skill seeds.
- **`landing-page-hook`** — shared landing builder (UTM/pixel/CAPI/consent) invoked in Step 4.
- **`brand-safety-gate`** — runs the Section 4 hard gates; shared enforcement engine.
- **`creative-provenance-c2pa`** — signs synthetic media; unsigned = blocked.
- **`attribution-loopback`** — closes the loop; trains the next area (Section 9).
- **`agent-governance` / `agent-audit-log` / `constitutional-critique`** — always-on governance,
  immutable audit, high-stakes critique for every dispatch in this skill.
- **Sibling vertical campaigns:** `campaign-solar`, `campaign-energy-telco`,
  `campaign-charity-fundraising` — same loop + gate architecture, different vertical regimes.

```

The complete skill is above as a single ready-to-save Markdown document. Suggested save path (absolute): `/Users/Brodie/d2d/services/marketing/skills/campaign-pest-control.md` (adjust to wherever the D2D Marketing Studio skills directory lives in the repo).

Key design choices, briefly:
- **Loop-native**: the skill explicitly owns the MARKET stage and stamps `territory_id`/`campaign_id` so KNOCK → CALL → RETARGET inherit attribution, with Section 9 feeding the next area.
- **Hub-and-spoke**: mandatory `campaign-context` pre-flight (the coreyhaines pattern), reframed for compliance — inference about chemistry/guarantees is treated as an incident.
- **Fail-closed gates**: Section 4 is an explicit blocklist (A–G) plus required disclosures (1–8) with an evaluation order; the APVMA/EPA chemical-name disclosure is the gate-critical, vertical-specific piece, and the region switch handles AU/US/SG.
- **Governance + provenance**: every dispatch is audit-logged, synthetic media is C2PA-signed-or-blocked, budgets are BigInt-cents-capped — matching the fintech engineering bar.
- The 4 PASS variants each clear the gates with real offer terms (re-service ≠ eradication) and chemical disclosure; the 2 FAIL variants are annotated with the exact `rule_id` hits.
```
