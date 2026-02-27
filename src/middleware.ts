// =============================================================================
// CSP Middleware
// =============================================================================
// Sets a Content-Security-Policy header on every page request.
// Uses 'unsafe-inline' for script-src because the page is statically generated
// (SSG) — pre-rendered HTML cannot have per-request nonces injected into inline
// <script> tags. All other directives are strict.
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// -----------------------------------------------------------------------------
// CSP Builder
// -----------------------------------------------------------------------------

/**
 * Builds the Content-Security-Policy header value.
 *
 * Development mode additionally includes 'unsafe-eval' for HMR / React Fast
 * Refresh. Uses 'unsafe-inline' for script-src to support SSG inline scripts.
 */
export function buildCsp(isDev: boolean): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'unsafe-inline'`;

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

export function middleware(_request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCsp(isDev);

  const response = NextResponse.next();
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
