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
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
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
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
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
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
