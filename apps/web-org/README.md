# apps/web-org

**Org Console** — per-tenant management UI. Each D2D client org's `org_admin`, `manager`, `accountant`, `inside_sales`, `auditor`, and `viewer` users sign in here.

Phase 0 placeholder — full scaffold follows `apps/web-operator/` exactly. Mobile engineer or frontend engineer copies the operator scaffold and renames:

```bash
cp -R apps/web-operator apps/web-org
# Then in apps/web-org:
# - package.json: name → "web-org", port → 3012
# - tailwind.config.ts: unchanged
# - next.config.mjs: port + CSP rewrites unchanged
# - src/components/OperatorShell.tsx → OrgShell.tsx with org-scoped nav
# - src/app/overview/page.tsx → src/app/today/page.tsx (anomaly-first)
```

## Org Console nav (per plan §7.4)

- **Today** — anomaly-first home (DNC violations, missed callbacks, low-converting territories, idle knockers, leaderboard, AI commentary)
- **Territories** — Map / List / Heatmap / Detail / Drafts
- **Campaigns** — list + create wizard + detail
- **Leads** — Inbox / All / By source / Detail
- **Pipeline** — Kanban + forecast + analytics
- **Knocker Teams** — Roster / Schedules / Performance / Onboarding / Disciplinary
- **Inside Sales** — Queue / DialerCockpit / Sequences / Performance
- **Marketing Studio** — Creative library / Generator / Campaigns / Brand kit
- **Conversions** — Donations / Sales dual schema
- **Commissions** — Plans / Statements / Disputes / Payouts queue
- **Payouts** — Methods / Schedule / History / Reconciliation
- **Reports** — Saved / Builder / Scheduled
- **Integrations** — Mapbox / payment per region / dialer / SMS / email
- **Settings** — Org profile, users + roles, BrandKit, billing, data + privacy
