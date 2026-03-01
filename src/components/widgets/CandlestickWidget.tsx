'use client';

// =============================================================================
// CandlestickWidget Component
// =============================================================================
// Integrates TradingView Lightweight Charts (v5) to display real-time
// candlestick data from klineStore. Uses autoSize for responsive resizing.
//
// - On mount: creates chart + candlestick series, sets initial data
// - On candle updates: calls series.update() for live candles
// - On theme change: applies matching chart options
// - On unmount: calls chart.remove() for complete cleanup
// =============================================================================

import { memo, useEffect, useRef, useMemo, useState } from 'react';
import { useKlineStore } from '@/stores/klineStore';
import { useUiStore } from '@/stores/uiStore';
import type { CandleData } from '@/types/chart';
import type { Theme } from '@/stores/uiStore';
import { WidgetWrapper } from './WidgetWrapper';
import { useIndicatorSeries } from '@/hooks/useIndicatorSeries';
import { useHistoricalLoader } from '@/hooks/useHistoricalLoader';
import { usePositionPriceLines } from '@/hooks/usePositionPriceLines';
import { IndicatorToggle } from '@/components/ui/IndicatorToggle';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// We use dynamic import for lightweight-charts to avoid SSR issues.
// These type aliases are inferred from the dynamic import so we don't need
// to import the types statically — they're only used for ref typing.
type LWC = typeof import('lightweight-charts');
type ChartApi = ReturnType<LWC['createChart']>;
type CandlestickSeriesApi = ReturnType<ChartApi['addSeries']>;

interface ChartColors {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  separator: string;
  separatorHover: string;
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DARK_COLORS: ChartColors = {
  background: '#12161c',
  text: '#848e9c',
  grid: '#1a1f27',
  border: '#252930',
  crosshair: '#5e6673',
  separator: '#1e2329',
  separatorHover: 'rgba(94, 102, 115, 0.3)',
  upColor: '#00c087',
  downColor: '#f6465d',
  wickUpColor: '#00c087',
  wickDownColor: '#f6465d',
};

const LIGHT_COLORS: ChartColors = {
  background: '#ffffff',
  text: '#707a8a',
  grid: '#f5f5f5',
  border: '#eaecef',
  crosshair: '#a3a8b3',
  separator: '#eaecef',
  separatorHover: 'rgba(163, 168, 179, 0.3)',
  upColor: '#00c087',
  downColor: '#f6465d',
  wickUpColor: '#00c087',
  wickDownColor: '#f6465d',
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getColorsForTheme(theme: Theme): ChartColors {
  return theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

/**
 * Converts CandleData to the format expected by lightweight-charts.
 * UTCTimestamp is a branded number type, so we cast via `as unknown as UTCTimestamp`.
 * We return the OHLC shape inline typed to avoid importing the branded type.
 */
function toOhlcData(candle: CandleData): {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
} {
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const CandlestickWidget = memo(function CandlestickWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartApi | null>(null);
  const seriesRef = useRef<CandlestickSeriesApi | null>(null);
  const prevCandleCountRef = useRef(0);
  const prevFirstTimeRef = useRef(0);
  const prevExchangeRef = useRef('');
  const colorsRef = useRef<ChartColors>(DARK_COLORS);

  // State flag to signal that the async chart init has completed and
  // seriesRef is ready. This triggers the candle data effect to run.
  const [isChartReady, setIsChartReady] = useState(false);

  const candles = useKlineStore((state) => state.candles);
  const isLoading = useKlineStore((state) => state.isLoading);
  const theme = useUiStore((state) => state.theme);
  const exchange = useUiStore((state) => state.exchange);

  const colors = useMemo(() => getColorsForTheme(theme), [theme]);

  // Technical indicator series lifecycle
  useIndicatorSeries({ chartRef, isChartReady });

  // Historical candle loading on left-edge scroll
  useHistoricalLoader({ chartRef, isChartReady });

  // Position price lines on chart (entry, liquidation, TP/SL)
  usePositionPriceLines({ seriesRef, isChartReady });

  // Keep colorsRef in sync so the mount effect can read current colors
  colorsRef.current = colors;

  // Mount / unmount chart — runs once, does NOT depend on colors
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;

    // Dynamically import to avoid SSR issues
    import('lightweight-charts').then(({ createChart, CandlestickSeries }) => {
      if (disposed) return;

      const c = colorsRef.current;

      const chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { color: c.background },
          textColor: c.text,
          panes: {
            separatorColor: c.separator,
            separatorHoverColor: c.separatorHover,
          },
        },
        grid: {
          vertLines: { color: c.grid },
          horzLines: { color: c.grid },
        },
        crosshair: {
          vertLine: { color: c.crosshair, labelBackgroundColor: c.crosshair },
          horzLine: { color: c.crosshair, labelBackgroundColor: c.crosshair },
        },
        rightPriceScale: {
          borderColor: c.border,
        },
        timeScale: {
          borderColor: c.border,
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: c.upColor,
        downColor: c.downColor,
        borderVisible: false,
        wickUpColor: c.wickUpColor,
        wickDownColor: c.wickDownColor,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      prevCandleCountRef.current = 0;
      prevFirstTimeRef.current = 0;
      setIsChartReady(true);
    });

    return () => {
      disposed = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      setIsChartReady(false);
    };
  }, []);

  // Apply theme changes via applyOptions (no chart recreation)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.applyOptions({
      layout: {
        background: { color: colors.background },
        textColor: colors.text,
        panes: {
          separatorColor: colors.separator,
          separatorHoverColor: colors.separatorHover,
        },
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });

    const series = seriesRef.current;
    if (series) {
      series.applyOptions({
        upColor: colors.upColor,
        downColor: colors.downColor,
        wickUpColor: colors.wickUpColor,
        wickDownColor: colors.wickDownColor,
      });
    }
  }, [colors]);

  // Update candle data — depends on isChartReady to avoid null series
  useEffect(() => {
    const series = seriesRef.current;
    if (!isChartReady || !series) return;

    // Force clear on exchange switch to prevent stale data from the
    // previous exchange's price scale (USDT vs KRW) lingering on the chart.
    const exchangeChanged = prevExchangeRef.current !== '' && prevExchangeRef.current !== exchange;
    prevExchangeRef.current = exchange;

    if (exchangeChanged || candles.length === 0) {
      prevCandleCountRef.current = 0;
      prevFirstTimeRef.current = 0;
      series.setData([]);
      return;
    }

    const firstTime = candles[0].time;

    // Detect historical data prepend: more candles AND earlier first candle time.
    // This means older candles were loaded via infinite scroll — we must update
    // the full dataset but NOT call fitContent() to preserve scroll position.
    const isPrepend =
      prevCandleCountRef.current > 0 &&
      candles.length > prevCandleCountRef.current &&
      firstTime < prevFirstTimeRef.current;

    // Detect when a full setData + fitContent is needed:
    // - Initial load (prevCandleCountRef === 0)
    // - Symbol change (length decreased)
    // - Rolling window shift (first candle's time changed while length stayed the same,
    //   meaning addCandle triggered slice(-MAX_CANDLES) eviction)
    const needsFullReset =
      prevCandleCountRef.current === 0 ||
      candles.length < prevCandleCountRef.current ||
      (candles.length === prevCandleCountRef.current && prevFirstTimeRef.current !== firstTime);

    if (isPrepend) {
      // Historical data prepended — update all data but preserve scroll position
      // @ts-expect-error — lightweight-charts Time is a branded number type,
      // but our CandleData.time is a plain number (UTC seconds). The values are
      // compatible at runtime; the branded type just prevents direct assignment.
      series.setData(candles.map(toOhlcData));
      // DO NOT call fitContent() — user is browsing historical data
    } else if (needsFullReset) {
      // @ts-expect-error — same branded type issue as above
      series.setData(candles.map(toOhlcData));
      chartRef.current?.timeScale().fitContent();
    } else {
      // New candle added or last candle updated in place
      const lastCandle = candles[candles.length - 1];
      // @ts-expect-error — same branded type issue as above
      series.update(toOhlcData(lastCandle));
    }

    prevCandleCountRef.current = candles.length;
    prevFirstTimeRef.current = firstTime;
  }, [candles, isChartReady, exchange]);

  return (
    <WidgetWrapper title="Chart" headerActions={<IndicatorToggle />}>
      <div ref={containerRef} className="h-full w-full">
        {isLoading && (
          <div className="bg-background-secondary/80 absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-foreground-secondary text-xs">Loading chart data...</span>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
});
