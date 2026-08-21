# D2D Platform — Elevation Synthesis

> `/elevate` dry-run · 2026-06-09 · **Overall: 35 / 100**

## Overall Maturity Score: 35 / 100

| Dimension                    | Score | Note                                                                                       |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| Architecture & schema design | 72    | Solid domain model, correct auth spine, real Prisma schema, ADRs exist                     |
| Security posture             | 38    | 4 P1 criticals open; no rate limiting; open redirect in prod                               |
| Data wiring                  | 22    | Majority of operator surface is seeded; API layer built but unconnected                    |
| UX quality                   | 35    | Optimistic mutations with no error surface; `alert()` in prod; dead CTAs throughout        |
| Operational readiness        | 28    | Hardcoded week anchors, fake health checks, no audit trail on roster, N+1 queries          |
| Test coverage                | 55    | Integration tests exist for compliance and auth; roster/marketing/command-centre have none |

**What 90 looks like:** Every headline KPI reads from the DB. Every mutation surfaces success/failure. The four P1 security findings are closed. Rate limiting exists. The roster page calls `/api/shifts`. The activity feed has a real route. The map does not use `alert()`. That is roughly six weeks of focused engineering — not a rebuild.

---

## 3 Cross-Cutting Quick Wins (each under 4 hours)

### QW-1 — Global mutation feedback layer (`useMutation` hook + toasts)

Every page has the same missing piece: optimistic mutations succeed silently and fail silently. Write one `useMutation` hook in `packages/ui/src/hooks/useMutation.ts` that wraps fetch, calls `toast.success()` / `toast.error()` from Sonner, handles rollback. Wire into the five highest-traffic mutation sites: roster shifts, generate approve, anomaly dismiss, onboard activate, pipeline stage move.  
**Effort: 3.5 hours. Raises robustness score on every page simultaneously.**

### QW-2 — Fix the three P1 security findings that are literal one-liners

- **P1-01** `apps/web-operator/src/app/api/shifts/[id]/route.ts:113` — both branches of the ternary are identical (`session.orgId`); fix the cross-tenant branch to read `req.nextUrl.searchParams.get('orgId') ?? session.orgId`
- **P1-03** `apps/web-operator/src/app/login/page.tsx:86` — open redirect: add `!next.startsWith('/') || next.startsWith('//')` guard, return `/accounts` as fallback
- **P1-04** `apps/web-operator/src/app/api/shifts/route.ts` — add `SHIFT_WRITE_ROLES` check after `requireSession()` so `knocker` and `viewer` roles cannot mutate the roster

**Effort: 45 minutes including writing the tests. Closes three attack surfaces before any demo.**

### QW-3 — Replace `alert()` with toasts + add data-freshness timestamp

- `HQLiveMapImpl.tsx:358–380`: replace all three `alert(...)` calls with `toast.info('...')` (browser alert blocks the poll timer)
- Add `lastFetched: Date` state to the fleet poll; render `"Updated HH:MM:SS"` in the map legend — makes stale data visually obvious without an error message

**Effort: 1.5 hours. Eliminates the single most damaging demo-killer in the entire platform.**

---

## 3 Architectural Improvements (week+ each)

### ARCH-1 — Wire Roster to `/api/shifts` + fix week anchor

The `/api/shifts` BFF is fully built, Zod-validated, tenant-scoped, and unused. Replace `buildSeed()` with a real `useEffect` fetch. Replace `new Date(2026, 4, 19)` with `currentMonday()`. Wire all five mutation paths to POST/PATCH/DELETE. Replace hardcoded `REPS` with a fetch to `/api/users?role=knocker`. Add `writeAudit()` to all three mutation handlers (currently absent — P2 compliance gap). **Effort: 3–4 days. Raises roster from 41 → ~85.**

### ARCH-2 — Replace seed-backed polling with SSE + fix N+1 on fleet

Phase A: Add `@@index([orgId, endedAt, startedAt])` on `KnockSession` (one migration). Rewrite fleet query as two queries with lateral-join pattern. Add `document.visibilityState` guard to poll intervals. Add in-flight deduplication. Add diff-before-setState on fleet (currently 240 DOM mutations per 30s poll). Phase B: Replace 15s activity poll with `GET /api/events/stream?orgId=...` SSE endpoint pushing `knock.created` / `session.started` / `anomaly.raised`. **Effort: Phase A 2 days, Phase B 4–5 days.**

### ARCH-3 — Seed-to-live graduation framework

Every page was built seed-first with no forcing function to transition to real data. Fix: (1) `DataSource: 'live' | 'fixture' | 'partial'` constant exported from every page; (2) `DataFreshnessIndicator` component (the leads page already has the best version — standardise it); (3) `useDataSource(endpoint, seed, schema)` shared hook; (4) CI check that fails the build if any `phase: 'current'` surface has `DataSource: 'fixture'`. **Effort: 4.5 days. Permanently raises the floor on every feature.**

---

## The Signature Moment

**Live anomaly → map → action in one interaction** — the one change that makes someone who sees D2D say "this is exceptional."

When "Devon R offline since 09:00" appears in the anomaly panel, clicking "Reassign":

1. The Leaflet map animates — pans and zooms to Devon's last GPS position in Houston SE, draws a highlight ring around that territory polygon
2. The anomaly card expands inline showing Devon's last 5 knocks + the two nearest active reps within radius
3. The operator clicks a suggested rep → toast: "Marcus L. assigned to Houston SE. Push sent to his iPad."
4. The territory polygon recolors from amber (Devon's offline zone) to the new rep's color. Devon's pin grays out.

This is 2–3 days of work. The territory polygons exist, the fleet data is on the map, the anomaly card renders the data. What's missing is the bridge: map `setCenter`/`setZoom` imperative API wired to anomaly click, a rep-picker component, and a `PATCH /v1/territory-assignments` call. **Every competitor shows you a map. Nobody except D2D lets you see a territory go dark and fix it without leaving the screen.**

---

## Honest Gaps (Human Decisions Required)

| Gap                          | Decision Needed                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rate limiting**            | Choose infra: Upstash Redis (~$10/mo), Cloudflare Workers (free tier), or in-memory sliding window (breaks under replicas)                                                    |
| **Native iOS app**           | No Swift binary exists. Decision: build in-house (6–9 months), license white-label field-sales app, or ship React Native / PWA for pilot                                      |
| **Paid-solicitor filings**   | Hope Forward cannot legally begin charity knocking in unfiled states. Requires a charitable solicitation lawyer, not a sprint                                                 |
| **AI vendor spend controls** | No per-tenant spend limit. One Runway video call = $15–40. Who is liable when a client generates misleading content that passes moderation? Commercial + legal decision first |
| **PostGIS migration**        | All geo columns are `String?`. Migrating to PostGIS requires maintenance window + full schema migration. Decision: before or after Hope Forward pilot launch?                 |

---

## Roadmap to 90 (Priority Order)

1. Close 4 P1 security findings — three are one-liners (45 min)
2. Wire roster to `/api/shifts` + fix week anchor (3–4 days)
3. Fix `alert()` calls and dead CTAs (1.5 hours)
4. Add global `useMutation` feedback layer (3.5 hours)
5. Wire activity feed + fix fleet N+1 + add SSE (1 week)
6. Wire compliance UI to live `PaidSolicitorRegistration` table (1 day)
7. Make decision on iOS app; update UI copy honestly
8. PostGIS migration

**That roadmap: 41 → ~88–92 in approximately 6 weeks.**
