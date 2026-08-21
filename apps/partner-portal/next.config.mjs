/** @type {import('next').NextConfig} */

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
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
    : ["'self'", "'unsafe-inline'"];
  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", apiHttp, apiWs],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
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
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['@d2d/ui-web', '@d2d/ui-tokens', '@d2d/shared-types', '@d2d/shared-utils'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';
    return [
      { source: '/proxy/api/:path*', destination: `${apiBase}/v1/:path*` },
      // The API scopes the d2d_rt refresh cookie to Path=/v1/auth. Browsers only
      // attach it to same-origin requests under /v1/auth — so auth calls must go
      // through this path-preserving rewrite, not /proxy/api.
      { source: '/v1/auth/:path*', destination: `${apiBase}/v1/auth/:path*` },
    ];
  },
};
export default nextConfig;
