/** @type {import('next').NextConfig} */

/**
 * web-operator — Brodie's cross-tenant ops view. Strict security headers
 * matching EazePay Intelligence convention.
 */
function buildCsp() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';
  let apiHttp = apiBase;
  let apiWs = apiBase.replace(/^https?:/, (m) => (m === 'https:' ? 'wss:' : 'ws:'));
  try {
    const u = new URL(apiBase);
    apiHttp = `${u.protocol}//${u.host}`;
    apiWs = `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
  } catch {
    /* defaults above */
  }
  // Next.js dev mode uses eval() for React Refresh / HMR + source maps.
  // Without 'unsafe-eval' in dev, the whole client bundle fails to evaluate
  // and the page never hydrates. In production, the bundler emits no eval
  // calls so we tighten back to 'self' only.
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"] : ["'self'"];
  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    // Next static optimisation injects inline critical CSS without nonce.
    // unsafe-inline scoped to styles only is the standard mitigation.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.tile.mapbox.com',
      'https://api.mapbox.com',
      'https://server.arcgisonline.com', // Esri World Imagery satellite tiles
      'https://services.arcgisonline.com',
      // OpenStreetMap streets tiles (Leaflet base layer)
      'https://tile.openstreetmap.org',
      'https://*.tile.openstreetmap.org',
      'https://a.tile.openstreetmap.org',
      'https://b.tile.openstreetmap.org',
      'https://c.tile.openstreetmap.org',
      // Carto basemaps (optional fallback)
      'https://*.basemaps.cartocdn.com',
      // Demo creative previews (Marketing Studio) — free seeded placeholder images.
      // Real creative storage will be S3/R2 in Phase 1.3 (per ADR-0008).
      // Marketing Studio now uses a same-origin /creative-bank/ photo bank — no
      // third-party image hosts required for theme-relevant creatives.
      'https://picsum.photos',
      'https://fastly.picsum.photos',
      'https://i.pravatar.cc',
    ],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      apiHttp,
      apiWs,
      'https://api.mapbox.com',
      'https://events.mapbox.com',
      'https://server.arcgisonline.com',
      'https://services.arcgisonline.com',
      'https://tile.openstreetmap.org',
      'https://*.tile.openstreetmap.org',
      'https://a.tile.openstreetmap.org',
      'https://b.tile.openstreetmap.org',
      'https://c.tile.openstreetmap.org',
      'https://*.basemaps.cartocdn.com',
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    // Block plugin content (Flash/PDF/Silverlight) — defence in depth.
    'media-src': ["'self'"],
    // Force any http:// asset references to upgrade to https:// in prod.
    // (Has no effect on localhost over http; safe to include.)
    'upgrade-insecure-requests': [],
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length === 0 ? k : `${k} ${v.join(' ')}`))
    .join('; ');
}

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: buildCsp() },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(self), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // Block Adobe/Flash cross-domain policy files (legacy, but cheap to disable).
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  // Opt-in to origin-keyed agent clustering — site-isolation hint to the browser.
  { key: 'Origin-Agent-Cluster', value: '?1' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Explicit: never ship sourcemaps to the browser in prod. (Default is already
  // false in Next 14, but pin it so a future config change can't silently flip
  // the bundle into reverse-engineerable shape.)
  productionBrowserSourceMaps: false,
  output: 'standalone',
  experimental: { typedRoutes: false },
  transpilePackages: ['@d2d/ui-web', '@d2d/ui-tokens', '@d2d/shared-types', '@d2d/shared-utils'],
  // Phase 0 demo: ship build despite ESLint nits (unused imports, escaped quotes).
  // Re-enable strict in Phase 1.1 once team has reviewed.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';
    return [{ source: '/proxy/api/:path*', destination: `${apiBase}/v1/:path*` }];
  },
};

export default nextConfig;
