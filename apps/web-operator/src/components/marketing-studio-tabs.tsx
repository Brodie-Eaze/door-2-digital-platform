/**
 * Horizontal tab strip under the Marketing Studio header on every
 * per-account marketing-studio surface. Lets Brodie jump between
 * Overview / Generator / Library / Campaigns / Brand safety /
 * Retargeting / Integrations without going back to the sidebar.
 */

import Link from 'next/link';
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Megaphone,
  ShieldCheck,
  Target,
  Plug,
} from 'lucide-react';

export type MarketingStudioSurface =
  | 'overview'
  | 'generate'
  | 'library'
  | 'campaigns'
  | 'brand-safety'
  | 'retargeting'
  | 'integrations';

interface MarketingStudioTabsProps {
  slug: string;
  active: MarketingStudioSurface;
}

const TABS: Array<{
  key: MarketingStudioSurface;
  label: string;
  path: string;
  icon: typeof Sparkles;
}> = [
  { key: 'overview', label: 'Overview', path: '', icon: Sparkles },
  { key: 'generate', label: 'Generator', path: '/generate', icon: Wand2 },
  { key: 'library', label: 'Library', path: '/library', icon: ImageIcon },
  { key: 'campaigns', label: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { key: 'brand-safety', label: 'Brand safety', path: '/brand-safety', icon: ShieldCheck },
  { key: 'retargeting', label: 'Retargeting', path: '/retargeting', icon: Target },
  { key: 'integrations', label: 'Integrations', path: '/integrations', icon: Plug },
];

export function MarketingStudioTabs({ slug, active }: MarketingStudioTabsProps): JSX.Element {
  const base = `/accounts/${slug}/marketing-studio`;
  return (
    <nav
      className="border-b border-line2 flex items-center gap-0 overflow-x-auto"
      aria-label="Marketing Studio surfaces"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`${base}${t.path}`}
            className={
              isActive
                ? 'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-ink border-b-2 border-accent -mb-px whitespace-nowrap'
                : 'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-muted hover:text-ink border-b-2 border-transparent -mb-px whitespace-nowrap transition'
            }
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={13} className={isActive ? 'text-accent' : 'text-soft'} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
