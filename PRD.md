# Door 2 Digital Platform — PRD

> For the full product requirements document see `docs/PRD.md`.
> This root file is the quick-reference summary for new sessions.

---

## Problem statement

Door-to-door sales — charity fundraising and commercial D2D (solar, pest, energy, telecom) — runs on clipboards, WhatsApp groups, and disposable lead lists. Nothing is done with the data after the knock: no retargeting, no follow-up, no territory intelligence, no conversion attribution, no model that learns from outcomes. Incumbents (SalesRabbit, SPOTIO, Beest) sell activity tracking. None sells intelligence.

## Target user

- **Phase 1 pilot**: Hope Forward International (Pilot-Charlie) — 200+ knockers across US states, 5K+ conversions/month, both charity and commercial verticals from day one.
- **Operator role**: D2D's own knocker team runs the pilot's campaigns (operator-first model, SaaS-self-serve Phase 4).

## Core features (3 layers)

1. **System of Record** — Knocker iOS app, territory heatmap, Command Centre live field map, CRM + dialer, Marketing Studio, Conversions + Commissions + Payouts, compliance engine, PII vault + audit chain.
2. **System of Intelligence (the moat)** — Household Ontology (one entity per address), Conversation Intelligence (diarize → transcribe → extract objection/close signals), Propensity Engine (continuously retrained on outcomes).
3. **System of Agency** — where-to-knock routing, live coaching, outcome-aware retargeting, call-centre next-best-action.

## Success metrics

| Metric                             | Target           |
| ---------------------------------- | ---------------- |
| Knock-batch sync success / 30d     | ≥ 99.5%          |
| Lead capture latency P95           | < 2s             |
| Billing accuracy                   | to the cent      |
| Concurrent users (prod)            | 50,000           |
| Un-cleared-state campaign delivery | 0 (hard-blocked) |
| Audit Merkle chain verified        | 100% weekly      |

## Business model

$2,500/mo platform fee + **door 15% · inside-sales 10% · retargeting 5%** rake on conversions. ISO residuals on US MiCamp payment volume on top.

## Current status (2026-06-07)

- 11 PRs open on `Brodie-Eaze/door-2-digital-platform` — security floor + ~25 audit fixes + hardening + Next 16 + docs — **none merged**.
- Backend ~20% wired end-to-end; AWS IaC `terraform validate`-clean but not applied.
- Demo live: https://d2d-production-1fab.up.railway.app (pre-PR build).

## Next milestone (human-gated unlocks)

1. Merge PR #9 (menu fix + IaC + scale) then #1–#10 in order — resolve the 2-line conflict at #10.
2. Create AWS account + `terraform apply` (ECS Fargate, Aurora, ElastiCache, ALB, CloudFront, WAF).
3. Wire MiCamp Gateway API sandbox credentials → run first end-to-end conversion.
4. Domain + TLS + WAF live → external pen test → SOC 2 auditor engaged → live 50k load test.
