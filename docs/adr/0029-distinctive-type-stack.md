# ADR-0029 — Swap Inter for a distinctive type stack

**Status:** Proposed
**Date:** 2026-05-25
**Deciders:** Brodie
**Phase:** 1.1 hardening (visual identity)
**Supersedes:** the Phase-0 type choice in master plan §3 ("Inter + JetBrains Mono mirroring EazePay")

---

## Context

The Phase-0 master plan locked Inter + JetBrains Mono to match the EazePay Intelligence design DNA. That bought ship-velocity — every page renders cohesively, no font drift across 80+ surfaces, no licensing decisions to litigate.

The cost surfaced in the 2026-05-25 frontend-design critique:

> Inter + JetBrains Mono is the literal forbidden pairing the frontend-design skill warns against. It's perfectly competent — and it's the pairing every Stripe-clone B2B SaaS uses. Nothing about the typography says "this is the D2D operating system."

Through the lens of a prospect who sees three platform screenshots before a sales call: D2D currently reads as "yet another well-built enterprise dashboard." That's a positioning loss against incumbents (SalesRabbit, SPOTIO, Beest) who also look like every other enterprise dashboard. There's no typographic moment that distinguishes D2D from a placeholder Y-Combinator B2B template.

We are an **operator-first ops platform handling money, leads, and field staff in a regulated vertical**. The visual register must remain trust-first: no playful brutalism, no maximalist motion, no design-conference fonts. But within "trust-first ops," there is a wide spectrum of typographic character — Linear (Inter Variable), Mercury News (Mercury Display), Vercel (Geist), Plaid (Söhne), Mux (Suisse Int'l), Notion (Inter + Lyon), Stripe (Sohne) — and Inter sits at the bottom.

## Decision

Adopt **GT America** (sans, display + body weights) + **JetBrains Mono** (code/numbers) as the primary type pair, with **GT Sectra** (transitional serif) reserved for editorial moments (homepage hero, customer story headlines, the master-plan PDF).

**Rationale per typeface:**

| Face               | Role                                                                                    | Why this choice                                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GT America**     | UI sans (nav, body, KPI labels)                                                         | Grotesque with subtle warmth. Used by Klaviyo, Glossier, Mercury, Stripe internally. Reads as "carefully designed enterprise" without screaming. Wide weight range (Thin → Black) supports density gradation. Excellent hinting at small sizes (10-12px ops UI). |
| **JetBrains Mono** | Code, monetary numbers, IDs, timestamps                                                 | Already in the stack. Keep. Tabular-nums by default.                                                                                                                                                                                                             |
| **GT Sectra**      | Editorial display (sparing — public site hero, ADR headings, the master plan PDF cover) | High-contrast transitional serif. Used by Wired, Bloomberg Businessweek. Adds intellectual gravitas without rococo flourish.                                                                                                                                     |

## Alternatives considered

| Pair                                    | Verdict          | Reason rejected                                                                                                                           |
| --------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Söhne (Sans + Mono)**                 | Strong           | Klim's Söhne is excellent but $1,200/yr per app license × 4 apps = $4,800/yr ongoing. GT America is similar quality + amortized one-time. |
| **PP Editorial Old / PP Neue Montreal** | Too editorial    | Pangram Pan's faces are beautiful but Editorial Old reads as fashion-magazine, not operator console. Save for the public-site hero only.  |
| **Inter Variable + Inter Display**      | Marginal upgrade | Still Inter at the core. Solves nothing.                                                                                                  |
| **Object Sans**                         | Cute             | Designspun's Object Sans is great for marketing but its slight quirkiness undermines the trust-first ops register.                        |
| **Geist (Vercel)**                      | Risky            | Free + technically nice but very visibly Vercel's font. Borrowing identity from a developer-tools company doesn't help an ops platform.   |
| **Suisse Int'l**                        | Strong           | Swiss Typefaces. Beautiful but $3K+ per app annually. GT America is cheaper and 95% as good for our register.                             |
| **Söhne Schmal (narrow)**               | No               | Narrow sans reads stylish but kills readability in data-dense ops tables.                                                                 |
| **Maison Neue**                         | Considered       | Milieu Grotesque face. Bumpy hinting at 10-12px UI sizes.                                                                                 |
| **Stay on Inter**                       | Status quo       | Critique still applies. Cost-of-staying = positioning indistinguishability.                                                               |

## Consequences

### Positive

- **Brand fingerprint.** Three D2D screenshots in a deck will read as distinctly D2D, not "generic enterprise SaaS." This is the single biggest visual delta available without rebuilding IA.
- **Type pairing earns the EazePay DNA upgrade.** EazePay can adopt the same pair retroactively for visual through-line across Brodie's product portfolio (AUREANOS / EAZEPay / D2D / Amala).
- **License cleared once.** GT America is sold per-app perpetual (typewolf-tracked ~$300/app one-shot weight subset, ~$1,200/app full family). Buy once, ship forever. No SaaS license ticking.
- **Self-hosting eliminates third-party request.** WOFF2 self-hosted from `/_next/static/media/...` removes the Google Fonts request, improves LCP, removes a CSP / privacy surface.

### Negative

- **Cost.** ~$1,200 one-time for the full GT America family across web-operator + the future apps. ~$400-600 for GT Sectra editorial cuts. Total ~$2K. Compared to the SaaS alternatives ($5K-10K/yr ongoing) this is cheap; compared to "free Inter" it's not.
- **Migration touchpoint.** Every page renders type via `@d2d/ui-tokens`. Single PR replaces the `--font-sans` and `--font-display` CSS variables + `next/font/local` definition. Visual regression risk is low (line-heights are similar) but every page should be reviewed for ascender/descender / metrics drift.
- **Future engineers need access to the font files.** Add to a private `~/assets/fonts/` location and reference in `apps/web-operator/src/styles/fonts.ts` via `next/font/local`. Don't commit the WOFF2 files to the public repo — keep them in the private deploy artefact bucket.
- **EazePay design DNA mirroring breaks if EazePay stays on Inter.** Either commit to upgrading both products together OR explicitly decide D2D diverges from EazePay's type stack.

## Migration plan

1. **Procure GT America + GT Sectra licenses** (action: Brodie · ~1 hr · ~$2K)
2. **Land WOFF2 files** in `apps/web-operator/src/styles/fonts/` (`.gitignore` the actual files, commit a `README.md` pointing to the private bucket)
3. **Update `packages/ui-tokens/src/styles/globals.css`** — swap `--font-sans` and `--font-display` CSS variables
4. **Update `apps/web-operator/src/app/layout.tsx`** — replace the existing `next/font/google` Inter import with `next/font/local` GT America
5. **Visual regression sweep** — open one representative page per major surface (Login, /accounts, /accounts/[slug]/today, /command-centre, /marketing-studio, /territory-intel) and confirm no broken layouts from x-height shift
6. **Update tailwind preset** in `packages/ui-tokens/tailwind-preset.cjs` if any explicit font-family declarations exist
7. **Re-deploy to Railway**, screenshot all 6 representative surfaces in the PR description

**Total effort:** 4-6 hours of engineering once licenses are in hand, blocked behind the procurement step.

## Rollout

Single-shot replacement. Not feature-flagged. The whole product picks up the new type stack on the same deploy. No A/B test makes sense for foundational typography.

## When to revisit

- If EazePay/AUREANOS adopts a different stack and "Brodie portfolio coherence" outweighs "D2D distinctiveness" — re-converge.
- If a real designer (hired in Phase 1.4+) wants to redo the type system — they own the next ADR.
- If Inter Variable ever ships a "Display" cut that's meaningfully different from current Inter — re-evaluate the cost case.

## References

- frontend-design skill — `~/.claude/skills/frontend-design`
- 2026-05-25 design critique (in-chat, recorded in this session's transcript)
- Master plan §3 — Tech stack (current Inter + JetBrains Mono lock-in)
- ADR-0028 — MiCamp US processor (most recent ADR template)
- Klim Type Foundry — Söhne licensing reference
- Grilli Type — GT America + GT Sectra licensing reference
