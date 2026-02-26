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
  ],
};

export default nextConfig;
