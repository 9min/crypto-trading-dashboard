import type { NextConfig } from 'next';

// =============================================================================
// Content Security Policy
// =============================================================================
// Each directive is a separate array entry for readability.
// Production: strict CSP without unsafe-inline/unsafe-eval.
// Development: relaxed CSP for Next.js HMR and React Grid Layout.
// =============================================================================

const isDev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.binance.com wss://stream.binance.com:9443 wss://api.upbit.com https://*.supabase.co",
  "frame-ancestors 'none'",
].join('; ');

export const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
    optimizePackageImports: ['zustand', 'lightweight-charts'],
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
    {
      source: '/api/binance/ticker/price',
      destination: 'https://api.binance.com/api/v3/ticker/price',
    },
  ],
};

export default nextConfig;
