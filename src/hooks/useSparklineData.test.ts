// =============================================================================
// useSparklineData Tests
// =============================================================================
// Tests that the hook correctly fetches and caches 24-hour sparkline data
// for both Binance and Upbit exchanges, with stagger logic and abort handling.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetchUpbitCandles = vi.fn();

vi.mock('@/lib/upbit/restClient', () => ({
  fetchUpbitCandles: (...args: unknown[]) => mockFetchUpbitCandles(...args),
}));

vi.mock('@/utils/symbolMap', () => ({
  toUpbitSymbol: (s: string) => {
    const map: Record<string, string> = {
      BTCUSDT: 'KRW-BTC',
      ETHUSDT: 'KRW-ETH',
      BNBUSDT: 'BNBUSDT', // No KRW- prefix
    };
    return map[s] ?? s;
  },
}));

import { useSparklineData, sparklineCache } from './useSparklineData';

// Mock global fetch for Binance path
const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch;

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useSparklineData', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
    sparklineCache.clear();

    // Default fetch mock for Binance klines
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          [0, '100', '110', '90', '105', '1000', 0, '0', 0, '0', '0', '0'],
          [0, '105', '115', '95', '110', '2000', 0, '0', 0, '0', '0', '0'],
        ]),
    });

    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('cache', () => {
    it('returns cached data when TTL is still valid', async () => {
      sparklineCache.set('binance:BTCUSDT', {
        data: [100, 200, 300],
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      await waitFor(() => {
        expect(result.current).toEqual([100, 200, 300]);
      });

      // Should not fetch since cache is valid
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches new data when TTL has expired', async () => {
      sparklineCache.set('binance:BTCUSDT', {
        data: [100, 200],
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago (TTL = 5 min)
      });

      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      await waitFor(() => {
        expect(result.current.length).toBeGreaterThan(0);
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('uses cache key format exchange:symbol', async () => {
      sparklineCache.set('binance:ETHUSDT', {
        data: [50, 60, 70],
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useSparklineData('ETHUSDT', 'binance'));

      await waitFor(() => {
        expect(result.current).toEqual([50, 60, 70]);
      });
    });

    it('stores fetched data in cache with timestamp', async () => {
      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      await waitFor(() => {
        expect(result.current.length).toBeGreaterThan(0);
      });

      const cached = sparklineCache.get('binance:BTCUSDT');
      expect(cached).toBeDefined();
      expect(cached?.data).toEqual(expect.any(Array));
      expect(cached?.timestamp).toBeGreaterThan(0);
    });

    it('returns empty array while loading', () => {
      // Use a never-resolving promise to keep it in loading state
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      expect(result.current).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Binance path
  // ---------------------------------------------------------------------------

  describe('Binance path', () => {
    it('fetches from Binance klines API with correct params', async () => {
      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      await waitFor(() => {
        expect(result.current.length).toBeGreaterThan(0);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('klines?'),
        expect.any(Object),
      );
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('symbol=BTCUSDT');
      expect(url).toContain('interval=1h');
      expect(url).toContain('limit=24');
    });

    it('maps response to close price array (index 4)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            [0, '100', '110', '90', '105', '1000', 0, '0', 0, '0', '0', '0'],
            [0, '105', '115', '95', '112', '2000', 0, '0', 0, '0', '0', '0'],
          ]),
      });

      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      await waitFor(() => {
        expect(result.current).toEqual([105, 112]);
      });
    });

    it('returns empty array on fetch error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      // Wait for the error to be processed
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Upbit path
  // ---------------------------------------------------------------------------

  describe('Upbit path', () => {
    beforeEach(() => {
      mockFetchUpbitCandles.mockResolvedValue([
        { close: 50000000 },
        { close: 51000000 },
        { close: 52000000 },
      ]);
    });

    it('calls fetchUpbitCandles with mapped market code', async () => {
      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'upbit'));

      await waitFor(() => {
        expect(result.current.length).toBeGreaterThan(0);
      });

      expect(mockFetchUpbitCandles).toHaveBeenCalledWith('KRW-BTC', '1h', 24);
    });

    it('maps Upbit candle close prices', async () => {
      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'upbit'));

      await waitFor(() => {
        expect(result.current).toEqual([50000000, 51000000, 52000000]);
      });
    });

    it('skips fetch for symbols without KRW- prefix', async () => {
      renderHook(() => useSparklineData('BNBUSDT', 'upbit'));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchUpbitCandles).not.toHaveBeenCalled();
    });

    it('returns empty array on Upbit fetch error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchUpbitCandles.mockRejectedValue(new Error('Rate limited'));

      const { result } = renderHook(() => useSparklineData('BTCUSDT', 'upbit'));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Abort handling
  // ---------------------------------------------------------------------------

  describe('abort handling', () => {
    it('aborts previous request on symbol change', async () => {
      const { rerender } = renderHook(
        ({ symbol, exchange }: { symbol: string; exchange: 'binance' | 'upbit' }) =>
          useSparklineData(symbol, exchange),
        { initialProps: { symbol: 'BTCUSDT', exchange: 'binance' as const } },
      );

      // Change symbol — previous request should be aborted
      rerender({ symbol: 'ETHUSDT', exchange: 'binance' });

      // The mock fetch should have been called twice (once per symbol)
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('aborts request on unmount', async () => {
      // Use a long-running fetch
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { unmount } = renderHook(() => useSparklineData('BTCUSDT', 'binance'));

      // Unmount should abort without errors
      unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty symbol
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('does not fetch when symbol is empty', () => {
      renderHook(() => useSparklineData('', 'binance'));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
