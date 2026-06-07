# @d2d/ui-web

Shared React component library for every D2D web app. Built on Tailwind + lucide-react. Mirrors EazePay Intelligence visual patterns.

## Components

### Layout

- **AppShell** — viewport-pinned `flex h-screen` shell. Slots: sidebar, topBar, children. Resets `<main>` scroll on route change.
- **Sidebar** — 256px navy-rail navigation. Accepts grouped nav items with role filtering.
- **TopBar** — 14px sticky header. Title + env badge + optional command-palette trigger + right slot.

### Display

- **Card** / **Section** — surface containers with subtle 1px stroke shadow.
- **KpiCard** — uppercase label + large numeric value + optional delta + sparkline.
- **StatusPill** — pill badge with tone variant (success | warn | danger | info | muted). Exports `STATUS_TONE` mapping for D2D enums + `humaniseStatus()` helper.
- **Money** — BigInt-cents formatter with region-aware currency (AU=AUD, US=USD, SG=SGD).
- **RegionBadge** — country flag + code pill.
- **EmptyState** — icon + title + description + action for empty lists.
- **Banner** — tonal banner with optional action.

### Form

- **Button** — `primary` / `secondary` / `ghost` / `danger` × `sm` / `md` / `lg`.
- **Input** — label + hint + error + adornments.

### D2D-specific

- **AnomalyCard** — used on "Today" mission-control page; severity icon + title + description + action.
- **LeadCard** — name + status + address + phone + email + assignee.
- **KnockCard** — address + disposition + knocker + photo thumb + captured-at.

## Conventions

- Every numeric value gets `<Money />` or the `.numeric` class.
- Every status uses `<StatusPill>` + `STATUS_TONE[status]`.
- Every page wraps its content in `<AppShell sidebar={...} topBar={...}>`.
- Add new components by writing them in `src/components/<Name>.tsx` and exporting from `src/index.ts`.

## Storybook (Phase 0 follow-up)

A Storybook setup will live at `apps/storybook-web` once design-engineer joins. Every component documents states (idle, hover, focus, disabled, loading, empty, error) and tones.
