import { renderHook } from '@testing-library/react';

type MetricCallback = (metric: {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
}) => void;

let capturedCallback: MetricCallback | null = null;

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (cb: MetricCallback) => {
    capturedCallback = cb;
  },
}));

describe('useWebVitals', () => {
  beforeEach(() => {
    capturedCallback = null;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers a callback via useReportWebVitals', async () => {
    const { useWebVitals } = await import('./useWebVitals');

    renderHook(() => useWebVitals());

    expect(capturedCallback).not.toBeNull();
  });

  it('logs LCP metric in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { useWebVitals } = await import('./useWebVitals');

    renderHook(() => useWebVitals());
    capturedCallback!({
      name: 'LCP',
      value: 1234.5,
      rating: 'good',
      delta: 100,
      id: 'v1-lcp',
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('LCP'),
      expect.objectContaining({ name: 'LCP', value: 1235, rating: 'good' }),
    );
  });

  it('logs CLS metric without ms unit', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { useWebVitals } = await import('./useWebVitals');

    renderHook(() => useWebVitals());
    capturedCallback!({
      name: 'CLS',
      value: 0.05,
      rating: 'good',
      delta: 0.01,
      id: 'v1-cls',
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    // CLS value is multiplied by 1000 for readability
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLS'),
      expect.objectContaining({ name: 'CLS', value: 50 }),
    );
  });

  it('does not log in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { useWebVitals } = await import('./useWebVitals');

    renderHook(() => useWebVitals());
    capturedCallback!({
      name: 'FCP',
      value: 800,
      rating: 'good',
      delta: 50,
      id: 'v1-fcp',
    });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('includes rating emoji in log message', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { useWebVitals } = await import('./useWebVitals');

    renderHook(() => useWebVitals());

    // Test needs-improvement rating
    capturedCallback!({
      name: 'TTFB',
      value: 600,
      rating: 'needs-improvement',
      delta: 50,
      id: 'v1-ttfb',
    });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('\u26a0\ufe0f'),
      expect.anything(),
    );
  });
});
