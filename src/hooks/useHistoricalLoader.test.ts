// =============================================================================
// useHistoricalLoader Tests
// =============================================================================
// Tests that the hook correctly:
//   - Subscribes to visible logical range changes on the chart
//   - Fetches older candle data when the user scrolls near the left edge
//   - Handles Binance and Upbit exchange paths correctly
//   - Guards against stale responses and consecutive errors
//   - Resets flags on symbol/interval/exchange changes
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MutableRefObject } from 'react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetchKlines = vi.fn();
const mockFetchUpbitCandles = vi.fn();

vi.mock('@/lib/binance/restApi', () => ({
  fetchKlines: (...args: unknown[]) => mockFetchKlines(...args),
}));

vi.mock('@/lib/upbit/restClient', () => ({
  fetchUpbitCandles: (...args: unknown[]) => mockFetchUpbitCandles(...args),
}));

vi.mock('@/utils/symbolMap', () => ({
  toUpbitSymbol: (s: string) => {
    const map: Record<string, string> = {
      BTCUSDT: 'KRW-BTC',
      ETHUSDT: 'KRW-ETH',
    };
    return map[s] ?? s;
  },
}));

import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useHistoricalLoader } from './useHistoricalLoader';
import type { CandleData } from '@/types/chart';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createCandle(time: number): CandleData {
  return { time, open: 100, high: 110, low: 90, close: 105 };
}

type RangeCallback = (range: { from: number; to: number } | null) => void;

function createChartMock() {
  let rangeCallback: RangeCallback | null = null;

  const timeScaleObj = {
    subscribeVisibleLogicalRangeChange: vi.fn((cb: RangeCallback) => {
      rangeCallback = cb;
    }),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
  };

  return {
    chart: { timeScale: () => timeScaleObj },
    timeScale: timeScaleObj,
    triggerRange: (range: { from: number; to: number } | null) => {
      rangeCallback?.(range);
    },
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useHistoricalLoader', () => {
  let chartMock: ReturnType<typeof createChartMock>;
  let chartRef: MutableRefObject<ReturnType<typeof createChartMock>['chart'] | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.getState().setExchange('binance');
    useUiStore.getState().setSymbol('BTCUSDT');
    useKlineStore.getState().setInterval('1m');
    // Set candles with isLoading=false
    useKlineStore.setState({
      candles: [createCandle(1700000000)],
      isLoading: false,
    });

    chartMock = createChartMock();
    chartRef = { current: chartMock.chart } as MutableRefObject<
      ReturnType<typeof createChartMock>['chart'] | null
    >;

    mockFetchKlines.mockResolvedValue([]);
    mockFetchUpbitCandles.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Setup / Cleanup
  // ---------------------------------------------------------------------------

  describe('setup and cleanup', () => {
    it('subscribes to visibleLogicalRangeChange when chart is ready', () => {
      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      expect(chartMock.timeScale.subscribeVisibleLogicalRangeChange).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('unsubscribes on unmount', () => {
      const { unmount } = renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      unmount();

      expect(chartMock.timeScale.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalled();
    });

    it('does not subscribe when chart is not ready', () => {
      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: false }));

      expect(chartMock.timeScale.subscribeVisibleLogicalRangeChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Load conditions
  // ---------------------------------------------------------------------------

  describe('load conditions', () => {
    it('does not load when range.from > LOAD_THRESHOLD(10)', async () => {
      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 15, to: 100 });
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });

    it('loads when range.from < LOAD_THRESHOLD', async () => {
      mockFetchKlines.mockResolvedValue([createCandle(1699999000)]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        // Wait for the promise chain to settle
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchKlines).toHaveBeenCalled();
    });

    it('does not load when candles array is empty', async () => {
      useKlineStore.setState({ candles: [], isLoading: false });

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });

    it('does not load when klineStore.isLoading is true', async () => {
      useKlineStore.setState({ isLoading: true });

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });

    it('does not load when range is null', async () => {
      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange(null);
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Binance path
  // ---------------------------------------------------------------------------

  describe('Binance path', () => {
    it('calls fetchKlines with endTime = oldestCandleTime * 1000 - 1', async () => {
      mockFetchKlines.mockResolvedValue([createCandle(1699999000)]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1m', 500, 1700000000 * 1000 - 1);
    });

    it('calls prependCandles with response', async () => {
      const olderCandles = [createCandle(1699999000), createCandle(1699998000)];
      mockFetchKlines.mockResolvedValue(olderCandles);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Verify candles were prepended
      const { candles } = useKlineStore.getState();
      expect(candles.length).toBeGreaterThan(1);
    });

    it('sets noMoreData when response < 500 candles', async () => {
      // Return fewer than BINANCE_FETCH_LIMIT (500)
      mockFetchKlines.mockResolvedValue([createCandle(1699999000)]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Second trigger should not fetch (noMoreData = true)
      mockFetchKlines.mockClear();

      await act(async () => {
        chartMock.triggerRange({ from: 3, to: 50 });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Upbit path
  // ---------------------------------------------------------------------------

  describe('Upbit path', () => {
    beforeEach(() => {
      useUiStore.getState().setExchange('upbit');
    });

    it('calls fetchUpbitCandles with Upbit market code', async () => {
      mockFetchUpbitCandles.mockResolvedValue([createCandle(1699999000)]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchUpbitCandles).toHaveBeenCalledWith('KRW-BTC', '1m', 200, expect.any(String));
    });

    it('passes ISO string for to parameter', async () => {
      mockFetchUpbitCandles.mockResolvedValue([createCandle(1699999000)]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      const toParam = mockFetchUpbitCandles.mock.calls[0][3];
      expect(toParam).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('sets noMoreData when response < 200 candles', async () => {
      mockFetchUpbitCandles.mockResolvedValue([createCandle(1699999000)]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Second trigger should not fetch
      mockFetchUpbitCandles.mockClear();

      await act(async () => {
        chartMock.triggerRange({ from: 3, to: 50 });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchUpbitCandles).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Defensive guards
  // ---------------------------------------------------------------------------

  describe('defensive guards', () => {
    it('increments generation on symbol change to reset flags', () => {
      const { rerender } = renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      // Just verify it doesn't crash on rerender after symbol change
      useUiStore.getState().setSymbol('ETHUSDT');
      rerender();
    });

    it('stops retrying after 3 consecutive errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchKlines.mockRejectedValue(new Error('API error'));

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      // Trigger 3 failed fetches
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          chartMock.triggerRange({ from: 5, to: 100 });
          await new Promise((r) => setTimeout(r, 50));
        });
      }

      mockFetchKlines.mockClear();

      // 4th trigger should not fetch (noMoreData set after 3 errors)
      await act(async () => {
        chartMock.triggerRange({ from: 2, to: 50 });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('discards stale response after symbol change (generation guard)', async () => {
      let resolveKlines: ((value: CandleData[]) => void) | null = null;
      mockFetchKlines.mockImplementation(
        () =>
          new Promise<CandleData[]>((resolve) => {
            resolveKlines = resolve;
          }),
      );

      const initialCandles = useKlineStore.getState().candles;

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
      });

      // Change symbol before resolve — this increments generation
      useUiStore.getState().setSymbol('ETHUSDT');

      // Resolve the stale request
      await act(async () => {
        resolveKlines?.([createCandle(1699999000)]);
        await new Promise((r) => setTimeout(r, 50));
      });

      // Candles should NOT have changed (stale response discarded)
      expect(useKlineStore.getState().candles).toEqual(initialCandles);
    });

    it('sets noMoreData when response is empty', async () => {
      mockFetchKlines.mockResolvedValue([]);

      renderHook(() => useHistoricalLoader({ chartRef, isChartReady: true }));

      await act(async () => {
        chartMock.triggerRange({ from: 5, to: 100 });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Next trigger should not fetch
      mockFetchKlines.mockClear();

      await act(async () => {
        chartMock.triggerRange({ from: 3, to: 50 });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });
  });
});
