# D2D Canonical Taxonomy

**Source of truth for every status pill, filter chip, and category label rendered in the operator UI.** This document references [master plan §3](./architecture.md) and [ADR-0028](./adr/0028-micamp-us-processor.md) for the broader product context.

Polish sprint F (2026-05-27) normalized 60+ ad-hoc status pills + filter strips that drifted across 88 routes built by sequential agents. This document is the canonical reference for anyone touching the operator surface next.

## 1. Canonical enums

All enums live in [`packages/ui-tokens/src/taxonomy.ts`](../packages/ui-tokens/src/taxonomy.ts) and are re-exported from `@d2d/ui-tokens` and `@d2d/ui-tokens/taxonomy`.

| Domain                 | Type                 | Values                                                                                                                                                 | Tone map                                |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Lead lifecycle         | `LeadStatus`         | `new` / `contacted` / `qualified` / `appointment_set` / `converted` / `lost` / `do_not_contact`                                                        | `LEAD_STATUS_TONE`                      |
| Conversion attribution | `AttributionSource`  | `door` / `inside_sales` / `retargeting` / `other`                                                                                                      | (no tone — display only)                |
| Knock disposition      | `KnockDisposition`   | `no_answer` / `not_interested` / `callback` / `do_not_knock` / `appointment` / `converted_donation` / `converted_sale` / `hostile` / `invalid_address` | `KNOCK_DISPOSITION_TONE`                |
| Knocker live status    | `RepStatus`          | `active` / `break` / `idle` / `offline`                                                                                                                | `REP_STATUS_TONE`                       |
| Creative status        | `CreativeStatus`     | `draft` / `review` / `approved` / `published` / `blocked`                                                                                              | `CREATIVE_STATUS_TONE`                  |
| Campaign status        | `CampaignStatus`     | `active` / `paused` / `scheduled` / `ended` / `pending_review`                                                                                         | `CAMPAIGN_STATUS_TONE`                  |
| Provider connection    | `ProviderConnStatus` | `connected` / `sandbox` / `not_connected` / `error`                                                                                                    | `PROVIDER_CONN_TONE`                    |
| Account health         | `AccountHealth`      | `healthy` / `attention` / `critical`                                                                                                                   | `ACCOUNT_HEALTH_TONE`                   |
| Anomaly severity       | `AnomalySeverity`    | `critical` / `warn` / `info`                                                                                                                           | `ANOMALY_SEVERITY_TONE`                 |
| Org plan tier          | `OrgPlan`            | `Trial` / `Growth` / `Enterprise`                                                                                                                      | (no tone — handled by paywall surfaces) |

### Tone alphabet

`StatusPill` only accepts five tones (see [`packages/ui-web/src/types.ts`](../packages/ui-web/src/types.ts)):

```
success | warn | danger | info | muted
```

**Do not invent new tones.** If you think you need a sixth, extend the type at the StatusPill source and update this table — don't shim a new colour into a one-off page.

Forbidden synonyms (script-enforced by [`scripts/check-taxonomy.sh`](../scripts/check-taxonomy.sh)):

| Forbidden         | Use instead                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `tone="warning"`  | `tone="warn"`                                                                                                  |
| `tone="critical"` | `tone="danger"`                                                                                                |
| `tone="error"`    | `tone="danger"`                                                                                                |
| `tone="neutral"`  | `tone="muted"`                                                                                                 |
| `tone="ok"`       | `tone="success"` _(allowed only in `public/status/page.tsx` where `StatusDot` has a local `ServiceTone` enum)_ |

## 2. Naming canon

| Concept                | Canonical UI label         | Never use in display copy                                                    |
| ---------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| Field rep              | **Knocker** / **Knockers** | "rep", "salesperson", "agent"                                                |
| Inside sales           | **Inside sales**           | "telesales", "phone team"                                                    |
| Outbound nurture       | **Sequence**               | "drip" _(allowed in code paths and route names; never in user-visible copy)_ |
| Marketing asset        | **Creative**               | "ad", "post"                                                                 |
| Door visit             | **Knock**                  | "visit", "call"                                                              |
| Sub-org under operator | **Account**                | "tenant", "client", "customer"                                               |

Constants exported as `PLATFORM_NAMING` and `PLATFORM_NAMING_PLURALS` from `@d2d/ui-tokens/taxonomy`. Pull from there in section titles, KPI labels, and empty-state copy so that a future rename is one file.

> **Code vs. copy** — the Prisma models `Lead`, `Knock`, `Conversion`, `Org`, `Account` stay as-is. Routes like `/accounts/[slug]/drip/` are also untouched (changing them would break links). The canon applies to what the user reads, not what the database stores.

## 3. Filter chip pattern

One primitive. One visual treatment. One set of states.

**Use [`<FilterChip>` and `<FilterChipStrip>`](../packages/ui-web/src/components/FilterChip.tsx)** from `@d2d/ui-web` for every toggleable filter on the operator surface. They render as:

- `rounded-full px-3 py-1 text-[11px]`
- Inactive: `bg-paper`, `border-line2`, `text-muted` → hover `text-ink`
- Active: `bg-ink text-surface` (semibold)
- Optional count badge to the right of the label, tabular-numeric

```tsx
import { FilterChip, FilterChipStrip } from '@d2d/ui-web';

<FilterChipStrip label="Status">
  {STATUS_OPTS.map((opt) => (
    <FilterChip
      key={opt.value}
      active={status === opt.value}
      onClick={() => setStatus(opt.value)}
      count={countFor(opt.value)}
    >
      {opt.label}
    </FilterChip>
  ))}
</FilterChipStrip>;
```

**When NOT to use a chip strip:**

- A pure visual badge (no click behaviour) → use `<StatusPill>` instead.
- A single-select dropdown with many options (8+) → use a `<select>` element, not a chip strip.
- A search input → that's an `<Input>`, not a chip.

## 4. Status pill rules

```tsx
import { StatusPill } from '@d2d/ui-web';
import { CREATIVE_STATUS_LABEL, CREATIVE_STATUS_TONE } from '@d2d/ui-tokens/taxonomy';

<StatusPill tone={CREATIVE_STATUS_TONE[c.status]}>{CREATIVE_STATUS_LABEL[c.status]}</StatusPill>;
```

Rules:

1. **Always pull tone from the canonical map** for known domain statuses. Inline ternaries (`status === 'live' ? 'success' : 'danger'`) are only acceptable for one-off booleans that don't fit a domain enum.
2. **Always pull label from the canonical map** when one exists. Never render `{snake_case_status}` raw.
3. **Never render a non-`<StatusPill>` rounded-full element to indicate state.** If you find yourself writing `className="rounded-full bg-success text-surface px-2..."`, that's a `<StatusPill>`.

## 5. Adding a new status

1. Add the variant to the relevant enum in `packages/ui-tokens/src/taxonomy.ts`.
2. Add its label to `*_LABEL`.
3. Add its tone to `*_TONE` — must be one of the five canonical tones.
4. (Optional) extend the lint guard in `scripts/check-taxonomy.sh` if you're introducing a forbidden synonym that future devs might accidentally type.
5. Run `pnpm taxonomy:check && pnpm --filter web-operator typecheck && pnpm --filter web-operator build`.

## 6. CI gate

The script `pnpm taxonomy:check` runs as a pre-deploy hook on the Polish-sprint-F branch and going forward. If it fails, the build is blocked.

Locally:

```bash
pnpm taxonomy:check
```

## 7. References

- Master plan §3 — visual DNA & component canon
- [ADR-0028](./adr/0028-micamp-us-processor.md) — referenced for the cross-region pill colours
- Sprint A — motion primitives (`Reveal`, `Skeleton`, transition timings)
- Sprint E — trust signals (`Banner`, `KpiCard` integrity hints)
- Sprint F (this doc) — taxonomy + filter hygiene
