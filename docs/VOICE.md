# D2D Voice & Copy Style Guide

**Source of truth for every customer-facing string in the operator console.** This document references [master plan §3](./architecture.md) (visual DNA) and lives alongside [TAXONOMY.md](./TAXONOMY.md) (status pills + naming canon). Polish sprint D (2026-05-27) normalised 60+ ad-hoc copy strings that drifted across the operator surface.

D2D is **professional, dense, NASA mission control**. Operator-grade. Honest about scope. No marketing fluff. Written for ops directors + sales VPs, not consumers.

## 1. Voice — ten principles

1. **Specific over vague** — "247 active knockers" not "many knockers active right now".
2. **Direct over hedged** — "Push to field" not "You can push this to field if you want".
3. **Honest over salesy** — "Phase 1 supports US only" not "Coming soon to your region".
4. **Operator over customer** — density beats friendliness on internal surfaces.
5. **Show the work** — "Reconciled at 03:42 ET from 4 accounts" beats "Updated recently".
6. **Verbs in CTAs** — "Launch campaign" not "Campaign launch"; "Invite knocker" not "Add user".
7. **Active voice** — "Run a sequence" not "A sequence can be run".
8. **Numbers always specific** — "5,200 conversions/mo" not "lots of conversions".
9. **Money is currency-prefixed, locale-formatted** — `$1,605,240` not `1605240` or `1.6M`.
10. **Time is concrete** — "Last knock: 4 min ago" not "Recent knock activity".

## 2. Hard rules (lint-enforced)

These are banned in customer-facing JSX. `pnpm copy:check` fails the build if they regress.

| Pattern                                        | Why                                        | Use instead                           |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `!` in display copy                            | reads as marketing fluff                   | Drop it. Period.                      |
| `Oops` / `Whoops` / `Uh oh`                    | empty / broken is not a personality slot   | "No campaigns yet." / state the fact  |
| `please` (lowercase, mid-sentence)             | hedging                                    | direct verb: "Pick a date range."     |
| `powerful` / `amazing` / `robust` / `seamless` | empty adjectives                           | a specific claim with a number        |
| `awesome` / `great`                            | empty enthusiasm                           | cut                                   |
| emoji in JSX (incl. flags, ✓, ✕)               | inconsistent across OS; not operator-grade | use a Lucide icon (`Check`, `X`, ...) |

## 3. Casing

- **Title Case** — buttons, page titles, nav items, section titles. "Launch Campaign", "Live Field Map", "Onboard New Business".
- **Sentence case** — descriptions, tooltips, helper text, banner copy, KPI hints. "Each account is fully isolated."
- **UPPER CASE** — only for tag/category labels (`SUB-ACCOUNT`, `COMMAND CENTRE`) and numeric units inside metric chips. Tracking-wide-let kerning required.

## 4. Taxonomy reminder

[TAXONOMY.md](./TAXONOMY.md) is canon. The most regressive drifts to watch:

| Concept          | Use          | Never                                  |
| ---------------- | ------------ | -------------------------------------- |
| Field rep        | **Knocker**  | "rep", "agent", "salesperson"          |
| Outbound nurture | **Sequence** | "drip" (visible copy only — routes ok) |
| Marketing asset  | **Creative** | "ad", "post", "asset"                  |
| Door visit       | **Knock**    | "visit", "call"                        |
| Sub-org          | **Account**  | "tenant", "client", "customer"         |

## 5. Patterns — empty states

Format: `<title>.` (sentence case, period, ~6-9 words) + `<description>` (10-20 words, explains what fills this surface + when).

Good:

- "No leads captured yet." → "Every knock by a Hope Forward knocker creates a lead — even if they did not sell on the spot."
- "All knockers offline." → "Either nobody has clocked in, or your shift is between sessions. Live pings reappear the moment a knocker starts their next door."

Bad:

- "No leads here yet!" → exclamation mark
- "Oops, nothing to see." → "Oops"
- "Looks like you have not run a campaign." → "Looks like" hedge
- "Knockers usually post their first lead in 90 minutes!" → exclamation

## 6. Patterns — errors

Format: `<what failed>. <what to do>.` No "please", no "sorry", no exclamation.

Good:

- "Cannot create sub-account: EIN already in use."
- "Network error: connection timed out. Retry below."
- "Server error (503). The button will let you retry."

Bad:

- "Oops! Something went wrong. Please try again."
- "Error: Failed to do the thing!!"

## 7. Patterns — CTAs

Verb first, object second. Title Case for buttons; sentence case for inline link text.

| Good                 | Bad               |
| -------------------- | ----------------- |
| `Launch Campaign`    | `Campaign Launch` |
| `Invite Knocker`     | `Add User`        |
| `Push to Field`      | `Send Now`        |
| `Draw Territory`     | `Get Started`     |
| `Build a Smart List` | `Click Here`      |

## 8. Patterns — banners

`<scoped subject>` (bolded) `·` `<what this surface does>` `·` `<state caveat if any>`.

Good (Today page):

> **Hope Forward** · US · Enterprise plan · last sync 47 seconds ago. All systems nominal.

Good (Onboard wizard):

> Each new sub-account gets its own provisioned workspace, white-labelled Knocker iOS build, dedicated knocker team, paid-solicitor registrations queued, and isolated billing — onboard once, live in 14 days.

## 9. Twenty before/after examples (drawn from the sweep)

| Before                                                            | After                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Welcome to Hope Forward. Finish setup to start capturing leads.` | `Get Hope Forward live — finish setup to start capturing leads.` |
| `Killer shift Jordan — 31 conv already!`                          | `Strong shift Jordan — 31 conv already.`                         |
| `Got it — see you Tuesday. Looking forward to learning more!`     | `Got it — see you Tuesday. Looking forward to learning more.`    |
| `Done — card on file. Thanks!`                                    | `Done — card on file. Thanks.`                                   |
| `🍽 12:30 — 1:00`                                                 | `Lunch · 12:30 — 1:00` (icon component, not emoji)               |
| `Assigned ✓`                                                      | `Assigned` (StatusPill carries the tone)                         |
| `Mark as read · ✓`                                                | `Mark as read` (Lucide `Check` icon if needed)                   |
| `All confirmed ✓`                                                 | `All confirmed`                                                  |
| `✓ Added to plan`                                                 | `Added to plan` (Lucide `Check` icon prepended)                  |
| `Killer shift`                                                    | `Strong shift`                                                   |
| `Welcome back`                                                    | `Sign in to your command centre`                                 |
| `🇦🇺 AU` (RegionBadge flag)                                        | `AU · Australia` (Lucide `Globe2` icon)                          |
| `Coming soon to your region!`                                     | `Phase 1 supports US only`                                       |
| `Updated recently`                                                | `Last sync 47 seconds ago`                                       |
| `lots of conversions`                                             | `5,200 conversions / mo`                                         |
| `Quickly create a new account`                                    | `New Account`                                                    |
| `Easy onboarding flow!`                                           | `5-step wizard · 14 days to live`                                |
| `Awesome work team`                                               | `+18% vs yesterday`                                              |
| `Powerful AI insights`                                            | `Claude analyses 14d of pipeline data`                           |
| `Seamless integration with Stripe`                                | `Stripe webhook latency P95 198ms`                               |

## 10. Adding new copy

1. Read this doc.
2. Run `pnpm copy:check` before opening a PR.
3. If `copy:check` produces a justified false positive, document why in the file and add a path-specific allow-list line in `scripts/check-copy.sh`.
4. If you find yourself writing a new exclamation mark, ask: is this a marketing surface, or an operator surface? If operator, cut the `!`.

## 11. References

- [TAXONOMY.md](./TAXONOMY.md) — status pill + naming canon (Sprint F)
- Sprint A — motion primitives
- Sprint B — realistic data + density
- Sprint C — empty states + first-run
- Sprint E — trust signals
- Sprint D (this doc) — copy + voice
- [`scripts/check-copy.sh`](../scripts/check-copy.sh) — lint guard
