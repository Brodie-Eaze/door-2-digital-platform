# Door 2 Digital — Product Requirements Document (PRD)

|                  |                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Product**      | Door 2 Digital (D2D) — the intelligence operating system for door-to-door sales                                                |
| **Owner**        | Brodie                                                                                                                         |
| **Version**      | v1.0                                                                                                                           |
| **Status**       | Living · Phase 1 (US enterprise pilot) in build                                                                                |
| **Last updated** | 2026-06-05                                                                                                                     |
| **Related**      | `docs/architecture.md` · `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md` · `docs/50k/ROAD-TO-50K.md` · CTO Master Plan v0.3 |

---

## 1. Executive summary

Door-to-door sales — charity fundraising and commercial (solar, pest, energy, telecom) — runs on clipboards, WhatsApp groups, and disposable lead lists. Reps capture interest at the door and **nothing is done with the data**: no retargeting, no follow-up sequence, no territory analytics, no conversion attribution back to the knocker, and — critically — **no intelligence layer that learns from outcomes**.

**Door 2 Digital is the integrated OS** that closes the loop: _Market the area → Knock → Capture → Call-centre → AI retarget → Convert → Commission → Payout_, on an audit-grade, multi-region, compliance-first spine.

The strategic prize beneath the product is the **Intelligence Layer**: door-to-door is the only sales channel that simultaneously captures the **outcome** (converted or not), the **conversation** (recorded objection/close), and the **household context** (demographics, property, neighbourhood). Fusing all three creates a proprietary, compounding dataset that cannot be bought or scraped. The CRM is the instrument; the dataset is the moat.

---

## 2. Problem statement (Jobs-to-be-Done)

| Persona                                   | Job to be done                                                                                   | Today's broken state                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Field rep (knocker)**                   | "Tell me which doors are worth knocking and help me close them."                                 | Walks blind. No propensity signal, no live coaching, paper dispositions.            |
| **Crew manager**                          | "Show me where my crews are, who's converting, and where to deploy next."                        | WhatsApp + spreadsheets. No live map, no anomaly detection, no roster intelligence. |
| **Inside-sales / call-centre**            | "Give me warm leads with full doorstep context and a script."                                    | Re-keyed lead lists with no context; cold callbacks.                                |
| **Charity / commercial client (the org)** | "Run my campaign compliantly and prove every dollar's attribution."                              | Manual compliance, no per-state clearance enforcement, opaque attribution.          |
| **Operator (D2D itself)**                 | "Run 200+ knockers across states, bill per attribution bucket, never breach a solicitation law." | No system exists that does field + CRM + marketing + money + compliance as one.     |

**The deeper job:** every incumbent (SalesRabbit, SPOTIO, Beest, Canvass) sells _activity tracking_. None sells _intelligence_ — propensity scoring that learns from outcomes, or conversation intelligence. Verified: SPOTIO's "AI" is static demographic filtering + voice-to-text workflow, with no ML propensity and no outcome learning. The category is at static-filter maturity. That is the gap D2D fills.

---

## 3. Target users & first customer

- **Operating model**: Operator-first. D2D's own knocker team (200+) runs campaigns for client orgs; SaaS self-serve opens in Phase 4.
- **Pilot (Phase 1)**: a signed **US enterprise charity + commercial** customer (ref. "Pilot-Charlie" / Hope Forward International) — 200+ knockers across multiple US states (rolling as paid-solicitor registrations clear), 5,000+ conversions/month, both verticals from day one.
- **Verticals served**: charity (recurring + one-off donations) AND commercial (one-shot sale + installer handoff) — polymorphic from day one.
- **Markets**: US (Phase 1) → AU (Phase 2) → SG (Phase 3). Multi-region residency primitives day one; only US provisioned in Phase 1.

---

## 4. The product — capability map

Three architectural layers (see Intelligence strategy for the full treatment):

### Layer 1 — System of Record (the instrument; largely built)

1. **Knocker iOS app** — offline-first field capture; ≤4 taps from map to recorded knock; GPS + photo + signature; disposition wheel; device-attestation + biometric re-auth; charity-signed authority letter on the badge.
2. **Territory intelligence** — PostGIS turf; draw tools; demographic + propensity heatmap (H3 hex-bin); turf assignment + crew allocation.
3. **Command Centre** — live field map, roster + clock-in/out, anomaly detection (idle crews, hot zones, missed callbacks), cross-territory KPIs.
4. **CRM + inside-sales dialer** — doorstep leads route to call-centre with full context; soft-phone cockpit; pipeline kanban; sequences; smart lists; the 7-day call queue.
5. **Marketing Studio** — AI copy/image/video generation with brand-safety + legal-hold gates; hashed retargeting audiences across Meta/Google/TikTok; the retargeting roundtrip (knocked-not-converted → ad → back as a tagged lead).
6. **Conversions / Commissions / Payouts** — polymorphic donation|sale; per-knock/per-sale/hybrid commission plans; payout _instruction_ files (NACHA/CSV) — **instruct, never auto-debit**.
7. **Compliance engine** — table-driven paid-solicitor state clearance; cooling-off timers; DNC/DNK scrub; TCPA consent capture.
8. **Audit + PII vault** — hash-chained immutable audit (7-yr S3 Object Lock); envelope-encrypted PII with dual-control JIT unmask.
9. **Client portal** — white-label self-service: invoices with bucketed rake, payout statements, conversion reports, per-state compliance status.

### Layer 2 — System of Intelligence (the moat; to build)

- **Household Ontology** — one canonical entity per physical address, fusing parcel + ACS demographics + FCC broadband + FEMA hazard + vacancy + prior knocks + conversation signals + outcomes (entity resolution is the core).
- **Conversation Intelligence** — door + phone audio → diarization (NVIDIA Streaming Sortformer) → transcription (Whisper/Deepgram) → structured signal extraction (objection type, sentiment trajectory, buying signals) via LLM. Real-time path via OpenAI gpt-realtime-2 (SIP-native for the call centre) where latency + consent allow; async otherwise.
- **Propensity Engine** — `P(convert | household, area, conversation, rep)`; gradient-boosted to start, neural two-tower later; **continuously retrained on every outcome**.
- **The flywheel** — every knock produces a labelled training row → smarter model → better routing → higher conversion → more data. The database compounds in value.

### Layer 3 — System of Agency (the visible output)

- Where-to-knock-next routing; live/post-knock coaching; outcome-aware retargeting; call-centre next-best-action.

---

## 5. Goals & success metrics

| Goal                           | Metric                                            | Target                        |
| ------------------------------ | ------------------------------------------------- | ----------------------------- |
| Pilot go-live                  | 200+ knockers live across cleared states          | Phase 1.4                     |
| Field capture reliability      | Knock-batch sync success / 30d                    | ≥ 99.5%                       |
| Lead capture latency           | P95                                               | < 2s                          |
| Billing accuracy               | Monthly invoice vs manual recalc                  | to the cent                   |
| Conversion lift (Intelligence) | Conversion rate with propensity routing vs static | measurable lift, instrumented |
| Scale                          | Concurrent users supported in production          | 50,000                        |
| Compliance                     | Campaign delivery to un-cleared state             | 0 (hard-blocked + audited)    |
| Audit integrity                | Merkle chain verified                             | 100% / weekly                 |

---

## 6. Functional requirements (selected, by area)

**Field & territory**

- FR-1 Offline-first knock capture; idempotent batch reconcile on reconnect.
- FR-2 Disposition set: no-answer, not-interested, callback, do-not-knock, appointment, converted-donation, converted-sale, hostile, invalid-address.
- FR-3 PostGIS territories with draw/snap-to-street + propensity heatmap overlay.
- FR-4 Live Command Centre map updating within 2s of a knock.

**CRM & inside sales**

- FR-5 Doorstep leads route to inside-sales with full context (knock, photo, consent, conversation signal).
- FR-6 Soft-phone dialer + pipeline kanban + sequences + smart lists + 7-day queue.

**Marketing**

- FR-7 AI creative generation with C2PA provenance + per-vertical brand-safety gate + legal-hold queue before publish.
- FR-8 Hashed custom audiences to Meta/Google/TikTok; retargeting roundtrip with `attributionSource=retargeting`.

**Money**

- FR-9 Polymorphic `Conversion` (donation | sale) with single `attributionSource` (door/inside_sales/retargeting) driving the billing bucket.
- FR-10 MiCamp adapter (US) + Stripe (AU/SG); ISO residual computed per conversion.
- FR-11 Commission accrual (per-knock/sale/hybrid + crew override); payout **instruction** file generation (NACHA/CSV) — WebAuthn-gated, never auto-debit.
- FR-12 Monthly invoice = platform fee + per-bucket rake; PDF + portal.

**Compliance**

- FR-13 `PaidSolicitorRegistration` + `CampaignStateClearance` — campaigns deliver only to states where the registration is `approved AND not expired`.
- FR-14 Cooling-off timers block payout until the window closes; DNC/DNK scrub (FTC+FCC+state); TCPA written-consent capture.

**Intelligence (Layer 2 — new)**

- FR-15 Household ontology with entity resolution across all sources.
- FR-16 Conversation capture (consent-gated) → diarized transcript → structured signals attached to knock/lead/conversion.
- FR-17 Propensity score per parcel, refreshed on retrain; surfaced in territory heatmap + Knocker routing.
- FR-18 Continuous-learning loop: every outcome becomes a training row; every model version eval-gated for lift before promotion.

**Platform**

- FR-19 SAML 2.0 SSO (Okta/Azure AD/generic) for enterprise tenants; 8-role RBAC + ABAC; WebAuthn for sensitive actions.
- FR-20 White-label brand on web + mobile builds; optional dedicated single-tenant DB.

---

## 7. Non-functional requirements

- **NFR-1 Scale**: 50,000 concurrent users; RDS Proxy connection pooling; ECS autoscaling; per-tenant + global rate limiting; ≥3× load-test headroom (k6 suite written, run gated on infra).
- **NFR-2 Security**: SOC 2 Type I scoped (Type II window later); OWASP Top 10 mitigated; RLS tenant isolation; PII envelope encryption; hash-chained audit; pen-test before public launch.
- **NFR-3 Multi-region residency**: Postgres-per-region (US/AU/SG); region pinning immutable at org creation; no PII leaves its region.
- **NFR-4 Reliability**: SLOs (knock-sync ≥99.5%, lead P95 <2s, payout-gen P95 <60s, API 99.9%); error budgets; runbooks; DR RPO 5min / RTO 1h.
- **NFR-5 Privacy/PII-first**: classify-before-write, encrypt-at-rest, RTBF, retention enforcement, consent ledger — default on every model.
- **NFR-6 Observability**: Pino structured logging + OpenTelemetry tracing; golden-signal dashboards alerting.

---

## 8. Compliance & regulatory (the longest pole)

- **Paid-solicitor registration** — D2D (as the soliciting entity) must register per state it knocks on a charity's behalf (4–12 weeks/state + bonds). Enforced in code via the state-clearance engine; rolling launch as registrations clear.
- **Cooling-off** — FTC 3-day (US); ACL 10-day (AU); 5-day (SG). Block payout until window closes.
- **TCPA / DNC / CAN-SPAM** — written consent capture; nightly DNC scrub; CAN-SPAM headers.
- **Recording consent (Intelligence Layer gate)** — capturing door/phone audio triggers two-party-consent law (all-party states: CA/FL/PA/etc.). Extend the state-clearance engine into a recording-consent gate. **No audio captured before counsel sign-off.**
- **Fair lending (Intelligence Layer)** — propensity scoring that routes reps inherits FCRA/ECOA-style disparate-impact exposure; governed by the same model-risk discipline as EAZEPay.
- **Privacy law** — GDPR-grade discipline; US state laws (CCPA/CPRA + CO/VA/UT/etc.); AU Privacy Act/APPs; SG PDPA.

---

## 9. Business model

- **Per-pilot**: $2,500/mo platform fee + per-bucket rake — **door 15% · inside-sales 10% · retargeting 5%** (configurable per contract).
- **ISO residual**: Brodie earns MiCamp processor residuals on US payment volume on top of the platform take.
- **Future SaaS** (Phase 4): self-serve tiers; the Intelligence Layer is the premium differentiator.

---

## 10. Scope & phasing

| Phase            | Scope                                                                                                         | Timeline                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **0**            | Scaffold + brand + AWS Org                                                                                    | done                                |
| **1**            | US enterprise pilot go-live (both verticals, white-label, SSO, SOC 2 Type I, MiCamp, rolling state clearance) | 14–16 weeks                         |
| **2**            | AU expansion (Stripe AU, ACNC compliance, Sydney region)                                                      | 8 weeks                             |
| **3**            | SG expansion + AI Marketing Studio depth                                                                      | 8 weeks                             |
| **4**            | Public SaaS + AWS prod migration + app-store launch                                                           | 12 weeks                            |
| **I (parallel)** | Intelligence Layer: ontology + free-data propensity → async conversation intelligence → real-time + agency    | sequenced; gated on consent + infra |

**Out of scope (now)**: public app-store distribution (Phase 4); frontier hardware (Aria-class glasses — design-for, don't depend-on); fully autonomous field agents.

---

## 11. Current build status (2026-06-05)

- **Code-complete & hardened on branches** — 10 stacked PRs (security floor + ~25 audit fixes + 4 blocker fixes + M5 wiring + Next 16), all verified (tsc/gitleaks/prisma), **none merged**.
- **Backend ~20% wired end-to-end**; production needs infra.
- **Human-gated unlocks**: merge the PRs → AWS account + `terraform apply` → MiCamp creds → domain → 50k load test → external pen-test → SOC 2 auditor → counsel.

---

## 12. Risks

| Risk                                                           | Severity | Mitigation                                                                                |
| -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Paid-solicitor registrations (longest pole, bond capital)      | P0       | Counsel parallel filings; state-clearance engine enforces; rolling launch                 |
| Recording-consent law gating the Intelligence Layer            | P0       | Consent-clearance gate; counsel before any audio                                          |
| Real-time voice latency in the field unproven                  | P1       | Async-first capture (flywheel works without real-time); live coaching is the stretch goal |
| Parcel-data vendor coverage/cost (marketing claims unverified) | P1       | POC against real target counties before committing; start on free gov data                |
| Enterprise table-stakes compound timeline                      | P1       | Built into the 14–16wk Phase 1                                                            |
| Fair-lending exposure on propensity routing                    | P1       | Model-risk governance (EAZEPay discipline)                                                |

---

## 13. Open questions

1. gpt-realtime-2 field latency on 4G/5G — does it meet sub-300ms for live coaching, or is async the v1?
2. Which parcel aggregator actually delivers claimed coverage/freshness at 50k+ calls/mo (validate, don't trust marketing)?
3. Project Astra commercial-access path + data/privacy terms?
4. Confirm no competitor has a live outcome-learning loop (evidence says none; only SPOTIO deeply verified).

---

## 14. References

CTO Master Plan v0.3 · `docs/architecture.md` · `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md` · `docs/50k/ROAD-TO-50K.md` + `HARDENING-LOG.md` · `docs/adr/0001–0030` · `infra/terraform/README.md`.
