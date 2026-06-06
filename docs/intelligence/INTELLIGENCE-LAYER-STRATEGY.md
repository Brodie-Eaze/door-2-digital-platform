# Door 2 Digital — The Intelligence Layer ("Gotham for Doors")

> Strategy doc · 2026-06-05 · Grounded in an adversarially-verified deep-research pass (108 agents, 26 sources, 99 claims extracted, 25 verified, 9 confirmed / 16 killed). Claims marked **[VERIFIED]**, **[BETA]**, **[HORIZON]**, or **[UNVERIFIED — validate]**.
>
> The honesty rule applies hard here: the research **killed 16 of 25 claims**, including every property-data-aggregator coverage number (ATTOM "160M", Regrid "183M", BatchData "155M" all refuted 0-3). Vendor marketing does not survive contact. This doc separates what is real from what is a press release.

---

## 0. The thesis (the Thiel/Palantir lens)

Palantir's moat was never the ML. It was the **ontology** — the semantic layer that fuses heterogeneous, messy, real-world data into a single navigable model of reality — plus a **proprietary dataset that compounds**. Competitors could buy the same algorithms; they could not replicate the integrated data asset or the ontology that made it usable.

**The D2D equivalent of that moat is this:** door-to-door is the _only_ sales channel on earth where you simultaneously capture, for a single identified household:

1. **Ground-truth outcome** — they converted or they didn't (the label everyone else lacks)
2. **A recorded human conversation** — the objection, the hesitation, the close (what Gong has, but with no household context)
3. **Full demographic + property + neighbourhood context** — who they are, where they live, what's around them (what SPOTIO filters on, but with no conversation and no outcome)

**Nobody fuses all three.** Gong has conversations without doorstep context or D2D outcomes. SPOTIO **[VERIFIED]** has static household filters with _no ML propensity scoring and no outcome learning_ — their April 2026 "DASH AI" launch is voice-to-text workflow automation, not intelligence (confirmed 2-1; their own 2026 State of Field Sales report lists predictive forecasting as an _industry gap_, not a SPOTIO feature). The entire D2D category sits at static-filter maturity.

That gap is the company. Every knock D2D's team makes produces a labelled training row that **no competitor can buy, scrape, or replicate** — because it requires being physically at the door, recording the conversation, and observing the outcome. That is a dataset with a true network/flywheel effect: more knocks → smarter model → higher conversion → more knocks. The database becomes the most valuable asset on the balance sheet.

This is the vacuum effect. We are not building a CRM with AI features. We are building **the proprietary intelligence asset for in-person sales**, and the CRM is just the instrument that harvests it.

---

## 1. The three-layer architecture (the correct frame)

The research **[VERIFIED 3-0]** the industry framing of the modern AI stack as three tiers — **System of Record → System of Intelligence → System of Agency** — and confirmed that _no incumbent yet owns the middle tier for field sales_ (Snowflake/Cortex and Databricks/Unity Catalog are racing for it at the data-platform level; Palantir/Salesforce/Celonis from the app level; none has it for in-person sales).

Mapped to D2D:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 — SYSTEM OF AGENCY   (the output: what the rep does)     │
│  • Where-to-knock-next routing (propensity-ranked turf)           │
│  • Live in-ear coaching during the conversation                   │
│  • Auto-retarget non-converters across Meta/Google/TikTok         │
│  • Next-best-action for the call centre 7-day queue               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — SYSTEM OF INTELLIGENCE   ← THE MOAT. We own this.      │
│  • The Household Ontology (entity resolution across all sources)  │
│  • The Propensity Engine (P(convert | household, area, convo))    │
│  • The Conversation Intelligence pipeline (door + phone)          │
│  • Continuous learning loop — every outcome retrains the model    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1 — SYSTEM OF RECORD   (already built — PRs #1–#10)        │
│  • Knocks, leads, conversions, territories, call-centre, audit    │
│  • The instrument that captures the raw events at the door        │
└─────────────────────────────────────────────────────────────────┘
```

We already shipped Layer 1. **The entire strategic prize is Layer 2.** Layer 3 is the visible product; Layer 2 is the unfair advantage underneath it.

---

## 2. The data vacuum (the flywheel that compounds)

Every arrow below is a data-capture point. The whole point is that they all flow into ONE ontology and feed ONE continuously-learning model.

```
  Marketing campaign  ─┐
  (Meta/Google/TikTok) │
                       │
  Government + parcel  │      ┌──────────────────────┐
  + neighbourhood data ├────▶ │   HOUSEHOLD ONTOLOGY  │ ◀── entity resolution
                       │      │  (one record per      │     fuses every source
  The knock at the door│      │   physical household) │     to one household
  (GPS, photo, dispo)  │      └──────────┬───────────┘
                       │                 │
  THE CONVERSATION ────┤                 ▼
  (live audio → text → │      ┌──────────────────────┐
   intent + objection  │      │  PROPENSITY ENGINE    │
   + sentiment)        │      │  P(convert | features)│
                       │      └──────────┬───────────┘
  The phone call ──────┤                 │
  (call centre, same   │                 ▼
   convo pipeline)      │     ┌──────────────────────┐
                       │      │  OUTCOME (the LABEL)  │ ── converted? amount?
  Conversion / no ─────┘      │  feeds back to retrain│     churned? upsold?
                              └──────────┬───────────┘
                                         │
                                         └──▶ model improves ──▶ better routing
                                              ──▶ higher conversion ──▶ more outcome
                                              data ──▶ model improves ── (compounds)
```

**The flywheel evidence is real but early [VERIFIED — medium, 2-1]:** a peer-reviewed pilot (arXiv 2510.06674v2, EMNLP 2025) showed continuous learning from live customer conversations produced +11.7% recall@75, +14.8% precision@8, +8.4% helpfulness — measurable model improvement purely from harvesting real interactions. **Honest caveat:** that pilot was _text-channel, 40 agents, English-only, short-duration_. The claim that AI can replace human labellers in the loop at near-human agreement was **refuted 0-3**. So: the architecture demonstrably works and compounds, but the extrapolation to a real-time _voice_ D2D flywheel is ours to prove, not a settled result. Build it as a hypothesis with instrumentation, not a guarantee.

---

## 3. Layer 2a — Conversation Intelligence (the genuinely new capability)

This is the piece that turns a door conversation into structured, learnable data. **The core components are available NOW**, not vaporware.

### What's real and shippable today

| Capability                                                                          | Tool                                                                  | Status         | Note                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real-time speech-to-speech + reasoning, with telephony**                          | OpenAI **gpt-realtime-2**                                             | **[VERIFIED]** | Production API. Has a `reasoning.effort` param (minimal→xhigh; `low` is the documented production recommendation for voice agents) and **native SIP transport** (`sip:$PROJECT_ID@sip.api.openai.com;transport=tls`, webhook on `realtime.call.incoming`). Means a voice agent wires _directly into a phone call_ with no middleware — huge for the call centre.            |
| **Real-time multi-speaker diarization** (who's talking — rep vs prospect vs spouse) | NVIDIA **Streaming Sortformer** (`diar_streaming_sortformer_4spk-v2`) | **[VERIFIED]** | **Open-weight, available today.** 17-layer Fast-Conformer + 18-layer Transformer, 16kHz mono, up to 4 simultaneous speakers, with an Arrival-Order Speaker Cache that keeps labels consistent across a live conversation without reprocessing history. arXiv 2507.18446 (EMNLP 2025). This is the primitive that separates the rep's voice from the prospect's at the door. |
| **Transcription**                                                                   | Whisper (open) / Deepgram Nova / AssemblyAI Universal                 | available      | Commodity now. Whisper for offline/edge, Deepgram/AssemblyAI for managed low-latency streaming.                                                                                                                                                                                                                                                                             |
| **Intent / objection / sentiment extraction**                                       | Any frontier LLM over the transcript                                  | available      | This is where the _proprietary_ value is created — extracting the structured signal (objection type, buying-signal, hesitation) that becomes a training feature.                                                                                                                                                                                                            |

### The pipeline (door + phone, same spine)

```
mic (rep's phone / call-centre line)
   │
   ▼  16kHz mono audio, chunked
Streaming Sortformer ──▶ speaker-labelled segments (REP / PROSPECT / OTHER)
   │
   ▼
Whisper or Deepgram ──▶ transcript per speaker
   │
   ▼
LLM extraction (gpt-realtime-2 low-effort or batch) ──▶ structured signals:
   • objection_type (price / spouse / timing / trust / already-have)
   • sentiment_trajectory (warming / cooling)
   • buying_signals[]
   • commitments_made[]
   • the moment it was won or lost
   │
   ▼
→ ConversationSignal rows attached to the Knock/Lead/Conversion
→ become FEATURES in the propensity model + TRAINING DATA for the next version
```

### The hard constraints (be honest)

- **Latency [OPEN QUESTION]:** the research could not confirm gpt-realtime-2 hits the <300ms sub-conversational threshold on 4G/5G in the field. For _live in-ear coaching at the door_ this is the make-or-break number — must be measured, not assumed. **Fallback that always works:** record at the door → process async → the intelligence lands seconds-to-minutes later (still fully sufficient to build the dataset + flywheel; live coaching is the stretch goal).
- **Consent + law:** recording a conversation at someone's door is a two-party-consent minefield (varies by state — CA/FL/PA etc. are all-party-consent). This is a **compliance-engine problem, not a tech problem**, and it gates the whole conversation layer. The platform already has a state-clearance engine — extend it to a _recording-consent clearance_ gate. Get counsel before a single byte of door audio is captured.

---

## 4. Layer 2b — The Household Ontology + Propensity Engine (the Gotham core)

### The ontology (this is the Palantir lesson)

The moat is **entity resolution**: one canonical `Household` record that fuses every data source to a single physical address, so the model reasons over a _unified_ view rather than scattered tables.

```
Household (canonical entity, keyed on resolved physical address)
  ├── parcel attributes        (assessor / commercial parcel API)
  ├── ACS block-group context  (income, education, tenure, age — the US "SEIFA")
  ├── broadband availability    (FCC map — gold for telecom/ISP/solar D2D)
  ├── flood / hazard            (FEMA)
  ├── vacancy signal            (HUD/USPS aggregated)
  ├── prior D2D history         (every knock we've ever made here)
  ├── conversation signals      (everything Layer 2a extracted)
  └── outcome history           (converted / declined / churned — the labels)
```

Build it in Postgres + pgvector (already in the stack) — you do **not** need to buy Palantir Foundry to start. The ontology is a schema + an entity-resolution service, not a product licence.

### The data feeds — honest tiering

**Tier 1 — FREE government feeds, genuinely powerful, start here:**

- **Census ACS** (block-group: income, education, home value, tenure, age, household size) — this is the US equivalent of AU's SEIFA and it's free. The backbone of neighbourhood propensity.
- **FCC National Broadband Map** — broadband availability/speed by location. Decisive for telecom, ISP, solar verticals.
- **FEMA flood zones**, **HUD/USPS vacancy**, **county assessor parcel exports** (free but messy, per-county).

**Tier 2 — Commercial parcel/property aggregators — validate before you trust:**

- ATTOM, Regrid, BatchData, CoreLogic exist and sell parcel + owner + property APIs. **BUT** the deep-research pass **refuted every one of their coverage claims (0-3)** — "160M properties", "183M footprints", "155M / 99.9%", "daily ownership updates" all failed verification. **Action:** run a paid POC against _your actual target counties_ and measure real coverage, freshness, and cost-per-call at 50k+ queries/mo before committing. Do not put a vendor's marketing number in an investor deck.
- **Voter file** (L2, i360, Catalist) — precinct/individual-level, commercial, powerful but politically/ethically loaded and licence-restricted for commercial use. Diligence the licence terms.

**The strategic point:** Tier 1 alone (ACS + FCC + FEMA + assessor) gives a genuinely strong propensity baseline for **$0 in data licensing**. The proprietary D2D outcome data is what makes it _uncopyable_. Spend on Tier 2 only where a validated POC proves lift.

### The propensity engine

- Model: gradient-boosted trees (XGBoost/LightGBM) to start — interpretable, fast, strong on tabular household+area features; graduate to a neural two-tower model once conversation embeddings are rich enough to matter.
- Target: `P(convert | household_features, area_features, conversation_features, rep_features)`.
- **The continuous-learning loop is the whole game:** nightly/weekly retrain on every new outcome. Version every model. Track that each new model actually lifts conversion (the eval-gate discipline already in the stack). **Fair-lending guardrail:** because this scores households and can route reps toward/away from protected-class-correlated areas, it inherits FCRA/ECOA-style disparate-impact exposure — the model-risk + fair-lending governance already built for EAZEPay applies directly. This is a feature, not a burden: it's a moat competitors won't have the discipline to build.

---

## 5. Layer 3 — Agency (the visible product)

- **Where-to-knock-next:** rank every parcel in a territory by live propensity; the Knocker app routes the rep to the highest-EV doors. (The territory heatmap is already built — swap the static SEIFA-style shading for live model output.)
- **Live coaching:** if latency allows, in-ear next-line suggestions during the conversation ("they raised a spouse objection — here's the reframe"). If not, instant post-knock debrief.
- **Retargeting roundtrip:** knocked-not-converted → hashed audience → ad → click → back as a warm lead. (Pipeline already designed; the conversation signal makes the audience _far_ better — you retarget on _why_ they said no.)
- **Call-centre next-best-action:** the 7-day queue ranked + scripted by what the door conversation revealed.

---

## 6. The frontier hardware — honest horizon (don't build on this yet)

| System                         | What it is                                                                                  | Status                                        | Verdict                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Project Astra**       | Agentic multimodal (Search/Gmail/Maps/device control)                                       | **[BETA]** Trusted Tester only **[VERIFIED]** | The agentic tool-use is real; _real-time simultaneous video+audio_ was **refuted 0-3** — less than the hype. No confirmed commercial-access path. Watch, don't bet.                                |
| **Meta Aria Gen 2**            | Egocentric research glasses; nosepad contact-mic isolates wearer's voice **[VERIFIED 3-0]** | **[HORIZON]** research prototype              | The wearer-voice-isolation mic is exactly what you'd want for hands-free door capture. But "all on-device SLAM/eye/hand/speech" was **refuted 1-2**. 18-36 months from a field-deployable product. |
| On-device real-time multimodal | rep's phone doing live audio+vision+location inference                                      | **[HORIZON]**                                 | Not here yet at field latency/power. Design the data model so it _plugs in_ later; don't gate the roadmap on it.                                                                                   |

**The discipline:** build the data-capture + ontology + flywheel on **today's verified tools** (gpt-realtime-2, Sortformer, ACS/FCC, pgvector). Architect so frontier hardware slots in when it ships. The moat is the _data asset_, which accrues regardless of which model is hottest.

---

## 7. Availability matrix — NOW / BETA / HORIZON

**(a) Available now with API access / open weights:**

- gpt-realtime-2 (speech-to-speech + reasoning + SIP) · Whisper/Deepgram/AssemblyAI (transcription) · NVIDIA Streaming Sortformer (diarization, open weight) · Census ACS / FCC Broadband / FEMA / HUD (free gov data) · pgvector + XGBoost (the engine) — **everything needed for the v1 flywheel.**

**(b) Private beta / partnership-gated (pursue deliberately):**

- Project Astra Trusted Tester (agentic multimodal — access terms undisclosed) · commercial parcel APIs (run a POC; ignore the marketing numbers) · voter-file licensing (diligence commercial-use terms).

**(c) 12–18+ months / horizon (design-for, don't depend-on):**

- Field-deployable egocentric hardware (Aria-class) · on-device real-time multimodal at conversational latency · fully autonomous field agents.

---

## 8. Build sequence (sequenced for compounding, gated on consent + infra)

> Prereq, non-negotiable: **recording-consent legal clearance** per state (extend the existing state-clearance engine) + the AWS infra stood up. No door audio captured before counsel signs off.

- **Phase I — Ontology + free-data propensity (no audio yet).** Build the `Household` entity + entity resolution; ingest ACS + FCC + FEMA + assessor; ship a v1 XGBoost propensity score driving the territory heatmap. _Pure-software, zero data-licensing spend, immediately useful, fully legal._ This alone beats every incumbent's static filtering.
- **Phase II — Async conversation intelligence.** Record-at-door (where consented) → Sortformer + Whisper + LLM extraction async → ConversationSignal rows. Start the flywheel: outcomes + conversation features retrain the model weekly. Instrument the lift.
- **Phase III — Real-time + agency.** If latency proves out: live diarized transcription + in-ear coaching via gpt-realtime-2; SIP-native call-centre agent; propensity-ranked routing in the Knocker app.
- **Phase IV — Frontier integration.** Plug in beta/horizon capabilities (Astra-class agents, egocentric hardware) as they reach field-readiness.

---

## 9. The moat, stated plainly (the Thiel test: what secret do we have?)

**The secret:** in-person sales is the last large sales channel with _no_ outcome-learning intelligence layer, and it is the _only_ channel that produces the three-way fused dataset (outcome + conversation + household context). Whoever captures that first, at scale, owns a compounding proprietary asset that cannot be bought, scraped, or fast-followed — because replicating it requires being physically at millions of doors, recording the conversations, and observing the outcomes. The software is copyable in a quarter; **the dataset takes years of knocks to build and gets more valuable every day.**

That is the vacuum effect. The platform (PRs #1–#10) is the instrument. The Intelligence Layer is the company.

---

## 10. Honest scorecard of this research

- **Confirmed (build on these):** gpt-realtime-2 reasoning+SIP · Sortformer diarization · Astra agentic-but-restricted · Aria wearer-voice mic · flywheel-produces-measurable-lift (text, narrow) · SPOTIO has no ML/outcome-learning · three-tier framing with empty middle.
- **Refuted (do NOT repeat):** every parcel-vendor coverage number · gpt-realtime translate/whisper as separate GA models · Astra real-time simultaneous A/V · AI-replaces-human-labellers · "retraining months→weeks."
- **Open (must validate before depending):** field latency of real-time voice · Astra commercial-access path · real parcel-API coverage/freshness/cost · whether _any_ D2D competitor has a live outcome loop (evidence says no, but only SPOTIO was deeply verified).
