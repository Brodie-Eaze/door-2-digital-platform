/**
 * @d2d/ui-web — shared React components for D2D web apps.
 *
 * Visual DNA mirrors EazePay Intelligence:
 *   - AppShell with 256px navy-rail-on-light-body sidebar
 *   - 14px topbar with env badge + command palette trigger
 *   - .card / .pill / .section / .tbl class library from @d2d/ui-tokens
 *   - Inter font with cv11/ss01 + tabular-nums for all numeric content
 */

// Layout primitives
export { AppShell } from './components/AppShell';
export { Sidebar } from './components/Sidebar';
export { TopBar } from './components/TopBar';

// Display primitives
export { Card } from './components/Card';
export { Section } from './components/Section';
export { KpiCard } from './components/KpiCard';
export { StatusPill } from './components/StatusPill';
export { Money } from './components/Money';
export { RegionBadge } from './components/RegionBadge';
export { EmptyState } from './components/EmptyState';
export { Banner } from './components/Banner';

// Form primitives
export { Button } from './components/Button';
export { Input } from './components/Input';

// D2D-specific (placeholder exports — implement Phase 1)
export { AnomalyCard } from './components/AnomalyCard';
export { LeadCard } from './components/LeadCard';
export { KnockCard } from './components/KnockCard';

// Utilities
export { cn } from './lib/cn';

// Types
export type { Tone, RegionCode, Vertical } from './types';
export type { NavGroup, NavItem } from './components/Sidebar';
