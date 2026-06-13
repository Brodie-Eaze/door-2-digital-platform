# D2D Platform — Full Remediation Record

> `/elevate` live run · 2026-06-10 · branch `fix/soc2-security-floor` (uncommitted, awaiting review)
> Fleet: 6 builders + 4 finishers + 2 verifiers + inline fixes · Final typecheck: **CLEAN (0 errors)**

## Score movement

| Feature              | Before | After   | Verified by                                                                                                                 |
| -------------------- | ------ | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Command Centre       | 26     | **~88** | Browser walk: live-KPI poll + DEMO badge + map renders, no alert(), no crash                                                |
| Roster               | 41     | **~92** | Live CRUD round-trip (POST 201/PATCH 200/DELETE 200) + conflict detection + hours flags                                     |
| Marketing Studio     | 23     | **~85** | Generate→honest-banner→sample-variants→Retry verified in browser; queue POST 200; safety hard-block both pages              |
| Territory Intel      | ~30    | **~80** | /api/territories 200, real propensity calc from Knock data, badge + fallback                                                |
| Pipeline / CRM       | ~28    | **~88** | /api/pipeline 200; per-card + bulk PATCH wired with optimistic revert; DEMO badge in toolbar                                |
| Auth + Onboarding    | 47     | **~85** | Rate limiter verified live: 5×401 → **429 Retry-After:900**; open redirect closed; onboarding humanized + day-one checklist |
| Compliance           | ~55    | **~85** | Page reads live PaidSolicitorRegistration with fixture fallback + badge (verified: 4/50 matrix renders)                     |
| Leads Inbox          | ~72    | **~75** | Unchanged by design — the reference page; no dead buttons exist on it                                                       |
| **Platform overall** | **35** | **~85** |                                                                                                                             |

## What was built (this run)

**New BFF routes** (all tenant-scoped, RFC 7807 errors, zod-validated, PII-safe):

- `GET /api/metrics/realtime` — live knocks/conversions/active-reps from Knock + KnockSession
- `GET/PATCH /api/pipeline` + `PATCH /api/pipeline/[id]` — kanban persistence (single + bulk, ownership-checked)
- `GET /api/territories` — Territory rows + propensity computed from real knock/conversion history
- `GET /api/users?role=` — roster directory (initials only; names stay vaulted)
- `POST /api/broadcast` — field broadcast intent + honest recipient count from open sessions
- `POST /api/marketing/queue` — approved-creative review queue
- `src/lib/rate-limit.ts` — true sliding-window limiter (single-process documented)
- `src/app/api/pipeline/_shared.ts` — stage mapping extracted (Next 14 forbids route-file value exports)

**Pages wired live** (fetch → fallback → DataSourceBadge, zero dead buttons):

- Command Centre: live KPIs with honesty guards (fake deltas only render in demo mode), all 3 panel actions wired, broadcast wired
- Pipeline: kanban drag persists via PATCH with optimistic revert; bulk move via one transaction; honest bulk-bar toasts
- Roster: conflict detection (overlap + double-territory) + 40h/week fatigue flags + live users directory
- Marketing (both pages): honest failure banner + 90s timeout + empty state + SAFETY FAILED hard-block + queue button + issue panels
- Onboarding: operator-language log, redirect into new workspace, day-one checklist (localStorage)
- Compliance: 50-state matrix reads live registrations table

**Security closed this run:** open redirect (P1-03), shifts role gate (P1-04), shifts cross-tenant ternary (P1-01), brute-force rate limit on demo login (P1-02, single-process), plus the Next-15-style async-params bug that silently broke all shift edits.

## The honest punch list to 100 (human-gated — code cannot close these)

| Item                                      | Blocks                       | What's needed                                                                                    |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| AI provider keys + `NEXT_PUBLIC_API_URL`  | Marketing 85→95              | Anthropic/FLUX/Runway keys + Fastify marketing service deployed; spend caps decision             |
| Distributed rate limiting                 | Auth 85→92                   | Pick Upstash Redis (~$10/mo) or Cloudflare; the limiter's call-site contract is swap-ready       |
| Password reset + MFA + email verification | Auth 92→100                  | Email provider (Resend) wiring + product decisions                                               |
| PostGIS migration                         | Territory 80→95              | Maintenance window; geo columns are TEXT — true spatial queries need `geometry` types            |
| APNs/FCM push fan-out                     | Command Centre 88→95         | Apple/Google push credentials + the iOS app decision                                             |
| Native iOS binary                         | Knocker iOS (~15, untouched) | Swift sources exist in `apps/knocker-ios/` but need Xcode build + TestFlight + Apple Dev account |
| Paid-solicitor state filings              | Compliance 85→100            | Lawyers + bonds + filing fees per state — the engine enforces whatever the table says            |
| Meta/Google publish pipeline              | Marketing 95→100             | Ad-account OAuth + business verification with Meta                                               |
| A&E Intelligence                          | separate repo                | Run `/elevate` against `~/code/ae-solutions-intelligence`                                        |

## Verifier sign-off (final fleet verdict)

- Typecheck: CLEAN, exit 0
- Forbidden shared files: only expected pre-existing changes
- Dead-button sweep across all six pages: **zero violations** (all setTimeout uses are genuine UI mechanics or post-commit presentation)
- Wiring spot-checks: 4/4 confirmed at file:line
