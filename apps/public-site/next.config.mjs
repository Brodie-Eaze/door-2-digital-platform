/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['@d2d/ui-web', '@d2d/ui-tokens', '@d2d/shared-types', '@d2d/shared-utils'],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
