// =============================================================================
// Web Vitals Console Logger
// =============================================================================
// Wraps Next.js useReportWebVitals to log Core Web Vitals metrics.
// Only logs in development — production builds skip the console output.
// =============================================================================

'use client';

import { useReportWebVitals } from 'next/web-vitals';

interface WebVitalsLogEntry {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
}

/**
 * Logs Web Vitals (LCP, FID/INP, CLS, FCP, TTFB) to the console
 * in development mode. No-op in production.
 */
export function useWebVitals(): void {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== 'development') return;

    const entry: WebVitalsLogEntry = {
      name: metric.name,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      rating: metric.rating,
      delta: Math.round(metric.delta),
      id: metric.id,
    };

    const label =
      metric.rating === 'good'
        ? '\u2705'
        : metric.rating === 'needs-improvement'
          ? '\u26a0\ufe0f'
          : '\u274c';

    const unit = metric.name === 'CLS' ? '' : 'ms';

    // eslint-disable-next-line no-console -- Web Vitals logging is the purpose of this hook
    console.info(
      `[Web Vitals] ${label} ${entry.name}: ${entry.value}${unit} (${entry.rating})`,
      entry,
    );
  });
}
