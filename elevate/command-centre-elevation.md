# Command Centre — Elevation Report

> `/elevate` dry-run · 2026-06-09 · **Score: 26 / 100**

## Dimension Scores

| Dimension   | Score | Why                                                                                                                                                                                                     |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness | 4/20  | 5 of 6 surfaces are decorative; only `/api/fleet` has real query logic; anomaly "Reassign" has no onClick; activity feed `length > 0` guard keeps it on seed forever; PushToField writes to console.log |
| Robustness  | 2/20  | Every failure mode (401, 500, timeout, partition) produces identical result: seed data + permanent green LIVE dot. No staleness indicator, no retry escalation, no in-flight guard on polls             |
| Speed       | 10/20 | Fast because hardcoded. Fleet API has N+1 pattern (31 queries per poll at 30 reps). Map re-renders 240 Leaflet DOM mutations per 30s poll with no diffing. No visibility-state guard                    |
| Clarity     | 7/20  | Good layout hierarchy. Zero signal about data freshness. "GPS every 30 seconds" is a static label. Anomaly CTAs look actionable and do nothing. LIVE badge is permanently green                         |
| Delight     | 3/20  | Visually satisfying at first glance. Collapses the moment `alert("Calling Marcus L…")` fires. Delight requires trust; trust requires honesty                                                            |

**Total: 26 / 100**

---

## Top 8 Recommendations

### #1 — QUICK-WIN · Data-source badge + staleness timer on every panel

**Effort: 2–4h**

Add `dataSource: 'live' | 'fixture' | 'stale'` state. Each poll sets it. A `useDataFreshness` hook tracks last-successful-update and computes stale at >90s. Render small badge on map legend, KPI strip, activity feed, AI panel: "LIVE · updated Xs ago" (green) / "FIXTURE · DB unreachable" (amber) / "STALE · last synced X min ago" (red). ~150 lines total.

### #2 — QUICK-WIN · Wire `/api/activity` and fix the LIVE pulsing dot

**Effort: 3–6h**

The BFF route exists, has real Prisma logic, returns the correct shape. Problem: `length > 0` guard keeps seed forever. Remove the guard. If DB returns empty, render honest empty state ("No field activity in the last 24h"). LIVE dot should only be green when last poll was 200 within 45 seconds.

### #3 — MEDIUM · Replace `alert()` with real action sheet on map pin popups

**Effort: 1 day**

Three buttons open browser `alert()` — blocking modal that halts the poll timer. Replace with Radix `Sheet`: Call opens `tel:{phone}`, Msg opens message drawer, Break/Resume PATCHes rep's session status. **Never ship `alert()` in production.**

### #4 — MEDIUM · Anomaly cards → map context link: close the detect-to-act loop

**Effort: 1–2 days**

Clicking "Reassign" on "Devon R offline since 09:00" should: (1) pan + zoom Leaflet to Devon's last position; (2) highlight Houston SE territory polygon amber; (3) open floating rep-picker with available reps within 10km; (4) on selection, PATCH `/v1/territory-assignments` + POST `/v1/notifications/push`. The backend pieces mostly exist. Gap is purely frontend wiring.

### #5 — MEDIUM · PushToField strip: wire Broadcast Message as the first real command

**Effort: 1–2 days**

Text input + send button POSTs to `POST /v1/notifications/broadcast` with `{ orgId, message, scope }`. Design like a command palette (⌘K). "Broadcast sent to 47 knockers" is itself meaningful proof that a real command was issued.

### #6 — BIG-BET · KPI cards → live aggregates with sparklines + delta comparison

**Effort: 3–5 days**

New `GET /api/metrics/realtime` endpoint — one `groupBy` on KnockSession + Knock for today vs same day last week. Each card: current value (large, live) + 7-day sparkline (40px Recharts AreaChart) + delta badge ("+12% vs last Mon"). Threshold alerts auto-color card border amber/red. Turns a status display into an intelligence surface.

### #7 — BIG-BET · AI Next Zones → real propensity from knock history

**Effort: 1 week**

`GET /v1/territories/suggestions?orgId=X&limit=5` — propensity score = historical conversion rate per territory cell × (1 - current saturation) × recency weight. Pure SQL analytics on existing Knock + Conversion tables. No external ML needed for v1. "Assign 2 reps →" CTA routes to rep-picker + writes `TerritoryAssignment`. Closes intelligence → decision → action in one panel.

### #8 — BIG-BET · Territory-first map: polygon coverage layer, rep pins secondary

**Effort: 1–2 weeks**

Flip primary Leaflet layer from rep pins to territory polygon fill. Color gradient = real-time saturation: emerald (>70% addressed today) → amber (30–70%) → red (<30%). Rep pins become secondary layer, togglable, clustered at zoom <12. Scales to 200+ reps without noise. Red polygon demands attention without any anomaly card needed.

---

| #   | Recommendation                      | Type      | Effort | Score Delta |
| --- | ----------------------------------- | --------- | ------ | ----------- |
| 1   | Data-source badge + staleness timer | QUICK-WIN | 4h     | +8          |
| 2   | Wire /api/activity, fix LIVE dot    | QUICK-WIN | 6h     | +6          |
| 3   | Replace alert() with action sheet   | MEDIUM    | 1d     | +7          |
| 4   | Anomaly → map pan → rep-picker      | MEDIUM    | 2d     | +12         |
| 5   | PushToField broadcast message       | MEDIUM    | 2d     | +8          |
| 6   | Live KPI sparklines + deltas        | BIG-BET   | 5d     | +10         |
| 7   | AI zones from real propensity       | BIG-BET   | 1w     | +12         |
| 8   | Territory-first map redesign        | BIG-BET   | 2w     | +14         |

**QW-1 + QW-2 + MEDIUM-3 alone (~2 days) raises the score from 26 → ~57.**
