# @d2d/ui-tokens

Design tokens shared by every D2D web app — Tailwind preset, `globals.css`, and typed token exports.

Mirrors **EazePay Intelligence** visual DNA: strict navy + light-blue palette, Inter font with `cv11`/`ss01` stylistic sets, 256px sidebar, 12px-radius cards with subtle 1-px stroke shadows. **No glass effect, no aurora-green** — consistent with the rest of the EazePay group.

## Usage in a web app

```ts
// apps/<name>/tailwind.config.ts
import type { Config } from 'tailwindcss';
import d2dPreset from '@d2d/ui-tokens/tailwind-preset';

const config: Config = {
  presets: [d2dPreset],
  content: ['./src/**/*.{ts,tsx}'],
};
export default config;
```

```ts
// apps/<name>/src/app/layout.tsx
import '@d2d/ui-tokens/globals.css';
```

## What you get

- **Tokens** — `paper`, `surface`, `ink`, `ink2`, `muted`, `soft`, `line`, `line2`, `accent`, `accentSoft`, `success`, `warn`, `danger`, `hero`
- **Fonts** — Inter (sans), JetBrains Mono (mono); load via `next/font/google` in `layout.tsx`
- **Numeric class** — `.numeric` enables tabular-nums + cv11/ss01 for tables, money, KPIs
- **Component classes** — `.card`, `.pill-{success|warn|danger|info|muted}`, `.section-{head|title|sub|body}`, `.tbl`, `.mono`, `.bar-{track|fill}`, `.tag`, `.kbd`

## Hard rules

- **All money** wraps in `<Money region={...} />` from `@d2d/ui-web` — never raw `${value}`.
- **All numbers in tables/KPIs** get `.numeric`.
- **Status badges** use `.pill` + tone variant; map enums in `<StatusPill />` from `@d2d/ui-web`.
- **Cards** use `.card` + `.card-pad` (or `.section` for content sections with heads).
