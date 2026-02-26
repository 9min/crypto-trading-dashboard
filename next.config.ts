import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['zustand', 'lightweight-charts'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
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
