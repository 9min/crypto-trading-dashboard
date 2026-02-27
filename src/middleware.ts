// =============================================================================
// Nonce-based CSP Middleware
// =============================================================================
// Generates a per-request nonce and injects it into the Content-Security-Policy
// header. Next.js automatically applies this nonce to RSC hydration inline
// scripts, eliminating the need for 'unsafe-inline' in script-src.
//
// The nonce is also forwarded as an x-nonce request header for use by
// custom inline scripts (e.g., analytics or third-party tags).
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// -----------------------------------------------------------------------------
// CSP Builder
// -----------------------------------------------------------------------------

/**
 * Builds the Content-Security-Policy header value with a per-request nonce.
 *
 * Development mode additionally includes 'unsafe-eval' for HMR / React Fast
 * Refresh. The nonce replaces 'unsafe-inline' for production safety.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.binance.com wss://stream.binance.com:9443 wss://api.upbit.com https://*.supabase.co",
    "frame-ancestors 'none'",
  ];

  return directives.join('; ');
}

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

export function middleware(request: NextRequest): NextResponse {
  // Generate a cryptographic nonce for this request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCsp(nonce, isDev);

  // Clone request headers and inject nonce for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// -----------------------------------------------------------------------------
// Matcher — skip static files, images, and prefetch requests
// -----------------------------------------------------------------------------

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
