/*
 * SatMap — a real satellite map for the marketing mocks. Base layer is live
 * Esri World Imagery (the same source the product uses) pulled as a single
 * static export image (no Leaflet, no map JS, zero new deps). Over it we draw
 * the things D2D tracks: territory polygons, a rep's walked route, pulsing
 * tracked pins, and an optional ad-targeting radius for the "warm the area
 * first" story. Server-component safe; pin pulse is CSS-only (reduced-motion
 * aware via marketing.css).
 */
import type { ReactNode } from 'react';

const PIN = { sale: '#3B82F6', lead: '#93C5FD', idle: '#FACC15' } as const;
type PinTone = keyof typeof PIN;

/* Dense suburban grids — classic door-to-door territory. */
const AREAS: Record<string, string> = {
  phoenix: '-112.078,33.443,-112.064,33.453',
  mesa: '-111.930,33.416,-111.918,33.426',
  scottsdale: '-111.905,33.493,-111.893,33.503',
  irvine: '-117.870,33.690,-117.858,33.700',
  dallas: '-96.830,32.790,-96.818,32.800',
};

function esriUrl(bbox: string, w = 800, h = 500): string {
  return (
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export' +
    `?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`
  );
}

export function SatMap({
  area = 'phoenix',
  pins = [],
  route = false,
  territory = false,
  radius = false,
  label,
  badge,
  aspect = 'aspect-[1.6/1]',
  className = '',
}: {
  area?: keyof typeof AREAS;
  pins?: { x: number; y: number; t: PinTone }[];
  route?: boolean;
  territory?: boolean;
  radius?: boolean;
  label?: string;
  badge?: ReactNode;
  aspect?: string;
  className?: string;
}): JSX.Element {
  const bbox = AREAS[area] ?? AREAS.phoenix ?? '-112.078,33.443,-112.064,33.453';
  return (
    <div
      className={`relative ${aspect} w-full overflow-hidden rounded-xl border border-line ${className}`}
    >
      {/* satellite base */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${esriUrl(bbox)}")` }}
      />
      {/* legibility veil */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(11,18,32,0.10), rgba(11,18,32,0.42))' }}
      />

      <svg viewBox="0 0 100 64" className="absolute inset-0 h-full w-full" aria-hidden>
        {territory ? (
          <polygon
            points="12,16 56,10 62,46 24,56"
            fill="rgba(59,130,246,0.16)"
            stroke="rgba(96,165,250,0.95)"
            strokeWidth="0.6"
          />
        ) : null}
        {radius ? (
          <>
            <circle
              cx="50"
              cy="32"
              r="26"
              fill="rgba(59,130,246,0.10)"
              stroke="rgba(96,165,250,0.8)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
            <circle
              className="mk-orbit"
              cx="50"
              cy="32"
              r="26"
              pathLength={1000}
              fill="none"
              stroke="rgba(147,197,253,0.95)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </>
        ) : null}
        {route ? (
          <path
            d="M22 44 L32 36 L42 40 L54 28 L66 34 L78 24"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="0.7"
            strokeDasharray="2 1.5"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      {/* tracked pins */}
      {pins.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: 'translate(-50%,-50%)',
          }}
        >
          <span
            className="mk-pulse-ring absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: PIN[p.t], animationDelay: `${i * 300}ms` }}
          />
          <span
            className="relative block h-2 w-2 rounded-full ring-2 ring-white/80 shadow"
            style={{ background: PIN[p.t] }}
          />
        </span>
      ))}

      {label ? (
        <div className="absolute left-2.5 top-2 inline-flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">
          <span className="mk-blink inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          {label}
        </div>
      ) : null}

      {badge ? <div className="absolute right-2.5 top-2">{badge}</div> : null}

      {/* legend */}
      <div className="absolute bottom-2 left-2.5 flex items-center gap-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.10em] text-white/80 backdrop-blur-sm">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Sale
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#93C5FD]" /> Lead
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FACC15]" /> Knocked
        </span>
      </div>

      <div className="absolute bottom-1.5 right-2 font-mono text-[7px] text-white/55">
        Esri World Imagery
      </div>
    </div>
  );
}
