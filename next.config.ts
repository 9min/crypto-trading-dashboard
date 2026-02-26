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
    {
      source: '/api/upbit/:path*',
      destination: 'https://api.upbit.com/v1/:path*',
    },
  ],
};

export default nextConfig;
