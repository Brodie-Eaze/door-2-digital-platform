import { HeartHandshake, Sun, Bug, Zap, Wifi, ShieldAlert, Home, Droplets } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * An honest social-proof strip. We do NOT show fabricated customer logos —
 * instead, the field programs D2D is built for, as a continuous marquee. The
 * track is duplicated so the -50% translate loops seamlessly. Static under
 * prefers-reduced-motion (the animation is disabled in marketing.css).
 */
const FIELDS: { label: string; icon: ReactNode }[] = [
  { label: 'Charity fundraising', icon: <HeartHandshake size={14} /> },
  { label: 'Solar', icon: <Sun size={14} /> },
  { label: 'Pest control', icon: <Bug size={14} /> },
  { label: 'Energy & gas', icon: <Zap size={14} /> },
  { label: 'Broadband & telecom', icon: <Wifi size={14} /> },
  { label: 'Alarms & security', icon: <ShieldAlert size={14} /> },
  { label: 'Roofing & exteriors', icon: <Home size={14} /> },
  { label: 'Water & home services', icon: <Droplets size={14} /> },
];

export function FieldMarquee(): JSX.Element {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <div className="mk-marquee-track gap-3 py-1">
        {[...FIELDS, ...FIELDS].map((f, i) => (
          <span
            key={i}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-medium text-muted"
          >
            <span className="text-accent">{f.icon}</span>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}
