'use client';

/**
 * Knocker iOS phone-mock satellite map.
 *
 * Uses the Esri ArcGIS World Imagery REST export endpoint to fetch a single
 * static satellite JPEG for the territory. No client-side map library
 * required — guaranteed to render. Territory polygon + knock pins overlaid
 * with absolute-positioned divs/SVG.
 */

// Austin East Residential bounding box (real lat/lng)
// minX (west lng), minY (south lat), maxX (east lng), maxY (north lat)
const BBOX = '-97.7530,30.2380,-97.7330,30.2520';
const SIZE = '320,540';
const SATELLITE_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${BBOX}&bboxSR=4326&imageSR=4326&size=${SIZE}&format=jpg&f=image`;

// Territory polygon (drawn over the image as % coords)
// Approximates the same Austin East Residential area as a percentage of the bbox
const TERRITORY_POLY: Array<[number, number]> = [
  [18, 15],
  [82, 15],
  [88, 45],
  [78, 78],
  [42, 92],
  [12, 70],
  [18, 15],
];

// Knock pins as % positions (left%, top%)
const PINS: Array<{ x: number; y: number; color: string; label: string }> = [
  { x: 32, y: 28, color: '#1D4ED8', label: 'Maria Santos · SALE' },
  { x: 58, y: 22, color: '#1D4ED8', label: 'David Chen · LEAD' },
  { x: 46, y: 38, color: '#475569', label: 'Not home' },
  { x: 70, y: 48, color: '#475569', label: 'Not home' },
  { x: 36, y: 55, color: '#1D4ED8', label: 'Jennifer López · SALE' },
  { x: 28, y: 70, color: '#0F172A', label: 'Do not knock' },
  { x: 64, y: 65, color: '#1D4ED8', label: 'Sophia Patel · LEAD' },
  { x: 52, y: 80, color: '#F59E0B', label: 'Callback Tue 3pm' },
];

// Knocker's current position
const ME = { x: 48, y: 48 };

export function KnockerPhoneMap(): JSX.Element {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      {/* Real Esri satellite image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SATELLITE_URL}
        alt="Austin East Residential satellite"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />

      {/* Territory polygon overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points={TERRITORY_POLY.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="rgba(59, 130, 246, 0.22)"
          stroke="#3B82F6"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Knock pins */}
      {PINS.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-white shadow-sm"
          style={{
            left: `calc(${p.x}% - 6px)`,
            top: `calc(${p.y}% - 6px)`,
            width: 12,
            height: 12,
            background: p.color,
          }}
          title={p.label}
        />
      ))}

      {/* Knocker's "you" marker with halo */}
      <div
        className="absolute rounded-full"
        style={{
          left: `calc(${ME.x}% - 18px)`,
          top: `calc(${ME.y}% - 18px)`,
          width: 36,
          height: 36,
          background: 'rgba(59, 130, 246, 0.25)',
          boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.5)',
        }}
      />
      <div
        className="absolute rounded-full border-[3px] border-white shadow-md"
        style={{
          left: `calc(${ME.x}% - 7px)`,
          top: `calc(${ME.y}% - 7px)`,
          width: 14,
          height: 14,
          background: '#3B82F6',
        }}
      />

      {/* Esri attribution (required by terms) */}
      <div className="absolute bottom-1 right-1 text-[8px] text-white/70 bg-black/30 px-1 rounded">
        © Esri
      </div>
    </div>
  );
}
