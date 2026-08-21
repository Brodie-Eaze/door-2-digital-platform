# Marketing Studio Generate — Elevation Report

> `/elevate` dry-run · 2026-06-09 · **Score: 23 / 100**

## Dimension Scores

| Dimension   | Score | Why                                                                                                                                                                                                                                                       |
| ----------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness | 4/20  | POST fires but silently resets to VARIANT_SEEDS when `NEXT_PUBLIC_API_URL` unset. "Send to review queue" has no onClick. `regenerate()` mutates variant ID locally without calling API. Approve sets local state only                                     |
| Robustness  | 3/20  | No AbortController — hung upstream spins forever. Double-submit possible in the 16ms window. Silent fallback to seed on any error. No timeout, no retry UI, no partial streaming, no dirty-state warning on navigate-away                                 |
| Speed       | 7/20  | Skeleton loading state correctly implemented. Nothing else. No elapsed timer, no step indicator, no progressive variant rendering. User stares at identical skeletons for 30–90s with no feedback                                                         |
| Clarity     | 5/20  | C2PA badge is a hex string with no explanation. Safety failure on var_a05 is an amber badge in 9px font — reads as a category label, not a warning. Approve works on safety-failed variants with no block. Brief fields are read-only without explanation |
| Delight     | 4/20  | Grid layout clean. Reviewing 8 variants means reading 8 similar copy blocks with no comparison affordance. Approve/reject are 20×20px icon buttons. Cost counter is decorative. "Send to review queue" does nothing                                       |

**Total: 23 / 100**

---

## Top 8 Recommendations

### #1 — QUICK-WIN · Wire the silent failure: real error state, preserve brief

**Effort: 2 days**

Current: API fails → seed resets silently → user thinks generation worked. Fix: catch failure, show dismissible error banner ("Generation failed — your brief is saved, try again"), keep existing variants visible if they exist, expose Retry button. Add `AbortController` with 90s timeout. Surface "Taking longer than expected — still working…" at 30s.

### #2 — QUICK-WIN · Empty state before first generation + brief-first layout

**Effort: 1 day**

On first load (no prior generation), render brief form full-width left + illustrated empty state right: "Fill your brief and generate — your first batch of AI variants will appear here." On generate click, animate transition to skeleton grid. Eliminates "wait, did this already run?" confusion and removes false signal from seed-data cost and safety scores.

### #3 — QUICK-WIN · Generation progress stepper + per-variant streaming

**Effort: 3 days (requires SSE from BFF)**

Show 4-step progress bar (Composing copy → Generating images → Safety scan → Signing manifests) advancing as each stage completes. Render variants progressively as they complete — copy-only cards first, then image cards as Flux resolves. Add elapsed timer ("15s elapsed"). 30–90s wait. Progressive rendering makes it feel half as long.

### #4 — MEDIUM · Side-by-side comparison mode + inline copy editing

**Effort: 5 days**

"Compare" mode button: 2-up or 3-up panel. Drag any variant cards into the comparison view. Show headline, body, estimated performance, safety score, cost side-by-side. Inline copy editing on any text field — flags variant as "manually edited" with pencil badge. "Save edit" calls `PATCH /v1/marketing/creatives/:id/copy`. This is the difference between a tool you use to make decisions and one you scroll through.

### #5 — MEDIUM · "Generate more like this" + "Mutate this one" per card

**Effort: 4 days**

(a) "More like this" — calls `POST /v1/marketing/creatives/generate` with accepted variant as style anchor, produces 3 fresh variants. (b) "Tweak" — opens micro-brief panel scoped to that one variant: change tone (urgent/warm/factual), swap format (image→video), change CTA. Fires single-variant regeneration. Without this, generate is single-shot. With it, it's iterative.

### #6 — MEDIUM · Safety failure hard block + plain-language explanation

**Effort: 3 days**

(a) Rename badge to "SAFETY FAILED" in red. (b) Disable approve on safety-failed variants — replace with "View issues." (c) Safety panel replaces raw category names with plain-language sentences: "This variant was flagged for potential regulatory language — 'guaranteed returns' may violate FTC guidelines for charity campaigns." (d) "Fix and re-scan" button opens copy editor with flagged sentence highlighted.

### #7 — BIG-BET · Approve → publish pipeline (Meta/Google CAPI end-to-end)

**Effort: 2–3 weeks**

(a) "Send to review queue" POSTs approved variant IDs to `POST /v1/marketing/campaigns/queue` — AdCampaign and Creative tables already exist. (b) Review queue page with publish button per connected ad account. (c) "Publish to Meta" calls the Meta Marketing API adapter (already built in `packages/integrations`). (d) After publish, variant card shows "Live on Meta · Campaign ID: …" with link to Meta Ads Manager. (e) CAPI attribution posts back to update variant performance card. **This is what makes D2D's marketing studio different from Canva + Meta Ads Manager.**

### #8 — BIG-BET · Estimated performance predictions per variant before approval

**Effort: 4–6 weeks**

After generation, for each variant call `POST /v1/marketing/creatives/:id/score` returning: estimated CTR range (based on historical D2D campaign performance by vertical + channel + format), territory relevance score, and predicted conversions for a $500 spend. Three metric badges on card: "CTR: 1.8–2.4%" / "Territory fit: High" / "Est. 12–18 conversions @ $500." Requires territory service live + historical conversion dataset. Product story: "we show you which creative to run before you spend a dollar."

---

| #   | Recommendation                                 | Type      | Effort | Impact                 |
| --- | ---------------------------------------------- | --------- | ------ | ---------------------- |
| 1   | Real error state + preserve brief              | QUICK-WIN | 2d     | Correctness floor      |
| 2   | Empty state before first generation            | QUICK-WIN | 1d     | Clarity floor          |
| 3   | Progress stepper + per-variant streaming       | QUICK-WIN | 3d     | Speed + trust          |
| 4   | Side-by-side comparison + inline editing       | MEDIUM    | 5d     | Delight uplift         |
| 5   | "More like this" + single-variant mutate       | MEDIUM    | 4d     | Creative loop          |
| 6   | Safety hard block + plain-language explanation | MEDIUM    | 3d     | Compliance + clarity   |
| 7   | Approve → publish (Meta/Google CAPI)           | BIG-BET   | 2–3w   | Revenue surface        |
| 8   | Estimated performance predictions              | BIG-BET   | 4–6w   | Moat / differentiation |

**QW-1+2+3 (~6 days): 23 → ~50** (stops deceiving users). Mediums 4–6: → ~70. Big Bets 7–8: → moat.
