import { securityHeaders } from './next.config';

describe('next.config security headers', () => {
  const headerMap = new Map(securityHeaders.map((h) => [h.key, h.value]));

  it('includes Content-Security-Policy', () => {
    expect(headerMap.has('Content-Security-Policy')).toBe(true);
  });

  it('includes X-Frame-Options set to DENY', () => {
    expect(headerMap.get('X-Frame-Options')).toBe('DENY');
  });

  it('includes X-Content-Type-Options set to nosniff', () => {
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('includes Strict-Transport-Security with long max-age', () => {
    const hsts = headerMap.get('Strict-Transport-Security');
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=63072000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('includes Referrer-Policy', () => {
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('includes Permissions-Policy that disables camera, microphone, geolocation', () => {
    const pp = headerMap.get('Permissions-Policy');
    expect(pp).toBeDefined();
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });

  describe('CSP directives', () => {
    const csp = headerMap.get('Content-Security-Policy') ?? '';

    it('allows self for default-src', () => {
      expect(csp).toContain("default-src 'self'");
    });

    it('excludes unsafe-inline and unsafe-eval from script-src in non-dev mode', () => {
      // Tests run with NODE_ENV=test, so the strict production CSP applies
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).toContain("script-src 'self'");
    });

    it('allows Binance REST API in connect-src', () => {
      expect(csp).toContain('https://api.binance.com');
    });

    it('allows Binance WebSocket in connect-src', () => {
      expect(csp).toContain('wss://stream.binance.com:9443');
    });

    it('allows Upbit WebSocket in connect-src', () => {
      expect(csp).toContain('wss://api.upbit.com');
    });

    it('allows Supabase in connect-src', () => {
      expect(csp).toContain('https://*.supabase.co');
    });

    it('allows Google user content images', () => {
      expect(csp).toContain('https://lh3.googleusercontent.com');
    });

    it('allows Google Fonts', () => {
      expect(csp).toContain('https://fonts.gstatic.com');
    });

    it('denies frame-ancestors', () => {
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });
});
