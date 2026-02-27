import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCsp, middleware, config } from './middleware';
import { NextRequest } from 'next/server';

// -----------------------------------------------------------------------------
// buildCsp unit tests
// -----------------------------------------------------------------------------

describe('buildCsp', () => {
  it('returns a semicolon-delimited CSP string', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('; ');
  });

  it('includes unsafe-inline in script-src for SSG compatibility', () => {
    const csp = buildCsp(false);
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it('does not include unsafe-eval in production mode', () => {
    const csp = buildCsp(false);
    expect(csp).not.toContain('unsafe-eval');
  });

  it('includes unsafe-eval in development mode', () => {
    const csp = buildCsp(true);
    expect(csp).toContain("'unsafe-eval'");
  });

  it('includes default-src self', () => {
    const csp = buildCsp(false);
    expect(csp).toContain("default-src 'self'");
  });

  it('includes style-src with unsafe-inline', () => {
    const csp = buildCsp(false);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('allows Google user content images', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('https://lh3.googleusercontent.com');
  });

  it('allows Google Fonts in font-src', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('https://fonts.gstatic.com');
  });

  it('allows Binance REST API in connect-src', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('https://api.binance.com');
  });

  it('allows Binance WebSocket in connect-src', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('wss://stream.binance.com:9443');
  });

  it('allows Upbit WebSocket in connect-src', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('wss://api.upbit.com');
  });

  it('allows Supabase in connect-src', () => {
    const csp = buildCsp(false);
    expect(csp).toContain('https://*.supabase.co');
  });

  it('denies frame-ancestors', () => {
    const csp = buildCsp(false);
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

// -----------------------------------------------------------------------------
// middleware integration tests
// -----------------------------------------------------------------------------

describe('middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createRequest(url = 'http://localhost:3000/'): NextRequest {
    return new NextRequest(new URL(url));
  }

  it('sets Content-Security-Policy header on the response', () => {
    const response = middleware(createRequest());
    expect(response.headers.has('Content-Security-Policy')).toBe(true);
  });

  it('includes unsafe-inline in script-src', () => {
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it('preserves all connect-src origins', () => {
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('https://api.binance.com');
    expect(csp).toContain('wss://stream.binance.com:9443');
    expect(csp).toContain('wss://api.upbit.com');
    expect(csp).toContain('https://*.supabase.co');
  });
});

// -----------------------------------------------------------------------------
// config.matcher tests
// -----------------------------------------------------------------------------

describe('middleware config', () => {
  it('has a matcher array', () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
  });

  it('excludes static files from matching', () => {
    const pattern = config.matcher[0];
    expect(typeof pattern).toBe('object');
    if (typeof pattern === 'object' && pattern !== null && 'source' in pattern) {
      expect(pattern.source).toContain('_next/static');
    }
  });

  it('excludes favicon.ico from matching', () => {
    const pattern = config.matcher[0];
    if (typeof pattern === 'object' && pattern !== null && 'source' in pattern) {
      expect(pattern.source).toContain('favicon');
    }
  });

  it('has missing header conditions for prefetch', () => {
    const pattern = config.matcher[0];
    if (typeof pattern === 'object' && pattern !== null && 'missing' in pattern) {
      const missing = pattern.missing;
      expect(Array.isArray(missing)).toBe(true);
      const headerKeys = missing?.map((m: { key: string }) => m.key) ?? [];
      expect(headerKeys).toContain('next-router-prefetch');
      expect(headerKeys).toContain('purpose');
    }
  });
});
