/**
 * @d2d/ui-tokens — design system tokens shared across all D2D web apps.
 *
 * Mirrors EazePay Intelligence visual DNA:
 *   - Strict navy + light-blue palette (paper, surface, ink, accent, line)
 *   - Inter font with cv11/ss01 stylistic sets + tabular-nums for numerics
 *   - 256px sidebar, 14px topbar, 12px radius cards
 *   - Subtle 1px+stroke shadows; no glass effect
 *
 * Apps consume:
 *   - tailwind-preset.cjs (via tailwind.config.ts `presets: [...]`)
 *   - globals.css (via `import '@d2d/ui-tokens/globals.css'` in layout.tsx)
 */

export const palette = {
  paper: '#F7F8FA',
  surface: '#FFFFFF',
  ink: '#0F172A',
  ink2: '#1E293B',
  muted: '#475569',
  soft: '#94A3B8',
  line: '#E2E8F0',
  line2: '#EEF1F5',
  accent: '#3B82F6',
  accentSoft: '#DBEAFE',
  success: '#1D4ED8',
  successSoft: '#DBEAFE',
  warn: '#475569',
  warnSoft: '#EEF1F5',
  danger: '#0F172A',
  dangerSoft: '#E2E8F0',
  hero: '#0F172A',
  heroLine: '#1E293B',
} as const;

export const typography = {
  fontSans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
  fontMono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
  featureSettings: "'cv11' 1, 'ss01' 1",
  numericFeatureSettings: "'tnum' 1, 'cv11' 1, 'ss01' 1",
} as const;

export const spacing = {
  // 8-point scale matching EazePay
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
} as const;

export const radius = {
  sm: '8px',
  md: '10px',
  lg: '12px',
  xl: '16px',
} as const;

export type Palette = typeof palette;
export type Typography = typeof typography;
