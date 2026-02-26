// =============================================================================
// useHistoricalLoader Hook
// =============================================================================
// Enables infinite scroll on the candlestick chart by detecting when the user
// scrolls near the left edge and automatically fetching older candle data from
// the appropriate exchange REST API.
//
// Flow:
//   1. Subscribe to chart.timeScale().subscribeVisibleLogicalRangeChange()
//   2. When the visible range's `from` drops below LOAD_THRESHOLD, trigger fetch
//   3. Fetch older candles using endTime (Binance) or to (Upbit) parameter
//   4. Prepend to klineStore — chart updates via setData without fitContent
//   5. Stop loading when API returns fewer candles than requested (end of history)
// =============================================================================

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { useKlineStore } from '@/stores/klineStore';
import { useUiStore } from '@/stores/uiStore';
import { fetchKlines } from '@/lib/binance/restApi';
import { fetchUpbitCandles } from '@/lib/upbit/restClient';
import { toUpbitSymbol } from '@/utils/symbolMap';
import type { CandleData } from '@/types/chart';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Lightweight Charts types inferred from the dynamic import
type LWC = typeof import('lightweight-charts');
type ChartApi = ReturnType<LWC['createChart']>;

interface UseHistoricalLoaderParams {
  /** Ref to the Lightweight Charts chart instance */
  chartRef: MutableRefObject<ChartApi | null>;
  /** Whether the chart has been initialized and is ready */
  isChartReady: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Number of logical bars from the left edge to trigger loading.
 * When the leftmost visible bar index drops below this threshold,
 * a fetch for older data is initiated.
 */
const LOAD_THRESHOLD = 10;

/** Number of candles to request per Binance API call */
const BINANCE_FETCH_LIMIT = 500;

/** Number of candles to request per Upbit API call */
const UPBIT_FETCH_LIMIT = 200;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useHistoricalLoader({ chartRef, isChartReady }: UseHistoricalLoaderParams): void {
  const exchange = useUiStore((s) => s.exchange);
  const symbol = useUiStore((s) => s.symbol);
  const interval = useKlineStore((s) => s.interval);
  const prependCandles = useKlineStore((s) => s.prependCandles);

  const isLoadingRef = useRef(false);
  const noMoreDataRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const requestGenerationRef = useRef(0);

  // Reset flags when data context changes (symbol, interval, or exchange switch)
  useEffect(() => {
    requestGenerationRef.current += 1;
    isLoadingRef.current = false;
    noMoreDataRef.current = false;
    consecutiveErrorsRef.current = 0;
  }, [symbol, interval, exchange]);

  const handleVisibleRangeChange = useCallback(
    (range: { from: number; to: number } | null) => {
      if (!range) return;
      if (isLoadingRef.current || noMoreDataRef.current) return;
      if (range.from > LOAD_THRESHOLD) return;

      // Don't fetch while initial data is still loading
      const { candles, isLoading } = useKlineStore.getState();
      if (isLoading || candles.length === 0) return;

      const oldestTime = candles[0].time;
      isLoadingRef.current = true;
      const generation = requestGenerationRef.current;

      // Read latest state directly to avoid stale closure values
      const currentExchange = useUiStore.getState().exchange;
      const currentSymbol = useUiStore.getState().symbol;
      const currentInterval = useKlineStore.getState().interval;

      let fetchPromise: Promise<CandleData[]>;

      if (currentExchange === 'binance') {
        // Binance endTime is inclusive (ms) — subtract 1ms to exclude the oldest existing candle
        fetchPromise = fetchKlines(
          currentSymbol,
          currentInterval,
          BINANCE_FETCH_LIMIT,
          oldestTime * 1000 - 1,
        );
      } else {
        // Upbit `to` parameter is exclusive — pass the exact oldest candle time as UTC ISO string
        const toDate = new Date(oldestTime * 1000);
        const toParam = toDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
        // uiStore stores symbols in Binance format — convert to Upbit market code
        const upbitMarket = toUpbitSymbol(currentSymbol);
        fetchPromise = fetchUpbitCandles(upbitMarket, currentInterval, UPBIT_FETCH_LIMIT, toParam);
      }

      fetchPromise
        .then((olderCandles) => {
          // Discard stale responses after context switch (symbol/interval/exchange changed)
          if (generation !== requestGenerationRef.current) return;

          consecutiveErrorsRef.current = 0;

          if (olderCandles.length === 0) {
            noMoreDataRef.current = true;
            return;
          }

          // If API returned fewer candles than requested, we've reached the start of history
          const requested = currentExchange === 'binance' ? BINANCE_FETCH_LIMIT : UPBIT_FETCH_LIMIT;
          if (olderCandles.length < requested) {
            noMoreDataRef.current = true;
          }

          prependCandles(olderCandles);
        })
        .catch((error: unknown) => {
          if (generation !== requestGenerationRef.current) return;

          consecutiveErrorsRef.current += 1;

          // Stop retrying after 3 consecutive failures to prevent infinite error loops
          if (consecutiveErrorsRef.current >= 3) {
            noMoreDataRef.current = true;
          }

          const message = error instanceof Error ? error.message : String(error);
          console.error('[useHistoricalLoader] Failed to fetch older candles', {
            symbol: currentSymbol,
            interval: currentInterval,
            exchange: currentExchange,
            oldestTime,
            attempt: consecutiveErrorsRef.current,
            timestamp: Date.now(),
            errorMessage: message,
          });
        })
        .finally(() => {
          if (generation === requestGenerationRef.current) {
            isLoadingRef.current = false;
          }
        });
    },
    [prependCandles],
  );

  // Subscribe to visible logical range changes on the chart's time scale
  useEffect(() => {
    const chart = chartRef.current;
    if (!isChartReady || !chart) return;

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [isChartReady, chartRef, handleVisibleRangeChange]);
}
