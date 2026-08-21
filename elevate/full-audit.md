# D2D Full-Platform Standard Audit
> Generated 6-cluster read-only audit · 91 pages scored

## Verdict counts
- FUTURE-PHASE-OK: 2
- STUB: 13
- NEEDS-WIRING: 47
- AT-STANDARD: 28
- HUMAN-GATED: 1

## Per-page verdicts
| Page | Verdict | Dead btns | Note |
|---|---|---|---|
| overview/page.tsx | FUTURE-PHASE-OK | 0 | Honest Phase-0 scaffold: banner explicitly states 'Phase 0 scaffold deployed. Real data wires up in Phase 1.4.' All KPIs are zeros/dashes (not fabricated), no b |
| alerts/page.tsx | STUB | 0 | 14-line placeholder: only a Banner reading 'Alerts surface scaffolded. Full impl in Phase 1.4.' Nav implies a real alerts feature. Needs a real build (or wire t |
| audit/page.tsx | NEEDS-WIRING | 0 | Renders from RECENT_AUDIT fixture but has NO DataSourceBadge and the hash-chain column fabricates values via Math.random() each render (audit/page.tsx:66) — a s |
| billing/page.tsx | NEEDS-WIRING | 2 | All invoice + residual data is hardcoded module constants (INVOICES, RESIDUALS) with no fetch and no DataSourceBadge, and two dead buttons: 'Export CSV' (billin |
| billing/processor/page.tsx | STUB | 0 | 14-line placeholder Banner 'See parent page · drill-down view scaffolded.' Nav implies a processor/residuals drill-down. Needs real build. |
| planning/page.tsx | NEEDS-WIRING | 0 | Thin wrapper rendering <PlanningSurface> from the static HQ_PLANNING fixture (lib/account-planning) with no fetch and no DataSourceBadge surfaced. Verdict hinge |
| settings/page.tsx | STUB | 0 | 16-line placeholder Banner 'Scaffolded. Full implementation in the relevant phase.' Nav implies a real settings surface. Needs real build. |
| command-centre/page.tsx | AT-STANDARD | 0 | Clean. Live fetches /api/activity and /api/metrics/realtime with fixture fallback, two DataSourceBadge+useDataFreshness instances, no dead buttons. Already-reme |
| compliance/page.tsx | AT-STANDARD | 0 | Clean. loadClearances() fetches live with STATE_CLEARANCE fixture fallback and reports source to DataSourceBadge; no buttons to be dead. Holds. |
| compliance/state-clearance/page.tsx | STUB | 0 | 14-line placeholder Banner 'See parent page · drill-down view scaffolded.' Nav implies a per-state clearance drill-down. Needs real build. |
| territory-intel/page.tsx | AT-STANDARD | 0 | Clean. Fetches /api/territories with fixture fallback ranked by propensity, DataSourceBadge+useDataFreshness present; the lone setTimeout (line 390) is a legit  |
| screens/page.tsx | AT-STANDARD | 0 | Clean honest navigation catalogue: every tile is a real next/link to a live screen, banner accurately says 'Click any tile to open the live screen.' No data cla |
| mobile-preview/page.tsx | HUMAN-GATED | 0 | Honest static web preview of the native Knocker iOS app — banner explicitly states the real app is built in Xcode/SwiftUI (ADR-0003) and shipped via TestFlight. |
| roster/page.tsx | AT-STANDARD | 0 | Clean. Full CRUD against /api/users and /api/shifts (POST/PATCH/DELETE/bulk) with DataSourceBadge+useDataFreshness; the setTimeout at line 1239 is a 50ms drag-f |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/page.tsx | NEEDS-WIRING | 1 | Studio hub: all KPIs hardcoded ("412", "94.2%", "5.2x") with NO fetch and NO DataSourceBadge, banner doesn't disclaim it's a fixture overview, and there is zero |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/brand-safety/page.tsx | NEEDS-WIRING | 2 | Renders fine but fully hardcoded (RECENT_BLOCKS, custom rules) with NO fetch/DataSourceBadge and no fixture disclaimer; rows carry cursor-pointer (subtitle says |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/campaigns/page.tsx | NEEDS-WIRING | 5 | Row click opens a real side panel (good, line 731 setOpenId), but every spend/lifecycle action button (Pause, Resume, Open-in-channel, Filter, New campaign) is  |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/generate/page.tsx | AT-STANDARD | 0 | Clean. Real POST /api/marketing/generate (AbortController + 90s timeout + 30s slow-hint), honest 'fixture' fallback with explicit error copy, live DataSourceBad |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/integrations/page.tsx | NEEDS-WIRING | 3 | ConnectModal opens correctly and the provider docsUrl is a real external link, but Connect/Save/Disconnect are silent fakes (just close the modal with no OAuth/ |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/library/page.tsx | NEEDS-WIRING | 4 | Filter chips and the inspect side-panel (line 1500 onOpen) work, but every creative lifecycle action — bulk bar, per-card Approve/Reject, and panel footer — is  |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/retargeting/page.tsx | NEEDS-WIRING | 1 | Pure read-only dashboard with zero buttons, but ALL funnel/cohort/rake numbers are hardcoded (FUNNEL, COHORTS) with NO fetch and NO DataSourceBadge, and the ban |
| /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/onboard-account/page.tsx | AT-STANDARD | 0 | Holds. Real POST /api/orgs with crypto.randomUUID idempotency key, credentials, 4xx/5xx + network error handling with retry, and real router.push into the new a |
| admin/plans/page.tsx | STUB | 0 | 16-line placeholder rendering only a Banner reading 'Scaffolded. Full implementation in the relevant phase.' Nav implies a real plans/billing admin surface; nee |
| admin/secrets/page.tsx | STUB | 0 | Identical 16-line 'Scaffolded' Banner placeholder. Nav implies a secrets/credentials management surface; nothing rendered. Needs real build (or honest 'managed  |
| admin/users/page.tsx | STUB | 0 | Identical 16-line 'Scaffolded' Banner placeholder. Nav implies a real user/RBAC admin table; nothing rendered. |
| ops/data-sources/page.tsx | STUB | 0 | Identical 16-line 'Scaffolded' Banner placeholder. Ironic given the DataSourceBadge pattern exists elsewhere; nav implies a connector/health-of-sources view tha |
| ops/health/page.tsx | STUB | 0 | Identical 16-line 'Scaffolded' Banner placeholder. Nav implies a system/service health dashboard; nothing rendered. /api/metrics/realtime route exists and could |
| orgs/page.tsx | NEEDS-WIRING | 0 | Renders a real client-orgs table but reads straight from static ORGS fixture (import at line 5) with no fetch and no DataSourceBadge, unlike remediated pages —  |
| orgs/pilot-charlie/page.tsx | NEEDS-WIRING | 0 | Rich org-detail page but all data is hardcoded/fixture (PILOT, STATE_CLEARANCE at line 4; contract terms like 250000n cents, rakes, billing day hardcoded inline |
| orgs/provisioning/page.tsx | STUB | 0 | Identical 16-line 'Scaffolded' Banner placeholder. Nav implies a tenant-provisioning workflow; nothing rendered. |
| accounts/page.tsx | AT-STANDARD | 0 | Live: server component reads Prisma org.findMany + grouped lead counts, tenant-scoped via session, graceful fixture fallback, with a real Database/Fixture badge |
| accounts/[slug]/today/page.tsx | AT-STANDARD | 0 | Honest per-account command-centre. Server component over accountData/rollup fixtures with first-run empty state; no buttons (only nav links via href), renders f |
| accounts/[slug]/leads/page.tsx | AT-STANDARD | 0 | Live: server component reads db.lead.findMany scoped per org with maskEmail/maskPhone at the boundary, real Database/Fixture badge (lines 195-209), graceful fix |
| accounts/[slug]/leads/maria-santos/page.tsx | NEEDS-WIRING | 1 | 'use client' page with fully hardcoded LEAD + TIMELINE constants, no fetch and no DataSourceBadge (presents fabricated audit-chain data as if real). 'View sugge |
| accounts/[slug]/pipeline/page.tsx | AT-STANDARD | 1 | Live: real GET /api/pipeline, PATCH /api/pipeline/[id], POST /api/pipeline, DataSourceBadge + useDataFreshness, working drag-drop/bulk-move/single-move. setTime |
| accounts/[slug]/conversations/page.tsx | NEEDS-WIRING | 2 | Hardcoded THREADS array, no fetch, no badge; KPIs are hardcoded literals ('287' messages, '64' calls, '8m'). Search input (line 100) has no value/onChange and t |
| accounts/[slug]/conversions/page.tsx | NEEDS-WIRING | 1 | Reads seedFor/rollupFor fixtures with a good first-run empty state and renders cleanly — but no DataSourceBadge and the section subtitle/action claims 'click an |
| accounts/[slug]/commissions/page.tsx | STUB | 0 | Non-first-run path renders only an info Banner: 'full screen wired in the previous build (web-org/commissions). Being merged into this account workspace.' Nav i |
| accounts/[slug]/inside-sales/page.tsx | STUB | 0 | Same pattern as commissions: non-first-run path is just a 'Being merged into this account workspace' banner (web-org/inside-sales) with no real screen. Nav impl |
| accounts/[slug]/knockers/page.tsx | NEEDS-WIRING | 0 | Reads accountData/rollupFor fixtures with a solid first-run empty state and renders a clean roster table — no dead buttons (pure table, no CTAs). Gap is data-ho |
| accounts/[slug]/team/page.tsx | NEEDS-WIRING | 2 | Hardcoded TEAM array, no fetch, no badge. 'Invite' button (line 117) has no onClick = dead. Section subtitle says 'Click any member to manage role + permissions |
| accounts/[slug]/tasks/page.tsx | NEEDS-WIRING | 2 | 'use client' Kanban over buildTasks fixtures; view/priority/search/drag-drop/move-column all drive real local state (setTimeout at 328 is a legit drag-debounce) |
| accounts/[slug]/lead-lists/page.tsx | NEEDS-WIRING | 5 | Hardcoded LISTS array (lead-lists/page.tsx:7-48) rendered with no DataSourceBadge and no fetch; several CTAs have no onClick. Fix: add a real/fixture fetch + Da |
| accounts/[slug]/smart-lists/page.tsx | NEEDS-WIRING | 7 | Rich local-state UI (list selection, push modal with channel toggles) but data is a hardcoded module-level LISTS fixture (smart-lists/page.tsx:65) with no DataS |
| accounts/[slug]/campaigns/page.tsx | NEEDS-WIRING | 3 | Hardcoded CAMPAIGNS array (campaigns/page.tsx:7-63) with bigint spend/CPA math, no DataSourceBadge/fetch; row pause/play and external-link buttons have no onCli |
| accounts/[slug]/drip/page.tsx | NEEDS-WIRING | 4 | Hardcoded DRIPS array (drip/page.tsx:7-55) rendered with no DataSourceBadge/fetch; every action button is inert. Fix: add badge/fetch and wire (or honest-toast) |
| accounts/[slug]/automations/page.tsx | STUB | 0 | 37-line page: first-run shows an EmptyState that redirects to Workflows; non-first-run shows only an info Banner saying the real screen 'is being merged into th |
| accounts/[slug]/workflows/page.tsx | NEEDS-WIRING | 6 | In-component fixture (WORKFLOWS/triggers arrays ~line 439) with no DataSourceBadge/fetch; only the status-filter chips work. All card/header/template action but |
| accounts/[slug]/memberships/page.tsx | NEEDS-WIRING | 1 | Procedurally generated fixture member list (names array ~line 217) with no DataSourceBadge/fetch; only the status filter (line ~547) works and the per-row 'Reac |
| accounts/[slug]/marketing-studio/page.tsx | NEEDS-WIRING | 3 | Overview pulls from getAccountMarketing() — a pure static registry lookup (lib/account-marketing.ts:2228), no DataSourceBadge/fetch; 'Review all' and per-creati |
| accounts/[slug]/marketing-studio/brand-safety/page.tsx | NEEDS-WIRING | 6 | Fixture via getAccountMarketing() (static registry), no DataSourceBadge/fetch; the entire block-management toolbar is inert. Fix: badge + wire override/discard/ |
| accounts/[slug]/marketing-studio/campaigns/page.tsx | NEEDS-WIRING | 3 | Fixture via getAccountMarketing() with no DataSourceBadge/fetch; the Inspect button opens a real detail drawer (good) but pause/resume and open-in-channel only  |
| accounts/[slug]/marketing-studio/generate/page.tsx | AT-STANDARD | 0 | Clean. Real /api/marketing/generate + /api/marketing/queue fetches with fixture fallback, DataSourceBadge + useDataFreshness, honest toasts, real approve/reject |
| accounts/[slug]/marketing-studio/integrations/page.tsx | NEEDS-WIRING | 2 | Fixture via getAccountMarketing(), no DataSourceBadge/fetch; the provider detail-modal's Connect/Save/Disconnect buttons all just call onClose() — a connect flo |
| accounts/[slug]/marketing-studio/library/page.tsx | NEEDS-WIRING | 6 | Fixture via getAccountMarketing(), no DataSourceBadge/fetch; selection + Inspect drawer work, but the bulk toolbar and per-tile approve/reject are inert. Fix: b |
| accounts/[slug]/marketing-studio/retargeting/page.tsx | NEEDS-WIRING | 0 | Read-only analytics dashboard derived entirely from getAccountMarketing() fixture (retargeting cohorts, 5% rake math) with no DataSourceBadge/fetch. No fake CTA |
| accounts/[slug]/marketing-studio/review-queue/page.tsx | AT-STANDARD | 0 | Clean. Real /api/marketing/review-queue fetch with DEMO fallback, DataSourceBadge + useDataFreshness, working Refresh, and publish honestly gated on a live prov |
| accounts/[slug]/roster/page.tsx | AT-STANDARD | 0 | Confirmed holds. Seed-derived roster (buildRoster) with first-run/empty states; full interactivity (drag-drop reassign, clock-out, edit modal). setTimeout(50ms) |
| accounts/[slug]/territories/page.tsx | NEEDS-WIRING | 1 | Mostly solid (real heatmap, Send-knocker updates state, honest 'Phase 1.2' draw-mode banner) but the 'Filter' button has no handler. |
| accounts/[slug]/live-map/page.tsx | NEEDS-WIRING | 1 | Live fleet data + KPIs + map are real, but PushToFieldStrip onAction only console.log's instead of firing an action or honest toast (comment admits 'Phase 1.2,  |
| accounts/[slug]/calendars/page.tsx | NEEDS-WIRING | 8 | Appointment click-to-detail and type-filter work, but week-nav arrows + Today, detail-panel Call/SMS/Join, and per-slot Share are dead; 'Book it' closes the mod |
| accounts/[slug]/forms/page.tsx | NEEDS-WIRING | 6 | Seed data + status-filter tabs render fine, but every action button is dead: 'Open builder', 'New form', and per-card Edit/Preview/Embed have no onClick. |
| accounts/[slug]/files/page.tsx | NEEDS-WIRING | 5 | Folder-select and grid/list view toggle work, but Upload, Filter, and per-file action icons (download/share/more at ~489-495) are dead. |
| accounts/[slug]/sites/page.tsx | NEEDS-WIRING | 6 | Status-filter tabs work, but 'Edit'/'New site' header buttons and per-site action icons (~489-495) and footer link are dead. |
| accounts/[slug]/invoices/page.tsx | NEEDS-WIRING | 3 | Seed invoice data renders, but zero onClick on the page: 'Download' header and per-row 'View PDF'/'Resend' icon buttons all dead. |
| accounts/[slug]/planning/page.tsx | AT-STANDARD | 0 | Thin wrapper delegating to PlanningSurface with real getAccountPlanning data + first-run/empty states. No dead buttons at this layer (verify PlanningSurface sep |
| accounts/[slug]/reports/page.tsx | NEEDS-WIRING | 2 | KPIs/charts use real seedFor/rollupFor data, but zero onClick: 'Build report', per-report 'CSV' download, and 'View' links are dead. |
| accounts/[slug]/compliance/page.tsx | NEEDS-WIRING | 4 | Account-scoped compliance table renders from derived data but has zero onClick: 'Generate report', row 'View', 'Refresh', and 'Rotate keys' are all dead. |
| accounts/[slug]/knocker-ios/page.tsx | AT-STANDARD | 0 | Honest white-label PREVIEW surface (the real iOS binary is human-gated); brand mocks derived from account, links to real /mobile-preview route. No action button |
| accounts/[slug]/settings/page.tsx | NEEDS-WIRING | 0 | Pure read-only display with no edit/save affordance despite banner claiming 'changes audit-logged + pushed in 60s'; several fields are hardcoded literals (EIN 8 |
| regions/au/page.tsx | AT-STANDARD | 0 | Region control panel derives KPIs from ACCOUNTS; static AU state-clearance table is an honest intel fixture. No buttons, pure read-only. Clean. |
| regions/au/compliance/page.tsx | NEEDS-WIRING | 1 | Renders state-licence/cooling-off fixtures fine, but the 'Cancel & refund' row button has type=button and no onClick — dead. |
| regions/au/payments/page.tsx | NEEDS-WIRING | 0 | Hardcoded Stripe AU/GoCardless events and MTD totals presented as live with no fetch, no DataSourceBadge, and no 'demo/fixture' label visible to the user. Small |
| regions/au/territory-intel/page.tsx | NEEDS-WIRING | 4 | Static SA1 ZONES table (honestly labelled 'AU Phase 2') renders, but 'Filter', 'Add zone' (Plus), the row 'View' link, and the row action icon are all dead. |
| regions/sg/page.tsx | FUTURE-PHASE-OK | 1 | Honestly states 'No SG accounts contracted yet... staged for go-live with Phase 3' and KPIs reflect pilot pipeline. One bare <button> at :444 (likely a row acti |
| regions/sg/compliance/page.tsx | NEEDS-WIRING | 1 | SG CPFTA/PLRD fixtures render, but the row action button at :343 has no onClick — dead. |
| regions/sg/payments/page.tsx | NEEDS-WIRING | 0 | Hardcoded Stripe SG + PayNow events/mandates/MTD presented as live with no fetch and no DataSourceBadge; banner reads as production despite SG being a Phase-3 p |
| regions/sg/territory-intel/page.tsx | NEEDS-WIRING | 4 | Static SG planning-area zones render, but 'Filter', 'Add zone' (Plus), row 'View' link, and row action icon are all dead. |
| public/pricing/page.tsx | AT-STANDARD | 0 | Marketing page; CTAs are real <Link> navigations (signup/demo/contact), FAQ accordion button works. Clean. |
| public/product/page.tsx | AT-STANDARD | 0 | Marketing page; in-page anchor nav + real /public/signup and /public/pricing CTA links. No dead buttons. Clean. |
| public/customers/page.tsx | AT-STANDARD | 0 | Marketing/case-study page; CTAs are real /public/signup and /public/pricing links. Clean. |
| public/docs/page.tsx | NEEDS-WIRING | 2 | Mostly real anchors + signup link, but the two OpenAPI download buttons ('openapi.yaml' and 'openapi.json') both point to href="#" — dead download CTAs. |
| public/security/page.tsx | AT-STANDARD | 0 | Security overview; links to real /.well-known/security.txt, /public/bug-bounty, security docs, and mailto. Clean. |
| public/status/page.tsx | NEEDS-WIRING | 1 | Uptime/incident data is hardcoded fixtures (code comment admits it) but presented to the user as live with no on-screen 'demo data' label; the 'Subscribe' email |
| public/changelog/page.tsx | AT-STANDARD | 0 | Static changelog with a real RSS link and real /public/product, /public/status nav links. Honest content surface. Clean. |
| public/signup/page.tsx | AT-STANDARD | 0 | Real 3-step form with per-step validation; submit() uses setTimeout(1100ms) as a UX handoff delay then router.push('/onboard-account') — a real navigation, not  |
| public/bug-bounty/page.tsx | AT-STANDARD | 0 | Real mailto: report links, /.well-known/security.txt, and /public/security nav. Honest program page. Clean. |
| public/security/code-audit/page.tsx | AT-STANDARD | 0 | Delegates to SecurityDocViewer which reads the real repo markdown doc with a graceful 'doc not bundled' fallback + GitHub link. Honest doc viewer. Clean. |
| public/security/pen-test-readiness/page.tsx | AT-STANDARD | 0 | Same SecurityDocViewer pattern, slug 'pen-test-readiness'; renders real bundled markdown with fallback. Clean. |
| public/security/region-pinning/page.tsx | AT-STANDARD | 0 | Same SecurityDocViewer pattern, slug 'region-pinning' (ADR-0016); real doc + fallback. Clean. |
| public/security/review/page.tsx | AT-STANDARD | 0 | Same SecurityDocViewer pattern, slug 'review'; real doc + fallback. Clean. |

## Dead-button / fake detail (the remediation worklist)
### billing/page.tsx
- billing/page.tsx:90 Export CSV button (no onClick)
- billing/page.tsx:139 per-row ExternalLink/open-invoice button (no onClick)

### /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/page.tsx
- page.tsx:909 — "Review all" Button has no onClick

### /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/brand-safety/page.tsx
- brand-safety/page.tsx:583 — "Filter" Button no onClick
- brand-safety/page.tsx:698 — "New rule" Button no onClick

### /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/campaigns/page.tsx
- campaigns/page.tsx:603 "Filter" + :606 "New campaign" no onClick
- campaigns/page.tsx:711 row Pause (only stopPropagation)
- campaigns/page.tsx:720 row Resume (only stopPropagation)
- campaigns/page.tsx:740 row ExternalLink (only stopPropagation)
- campaigns/page.tsx:1019 panel "Pause campaign" / :1023 "Resume campaign" / :1027 "Open in {channel}" no onClick

### /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/integrations/page.tsx
- integrations/page.tsx:1051 "Connect/Save" Button only calls onClose (silent fake)
- integrations/page.tsx:1055 "Cancel" onClose (ok)
- integrations/page.tsx:1062 "Disconnect" only calls onClose (silent fake)

### /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/library/page.tsx
- library/page.tsx:1324/1332/1340/1348/1356 bulk Send-to-review/Approve/Archive/Export/Delete no onClick
- library/page.tsx:1480 card Approve (only stopPropagation)
- library/page.tsx:1490 card Reject (only stopPropagation)
- library/page.tsx:1657/1660/1663 panel Approve/Reject/Send no onClick

### /Users/Brodie/D2D/door-2-digital-platform/apps/web-operator/src/app/marketing-studio/retargeting/page.tsx
- retargeting/page.tsx:440 — cohort rows carry cursor-pointer but have no onClick (visual lie)

### accounts/[slug]/leads/maria-santos/page.tsx
- maria-santos/page.tsx:274 'View suggested sequence' Button — no onClick

### accounts/[slug]/pipeline/page.tsx
- pipeline/page.tsx:1155 quick-add 'Add lead' Button only closes modal, no POST (inputs discarded)

### accounts/[slug]/conversations/page.tsx
- conversations/page.tsx:100 search <input> — no handler
- conversations/page.tsx:109 thread rows — cursor-pointer with no onClick

### accounts/[slug]/conversions/page.tsx
- conversions/page.tsx:158 ledger rows — subtitle promises clickable audit chain, rows have no onClick

### accounts/[slug]/team/page.tsx
- team/page.tsx:117 'Invite' Button — no onClick
- team/page.tsx:132 member rows — subtitle promises click-to-manage, rows have no onClick

### accounts/[slug]/tasks/page.tsx
- tasks/page.tsx:430 'New task' Button — no onClick
- tasks/page.tsx:465 column MoreVertical Button — no onClick

### accounts/[slug]/lead-lists/page.tsx
- New smart list (line ~95, no onClick)
- Add condition (line ~186)
- Preview members (line ~189)
- Save list (line ~196)
- Push-to cards: Marketing campaign / Email sequence / Inside-sales queue (lines ~225-237, cursor-pointer divs, no handler)

### accounts/[slug]/smart-lists/page.tsx
- Create with AI (line ~327)
- New smart list (line ~356)
- Add to drip (line ~526)
- Send to dialer queue (line ~529)
- View all N (line ~533)
- Add group / Add condition (lines ~544, ~626)
- Push to N channels — final modal CTA (line ~940, no onClick)

### accounts/[slug]/campaigns/page.tsx
- New campaign (line ~130)
- Pause/Play row toggle (lines ~194-200, no onClick)
- ExternalLink open-in-channel (line ~201)

### accounts/[slug]/drip/page.tsx
- Per-sequence A/B (line ~120)
- Add step (lines ~123, ~162)
- AI suggestion: Run A/B test (line ~185)
- AI suggestion: Dismiss (line ~188)

### accounts/[slug]/workflows/page.tsx
- Open builder (line ~564)
- New workflow (line ~567)
- Edit (line ~649)
- Pause/Resume (line ~652)
- Clone (line ~663)
- Template 'Use →' buttons (line ~775)

### accounts/[slug]/memberships/page.tsx
- Reach out (per-row, line ~605, no onClick)

### accounts/[slug]/marketing-studio/page.tsx
- Review all (line ~398)
- Top-creative Inspect eye button (line ~237)
- Approval-queue rows are cursor-pointer with no handler (line ~404)

### accounts/[slug]/marketing-studio/brand-safety/page.tsx
- Filter (line ~184)
- Override (line ~249)
- Discard (line ~256)
- Inspect block (line ~263)
- Add rule (line ~285)
- Edit rule (line ~318)

### accounts/[slug]/marketing-studio/campaigns/page.tsx
- Pause (line ~206, only stopPropagation)
- Resume (line ~215, only stopPropagation)
- Open in channel dashboard / ExternalLink (line ~235, only stopPropagation)

### accounts/[slug]/marketing-studio/integrations/page.tsx
- Connect/Save (line ~494, only onClose)
- Disconnect (line ~505, only onClose)

### accounts/[slug]/marketing-studio/library/page.tsx
- New creative (line ~202)
- Send to review (line ~231)
- Bulk Approve (line ~239)
- Export (line ~247)
- Per-tile Approve (line ~331, only stopPropagation)
- Per-tile Reject (line ~339, only stopPropagation)

### accounts/[slug]/territories/page.tsx
- territories/page.tsx:273 'Filter' <Button> has no onClick

### accounts/[slug]/live-map/page.tsx
- live-map/page.tsx:79 PushToFieldStrip onAction => console.log only (broadcast not wired)

### accounts/[slug]/calendars/page.tsx
- calendars/page.tsx:253 prev-week arrow no onClick
- calendars/page.tsx:259 next-week arrow no onClick
- calendars/page.tsx:262 'Today' no onClick
- calendars/page.tsx:475 'Share' no onClick
- calendars/page.tsx:536 'Call' no onClick
- calendars/page.tsx:539 'SMS' no onClick
- calendars/page.tsx:542 'Join' no onClick
- calendars/page.tsx:581 'Book it' only closes modal, adds nothing

### accounts/[slug]/forms/page.tsx
- forms/page.tsx:429 'Open builder' no onClick
- forms/page.tsx:432 'New form' no onClick
- forms/page.tsx:486 Edit no onClick
- forms/page.tsx:489 Preview no onClick
- forms/page.tsx:492 Embed no onClick
- forms/page.tsx:629 footer link-button no onClick

### accounts/[slug]/files/page.tsx
- files/page.tsx:344 Upload <Button> no onClick
- files/page.tsx:398 'Filter' no onClick
- files/page.tsx:489 row action icon no onClick
- files/page.tsx:492 row action icon no onClick
- files/page.tsx:495 row action icon no onClick

### accounts/[slug]/sites/page.tsx
- sites/page.tsx:422 'Edit' no onClick
- sites/page.tsx:425 'New site' no onClick
- sites/page.tsx:489 site action icon no onClick
- sites/page.tsx:492 site action icon no onClick
- sites/page.tsx:495 site action icon no onClick
- sites/page.tsx:590 footer link-button no onClick

### accounts/[slug]/invoices/page.tsx
- invoices/page.tsx:287 'Download' no onClick
- invoices/page.tsx:346 'View PDF' no onClick
- invoices/page.tsx:352 'Resend' no onClick

### accounts/[slug]/reports/page.tsx
- reports/page.tsx:248 'Build report' no onClick
- reports/page.tsx:283 'CSV' download no onClick

### accounts/[slug]/compliance/page.tsx
- compliance/page.tsx:288 'Generate report' no onClick
- compliance/page.tsx:328 'View' no onClick
- compliance/page.tsx:384 'Refresh' no onClick
- compliance/page.tsx:429 'Rotate keys' no onClick

### regions/au/compliance/page.tsx
- regions/au/compliance/page.tsx:381 'Cancel & refund' no onClick

### regions/au/territory-intel/page.tsx
- regions/au/territory-intel/page.tsx:398 'Filter' no onClick
- regions/au/territory-intel/page.tsx:401 Plus/'Add' no onClick
- regions/au/territory-intel/page.tsx:450 row 'View' no onClick
- regions/au/territory-intel/page.tsx:454 row action icon no onClick

### regions/sg/page.tsx
- regions/sg/page.tsx:444 row <button> no onClick (minor)

### regions/sg/compliance/page.tsx
- regions/sg/compliance/page.tsx:343 row action <button> no onClick

### regions/sg/territory-intel/page.tsx
- regions/sg/territory-intel/page.tsx:470 'Filter' no onClick
- regions/sg/territory-intel/page.tsx:473 Plus/'Add' no onClick
- regions/sg/territory-intel/page.tsx:523 row 'View' no onClick
- regions/sg/territory-intel/page.tsx:527 row action icon no onClick

### public/docs/page.tsx
- docs/page.tsx:431 'openapi.yaml' download href="#"
- docs/page.tsx:438 'openapi.json' download href="#"

### public/status/page.tsx
- status/page.tsx:464 'Subscribe' submit form has no onSubmit/action (no-op)
