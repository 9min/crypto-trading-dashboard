import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

// =============================================================================
// Security Headers (non-CSP)
// =============================================================================
// Content-Security-Policy is handled by src/middleware.ts.
// Only non-CSP security headers are defined here.
// =============================================================================

export const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      'zustand',
      'lightweight-charts',
      '@supabase/supabase-js',
      '@supabase/ssr',
    ],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
  rewrites: async () => [
    { source: '/api/upbit/candles/:path*', destination: 'https://api.upbit.com/v1/candles/:path*' },
    { source: '/api/upbit/orderbook', destination: 'https://api.upbit.com/v1/orderbook' },
    { source: '/api/upbit/ticker', destination: 'https://api.upbit.com/v1/ticker' },
    { source: '/api/upbit/trades/ticks', destination: 'https://api.upbit.com/v1/trades/ticks' },
    { source: '/api/exchange-rate/:path*', destination: 'https://open.er-api.com/v6/:path*' },
  ],
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);
