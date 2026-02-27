import { securityHeaders } from './next.config';

describe('next.config security headers', () => {
  const headerMap = new Map(securityHeaders.map((h) => [h.key, h.value]));

  it('does not include Content-Security-Policy (handled by middleware)', () => {
    expect(headerMap.has('Content-Security-Policy')).toBe(false);
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
});
