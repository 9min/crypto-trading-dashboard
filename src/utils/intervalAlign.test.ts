// =============================================================================
// intervalAlign Utility Unit Tests
// =============================================================================

import { alignToIntervalSec, INTERVAL_MS } from './intervalAlign';
import type { KlineInterval } from '@/types/chart';

describe('alignToIntervalSec', () => {
  // ---------------------------------------------------------------------------
  // 1-minute interval
  // ---------------------------------------------------------------------------

  describe('1m interval', () => {
    it('aligns a mid-minute timestamp to the start of that minute', () => {
      // 2024-01-15 12:03:45.000 UTC → 12:03:00.000 UTC
      const ts = Date.UTC(2024, 0, 15, 12, 3, 45, 0);
      const result = alignToIntervalSec(ts, '1m');
      expect(result).toBe(Date.UTC(2024, 0, 15, 12, 3, 0, 0) / 1000);
    });

    it('returns the same value for an exact boundary', () => {
      // Exact minute boundary should align to itself
      const ts = Date.UTC(2024, 0, 15, 12, 5, 0, 0);
      const result = alignToIntervalSec(ts, '1m');
      expect(result).toBe(ts / 1000);
    });

    it('handles 1ms before the next boundary', () => {
      // 12:03:59.999 → 12:03:00
      const ts = Date.UTC(2024, 0, 15, 12, 3, 59, 999);
      const result = alignToIntervalSec(ts, '1m');
      expect(result).toBe(Date.UTC(2024, 0, 15, 12, 3, 0, 0) / 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 5-minute interval
  // ---------------------------------------------------------------------------

  describe('5m interval', () => {
    it('aligns to 5-minute boundary', () => {
      // 12:07:30 → 12:05:00
      const ts = Date.UTC(2024, 0, 15, 12, 7, 30, 0);
      const result = alignToIntervalSec(ts, '5m');
      expect(result).toBe(Date.UTC(2024, 0, 15, 12, 5, 0, 0) / 1000);
    });

    it('aligns exact 5m boundary to itself', () => {
      const ts = Date.UTC(2024, 0, 15, 12, 10, 0, 0);
      const result = alignToIntervalSec(ts, '5m');
      expect(result).toBe(ts / 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 15-minute interval
  // ---------------------------------------------------------------------------

  describe('15m interval', () => {
    it('aligns to 15-minute boundary', () => {
      // 12:22:00 → 12:15:00
      const ts = Date.UTC(2024, 0, 15, 12, 22, 0, 0);
      const result = alignToIntervalSec(ts, '15m');
      expect(result).toBe(Date.UTC(2024, 0, 15, 12, 15, 0, 0) / 1000);
    });

    it('aligns 12:44:59 to 12:30:00', () => {
      const ts = Date.UTC(2024, 0, 15, 12, 44, 59, 0);
      const result = alignToIntervalSec(ts, '15m');
      expect(result).toBe(Date.UTC(2024, 0, 15, 12, 30, 0, 0) / 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 1-hour interval
  // ---------------------------------------------------------------------------

  describe('1h interval', () => {
    it('aligns to hour boundary', () => {
      // 14:35:20 → 14:00:00
      const ts = Date.UTC(2024, 0, 15, 14, 35, 20, 0);
      const result = alignToIntervalSec(ts, '1h');
      expect(result).toBe(Date.UTC(2024, 0, 15, 14, 0, 0, 0) / 1000);
    });

    it('aligns exact hour boundary to itself', () => {
      const ts = Date.UTC(2024, 0, 15, 14, 0, 0, 0);
      const result = alignToIntervalSec(ts, '1h');
      expect(result).toBe(ts / 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 4-hour interval
  // ---------------------------------------------------------------------------

  describe('4h interval', () => {
    it('aligns to 4-hour boundary', () => {
      // 05:30:00 → 04:00:00 (4h boundaries: 00, 04, 08, 12, 16, 20)
      const ts = Date.UTC(2024, 0, 15, 5, 30, 0, 0);
      const result = alignToIntervalSec(ts, '4h');
      expect(result).toBe(Date.UTC(2024, 0, 15, 4, 0, 0, 0) / 1000);
    });

    it('aligns 23:59:59 to 20:00:00', () => {
      const ts = Date.UTC(2024, 0, 15, 23, 59, 59, 0);
      const result = alignToIntervalSec(ts, '4h');
      expect(result).toBe(Date.UTC(2024, 0, 15, 20, 0, 0, 0) / 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 1-day interval
  // ---------------------------------------------------------------------------

  describe('1d interval', () => {
    it('aligns to day boundary (00:00:00 UTC)', () => {
      // 2024-01-15 18:30:00 → 2024-01-15 00:00:00
      const ts = Date.UTC(2024, 0, 15, 18, 30, 0, 0);
      const result = alignToIntervalSec(ts, '1d');
      expect(result).toBe(Date.UTC(2024, 0, 15, 0, 0, 0, 0) / 1000);
    });

    it('aligns midnight exactly to itself', () => {
      const ts = Date.UTC(2024, 0, 15, 0, 0, 0, 0);
      const result = alignToIntervalSec(ts, '1d');
      expect(result).toBe(ts / 1000);
    });

    it('aligns 1ms before midnight to the current day', () => {
      // 2024-01-15 23:59:59.999 → 2024-01-15 00:00:00
      const ts = Date.UTC(2024, 0, 15, 23, 59, 59, 999);
      const result = alignToIntervalSec(ts, '1d');
      expect(result).toBe(Date.UTC(2024, 0, 15, 0, 0, 0, 0) / 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // General properties
  // ---------------------------------------------------------------------------

  describe('general properties', () => {
    it('returns values in Unix seconds (not milliseconds)', () => {
      const ts = Date.UTC(2024, 0, 15, 12, 0, 0, 0);
      const result = alignToIntervalSec(ts, '1m');
      // Unix seconds for 2024 are roughly in the 1.7 billion range
      expect(result).toBeLessThan(2_000_000_000);
      expect(result).toBeGreaterThan(1_000_000_000);
    });

    it.each<KlineInterval>(['1m', '5m', '15m', '1h', '4h', '1d'])(
      'result for %s is always <= input timestamp in seconds',
      (interval) => {
        const ts = Date.UTC(2024, 6, 1, 13, 37, 42, 123);
        const result = alignToIntervalSec(ts, interval);
        expect(result).toBeLessThanOrEqual(ts / 1000);
      },
    );

    it.each<KlineInterval>(['1m', '5m', '15m', '1h', '4h', '1d'])(
      'result for %s is exactly divisible by interval duration in seconds',
      (interval) => {
        const ts = Date.UTC(2024, 6, 1, 13, 37, 42, 123);
        const result = alignToIntervalSec(ts, interval);
        const intervalSec = INTERVAL_MS[interval] / 1000;
        expect(result % intervalSec).toBe(0);
      },
    );
  });
});
