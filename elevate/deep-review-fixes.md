# D2D — Deep Review of New Code · 21 Defects Found + Fixed
> Adversarial review of the 87 files built since checkpoint f8c58f1 · each finding independently verified (24 raw → 21 confirmed, 3 false positives killed) · all 21 fixed · both typechecks exit 0

## Why this mattered
The full-platform "standard" pass confirmed every page works (no dead buttons, honest, typechecks). But "every button works" can't see **data-protection holes, race conditions, FK violations, or honesty regressions**. This deep review did — and found a **P0 location-PII leak** plus 7 P1s a surface check would never catch.

## P0 (1) — fixed
| Defect | Fix |
|---|---|
| `api/activity` returned **unmasked household street addresses** paired with disposition labels ("Hostile", "Do Not Knock") — linking a residence to a resident's reaction, to any org user | Narrowed the Prisma select to `locality` only; feed now shows coarse area, never street. Precise address must go through JIT unmask + audit. |

## P1 (7) — fixed
| Defect | Fix |
|---|---|
| `api/fleet` shipped **exact last-knock GPS** (resident's doorstep) + leaked raw `org_*` id as the account name | Coarsened geo to ~100m grid (3dp); emit `org.tradingName` not the PK |
| `marketing/queueCreatives` **500'd for every org without a connected Meta account** (dangling `pending_connection` FK) | Upsert a reusable per-org placeholder AdAccount (`status:'pending_connection'`) so the FK resolves — no migration |
| `HQLiveMapImpl` highlight ring keyed off a **fixture rep id that never matches live ids** | Re-keyed highlight + fly off coordinates (`highlightCoords` from `anomaly.repCoords`) — survives the fixture→live swap |
| Roster `DataSourceBadge` flipped **LIVE over seed data** on an empty-week API response | `markFresh()` only on non-empty rows; `markFixture()` on empty |
| Roster multi-select Set **not cleared on week nav** — bulk bar persisted with stale ids | `useEffect(clearSelection, [weekOffset])` |
| `regions/sg/compliance` had `'use client'` **after the imports** → inert → server-component crash on its handlers | Moved `'use client'` to line 1 |

## P2 (8) — fixed
- `broadcast` claimed an audit row but wrote none → now writes a real `field.broadcast` AuditEvent in a tx
- `marketing/review-queue` ignored super_admin `?orgId=` → forwards it via `x-d2d-org`
- CAPI processor hardcoded `currency='USD'`/`type='donation_oneoff'` → derives currency from OrgBilling, type from `lead.vertical` (charity→donation_oneoff, commercial→sale_commercial)
- command-centre fly target now derives from `anomaly.repCoords` (consistent with highlight)
- ReassignDrawer showed a **green success toast on a no-op write** → branches on `persisted`: success vs honest "staged" info toast
- Roster copy-last-week appended **duplicate shifts** → dedups against current week before bulk POST
- Roster edit-shift **hardcoded lunch to 45 min** on untouched save → parses stored lunch
- Roster saving an **in-progress lunch destroyed the `-CURRENT` sentinel** → preserves it

## Verification (ground truth)
- `npx tsc --noEmit` web **exit 0**, api **exit 0**
- grep-confirmed every fix landed: street select gone, geo coarsened, account=org name, `use client` line 1, broadcast writeAudit, marketing placeholder upsert, highlightRepId gone
- Browser: sg/compliance renders 200 (was crashing), signature interaction intact (drawer + 12 reps + 126 pins)

## Method note
24 raw findings → 21 confirmed. The 3 false positives were killed by the independent verifier (each finding re-read against the actual code by a separate agent before it reached the fix list) — so no time spent chasing phantom nits.
