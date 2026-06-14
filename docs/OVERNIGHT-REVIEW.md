# Overnight build review — Door 2 Digital OS

**Built:** night of 2026-05-24 → 2026-05-25
**Final commit:** `8bd38ee` (review dossier on top of this)
**Status:** GREEN · 170/170 routes verified · all 3 satellite tile sources GREEN
**Dev server:** http://localhost:3011

---

## TL;DR

Eight commits landed overnight covering Phase 0–4 surfaces of the master plan
plus pen-test readiness + security hardening. Every route in the production
build returns 200 across all four demo accounts. Map tiles all serve. The app
is ready for a click-through tour.

## How to spin up

```bash
cd /Users/Brodie/D2D/door-2-digital-platform
pnpm --filter web-operator dev
# Then open http://localhost:3011
```

The root path (`/`) 307-redirects to `/accounts` — that's the portfolio entry
point (the new information architecture). Everything fans out from there.

## What landed (commit chain)

| SHA       | Title                                                                      |
| --------- | -------------------------------------------------------------------------- |
| `961edc0` | Ever Giving-grade sub-account · live satellite HQ map · interactive roster |
| `418192a` | Security review + pen-test readiness audit + quick-win hardening           |
| `e186d71` | Per-account self-contained workspaces + onboarding wizard + HQ unification |
| `87a56b5` | Phase 1 backend service scaffolds (23 domains)                             |
| `c0912b6` | Phase 2 AU region surfaces                                                 |
| `034ddf4` | Phase 3 SG region + AI Marketing Studio                                    |
| `5c07f9d` | Phase 4 public SaaS surfaces                                               |
| `8bd38ee` | Verify satellite imagery — all green, no changes required                  |

---

## Walkthrough (start here)

Brodie — open these in order to see the story unfold.

### 1. The portfolio (the new IA)

- [All accounts](http://localhost:3011/accounts) — your portfolio. Each card is one sub-account; click to enter its workspace.
- [Onboard new business](http://localhost:3011/onboard-account) — 5-step wizard to activate a new sub-account end-to-end.

### 2. HQ Command Centre — operator view across all accounts

This is the cross-account NASA mission-control surface. Everything below
operates across the entire portfolio.

- [Live field map](http://localhost:3011/command-centre) — real Esri satellite imagery + OSM toggle, 10 reps in Texas with pulse halos
- [Territory intel](http://localhost:3011/territory-intel) — propensity heatmap
- [Roster & shifts](http://localhost:3011/roster) — interactive drag-drop
- [Planning](http://localhost:3011/planning)
- [Billing & invoices](http://localhost:3011/billing)
- [MiCamp processor](http://localhost:3011/billing/processor) — Phase 0 prereq
- [Compliance](http://localhost:3011/compliance) · [State clearance](http://localhost:3011/compliance/state-clearance)
- [Audit log](http://localhost:3011/audit)
- [Knocker iOS preview (generic)](http://localhost:3011/mobile-preview) — 10 iPhone mocks of the mobile rep app

### 3. Inside a sub-account (each business is identical structure, fully scoped)

Four demo accounts to feel the breadth of verticals + regions:

- [Hope Forward · Today](http://localhost:3011/accounts/hope-forward/today) — US charity, massive Today dashboard
- [World Vision · Today](http://localhost:3011/accounts/world-vision/today) — AU charity, region-aware data
- [PestMax · Today](http://localhost:3011/accounts/pestmax/today) — US commercial pest vertical
- [Gold Coast Hospital · Today](http://localhost:3011/accounts/gold-coast-hospital/today) — AU healthcare vertical

Each account has these self-contained surfaces. Hope Forward is linked below
as the canonical example — swap the slug for any of the other three to see
the same shape with that account's data:

**Overview**

- [Today](http://localhost:3011/accounts/hope-forward/today)
- [Conversations](http://localhost:3011/accounts/hope-forward/conversations)

**Contacts**

- [Leads](http://localhost:3011/accounts/hope-forward/leads)
- [Leads · Maria Santos detail](http://localhost:3011/accounts/hope-forward/leads/maria-santos)
- [Smart Lists](http://localhost:3011/accounts/hope-forward/smart-lists)
- [Lead Lists](http://localhost:3011/accounts/hope-forward/lead-lists)
- [Pipeline](http://localhost:3011/accounts/hope-forward/pipeline)
- [Inside sales (calls)](http://localhost:3011/accounts/hope-forward/inside-sales)

**Growth**

- [Marketing](http://localhost:3011/accounts/hope-forward/marketing-studio)
- [Reports](http://localhost:3011/accounts/hope-forward/reports)
- [Campaigns](http://localhost:3011/accounts/hope-forward/campaigns)
- [Drip](http://localhost:3011/accounts/hope-forward/drip)

**Field ops**

- [Knockers](http://localhost:3011/accounts/hope-forward/knockers)
- [Territories](http://localhost:3011/accounts/hope-forward/territories)
- [Roster & shifts](http://localhost:3011/accounts/hope-forward/roster)
- [Knocker iOS preview (white-labelled per account)](http://localhost:3011/accounts/hope-forward/knocker-ios)

**Operate**

- [Calendars](http://localhost:3011/accounts/hope-forward/calendars)
- [Forms](http://localhost:3011/accounts/hope-forward/forms)
- [Sites & Funnels](http://localhost:3011/accounts/hope-forward/sites)
- [Memberships](http://localhost:3011/accounts/hope-forward/memberships)
- [Tasks](http://localhost:3011/accounts/hope-forward/tasks)
- [Workflows](http://localhost:3011/accounts/hope-forward/workflows)
- [Automations](http://localhost:3011/accounts/hope-forward/automations)
- [Files](http://localhost:3011/accounts/hope-forward/files)

**Finance & compliance**

- [Invoices](http://localhost:3011/accounts/hope-forward/invoices)
- [Conversions](http://localhost:3011/accounts/hope-forward/conversions)
- [Commissions](http://localhost:3011/accounts/hope-forward/commissions)
- [Compliance](http://localhost:3011/accounts/hope-forward/compliance)

**Workspace**

- [Team](http://localhost:3011/accounts/hope-forward/team)
- [Settings](http://localhost:3011/accounts/hope-forward/settings)

### 4. Phase 2 — AU region

- [AU operations](http://localhost:3011/regions/au)
- [AU compliance](http://localhost:3011/regions/au/compliance) — Privacy Act, OAIC, NDB
- [AU payments](http://localhost:3011/regions/au/payments) — Stripe AU + GoCardless BECS
- [AU territory intel](http://localhost:3011/regions/au/territory-intel) — ABS SEIFA decile bands

### 5. Phase 3 — SG region + AI Marketing Studio

**Singapore region**

- [SG operations](http://localhost:3011/regions/sg)
- [SG compliance](http://localhost:3011/regions/sg/compliance) — PDPA + DNC registry
- [SG payments](http://localhost:3011/regions/sg/payments) — Stripe SG + PayNow + GIRO
- [SG territory intel](http://localhost:3011/regions/sg/territory-intel)

**AI Marketing Studio (cross-account)**

- [Studio · overview](http://localhost:3011/marketing-studio)
- [Generator](http://localhost:3011/marketing-studio/generate)
- [Library (50 creatives)](http://localhost:3011/marketing-studio/library)
- [Campaigns (Meta · Google · TikTok · YouTube)](http://localhost:3011/marketing-studio/campaigns)
- [Brand safety](http://localhost:3011/marketing-studio/brand-safety)
- [Retargeting (knock → 5% rake loop)](http://localhost:3011/marketing-studio/retargeting)

### 6. Phase 4 — Public SaaS site (open in a private window for the cold-visitor feel)

- [Homepage](http://localhost:3011/public)
- [Product](http://localhost:3011/public/product)
- [Pricing](http://localhost:3011/public/pricing)
- [Customers](http://localhost:3011/public/customers)
- [Security](http://localhost:3011/public/security)
- [Docs](http://localhost:3011/public/docs)
- [Status](http://localhost:3011/public/status)
- [Bug bounty](http://localhost:3011/public/bug-bounty)
- [Self-serve sign-up](http://localhost:3011/public/signup)
- [security.txt](http://localhost:3011/.well-known/security.txt)

### 7. Operator admin + ops corners

- [Login](http://localhost:3011/login) — stub UI, no real auth wired
- [Overview](http://localhost:3011/overview)
- [Alerts](http://localhost:3011/alerts)
- [Settings (HQ)](http://localhost:3011/settings)
- [Screens (display board)](http://localhost:3011/screens)
- [Orgs](http://localhost:3011/orgs) · [Pilot Charlie](http://localhost:3011/orgs/pilot-charlie) · [Provisioning](http://localhost:3011/orgs/provisioning)
- [Admin · plans](http://localhost:3011/admin/plans) · [secrets](http://localhost:3011/admin/secrets) · [users](http://localhost:3011/admin/users)
- [Ops · data sources](http://localhost:3011/ops/data-sources) · [health](http://localhost:3011/ops/health)

---

## Full route matrix (smoke test)

All 170 endpoints (50 static + 30 dynamic × 4 demo slugs) returned a healthy
status code on this run.

| Category                                     | Routes  | HTTP 200 | HTTP 307              | Failures |
| -------------------------------------------- | ------- | -------- | --------------------- | -------- |
| Root                                         | 1       | 0        | 1 (`/` → `/accounts`) | 0        |
| Portfolio + onboarding                       | 2       | 2        | 0                     | 0        |
| HQ Command Centre + ops                      | 17      | 17       | 0                     | 0        |
| Marketing Studio                             | 6       | 6        | 0                     | 0        |
| Public SaaS site                             | 9       | 9        | 0                     | 0        |
| AU region                                    | 4       | 4        | 0                     | 0        |
| SG region                                    | 4       | 4        | 0                     | 0        |
| Admin + orgs + login + misc                  | 13      | 13       | 0                     | 0        |
| `.well-known/security.txt`                   | 1       | 1        | 0                     | 0        |
| Sub-account workspaces (30 routes × 4 slugs) | 120     | 120      | 0                     | 0        |
| **Total**                                    | **177** | **176**  | **1 expected**        | **0**    |

The 307 on `/` is intentional (the IA shifted from `/overview` being the
landing page to `/accounts` being the portfolio entry). Every other route
serves a full page.

### Dynamic-route coverage per slug

For each of the 4 demo accounts (`hope-forward`, `world-vision`, `pestmax`,
`gold-coast-hospital`), all 30 sub-account routes return 200:

```
/accounts/{slug}/automations          /accounts/{slug}/calendars
/accounts/{slug}/campaigns            /accounts/{slug}/commissions
/accounts/{slug}/compliance           /accounts/{slug}/conversations
/accounts/{slug}/conversions          /accounts/{slug}/drip
/accounts/{slug}/files                /accounts/{slug}/forms
/accounts/{slug}/inside-sales         /accounts/{slug}/invoices
/accounts/{slug}/knocker-ios          /accounts/{slug}/knockers
/accounts/{slug}/lead-lists           /accounts/{slug}/leads
/accounts/{slug}/leads/maria-santos   /accounts/{slug}/marketing-studio
/accounts/{slug}/memberships          /accounts/{slug}/pipeline
/accounts/{slug}/reports              /accounts/{slug}/roster
/accounts/{slug}/settings             /accounts/{slug}/sites
/accounts/{slug}/smart-lists          /accounts/{slug}/tasks
/accounts/{slug}/team                 /accounts/{slug}/territories
/accounts/{slug}/today                /accounts/{slug}/workflows
```

---

## Satellite imagery — tile probe re-check

Agent 10 verified all three tile sources GREEN; Agent 11 (this dossier)
re-probed live this run:

| Tile source                        | URL                                                                                                              | HTTP | Size     | Type       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---- | -------- | ---------- |
| Esri World Imagery (basemap)       | `server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/413/232`                           | 200  | 20,652 B | image/jpeg |
| Esri Reference (boundaries+places) | `services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/10/413/232` | 200  | 2,097 B  | image/png  |
| OSM (with User-Agent)              | `tile.openstreetmap.org/10/232/413.png`                                                                          | 200  | 13,586 B | image/png  |

See `docs/SATELLITE-VERIFICATION.md` for Agent 10's full report.

---

## Backend scaffold (Phase 1)

23 Fastify domain modules at `apps/api/src/domains/` — each is a
501-Not-Implemented stub that documents the full Phase 1.X endpoint surface
the engineer needs to ship. Drop real implementations behind the existing
signatures. See `apps/api/src/index.ts` for the mount table.

**Domain inventory (23):** `audit`, `auth`, `billing`, `commission`,
`compliance`, `consent`, `content-studio`, `conversion`, `crm`,
`do-not-call`, `do-not-knock`, `donation`, `dsar`, `knock`, `lead`,
`marketing`, `notification`, `payout`, `pii-vault`, `realtime`, `sale`,
`territory`, `user`, plus `webhook` (24 actually shipped — counted as one
in original plan).

These typecheck but aren't booted in dev. To run the API:

```bash
pnpm --filter api dev
```

---

## What's NOT shipped (be honest)

- **No real auth.** `/login` is a stub UI. SAML, SSO, Cognito, JWT signing
  are all Phase 1.1 work. Anyone with the dev URL can see everything.
- **No real backend running.** The 23 Fastify domain modules typecheck but
  none of the operator app's calls go to a live API — every screen renders
  from fixture data in `apps/web-operator/src/lib/*-fixtures.ts`.
- **No real integrations.** MiCamp, Stripe (AU/SG), GoCardless, PayNow,
  GIRO, Ably, Twilio — all UI-only. Surface only, no wire.
- **No native iOS app.** `apps/knocker-ios/` is scaffolded but not built.
  The iPhone mockups in `/mobile-preview` and `/accounts/{slug}/knocker-ios`
  are React components, not a TestFlight build.
- **No PII vault, KMS, or audit-chain.** See `docs/SECURITY-REVIEW.md` for
  the full gap list and `docs/PEN_TEST_READINESS.md` for the readiness state.
- **No AWS infrastructure deployed.** Terraform scaffolds live at
  `infra/terraform/` but nothing is applied.
- **Hard-coded fixture data throughout.** Every account, every knocker,
  every conversion, every map pin is seeded in fixture files. Numbers look
  real; they aren't.

---

## Key docs

| Doc                    | Path                                                     |
| ---------------------- | -------------------------------------------------------- |
| Master plan v0.3       | `~/.claude/plans/question-im-about-to-greedy-cascade.md` |
| Architecture           | `docs/architecture.md`                                   |
| Pen-test readiness     | `docs/PEN_TEST_READINESS.md`                             |
| Security review        | `docs/SECURITY-REVIEW.md`                                |
| Satellite verification | `docs/SATELLITE-VERIFICATION.md`                         |
| This dossier           | `docs/OVERNIGHT-REVIEW.md`                               |
| ADRs                   | `docs/adr/0001`–`0028.md`                                |

---

## Recommended next-session priorities

1. **Real auth.** Cognito user pool + first-party JWT so `/login` actually
   works and `/accounts` is gated. Without this the demo is a tour, not a
   product.
2. **One happy-path real backend call.** Pick the smallest meaningful
   slice — e.g. listing knockers for a single account — and wire it through
   Fastify → Prisma → Postgres so the demo isn't 100% fixtures.
3. **MiCamp sandbox integration.** Phase 0 prereq from the master plan;
   nothing US-side works without it.
4. **Phase 1.1 — start ticking off backend stubs.** 23 domains × ~5 endpoints
   each is the bulk of remaining engineering. Suggest opening with `auth`,
   `org/user`, `territory`, `knock` in that order because every other
   domain depends on them.
5. **Mobile.** Get the Xcode project past hello-world and onto TestFlight —
   the field-rep loop is the product, and right now it only exists as
   React mockups.

---

_Generated overnight by Agent 11. Final commit chain ends at this commit.
Brodie pushes manually._
