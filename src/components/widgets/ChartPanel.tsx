'use client';

// =============================================================================
// ChartPanel Component
// =============================================================================
// Individual chart panel for the multi-chart widget. Each panel manages its
// own lightweight-charts instance and WebSocket connection, independent of
// the global klineStore and CandlestickWidget.
//
// Features:
//   - Local kline data via useChartPanelStream
//   - Crosshair synchronization via useChartSync + ChartSyncHub
//   - Theme-aware chart colors
//   - Symbol selector dropdown (POPULAR_USDT_SYMBOLS)
//   - Interval selector per panel
// =============================================================================

import { memo, useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useMultiChartStore } from '@/stores/multiChartStore';
import { useChartPanelStream } from '@/hooks/useChartPanelStream';
import { useChartSync } from '@/hooks/useChartSync';
import { POPULAR_USDT_SYMBOLS } from '@/utils/symbolSearch';
import { BINANCE_TO_UPBIT_MAP } from '@/utils/symbolMap';
import type { ChartSyncHub, ChartLike, SeriesLike } from '@/lib/chart/ChartSyncHub';
import type { CandleData, KlineInterval } from '@/types/chart';
import { KLINE_INTERVALS } from '@/types/chart';
import type { Theme } from '@/stores/uiStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LWC = typeof import('lightweight-charts');
type ChartApi = ReturnType<LWC['createChart']>;
type CandlestickSeriesApi = ReturnType<ChartApi['addSeries']>;

interface ChartPanelProps {
  panelId: string;
  symbol: string;
  interval: KlineInterval;
  syncHub: ChartSyncHub;
}

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

export const ChartPanel = memo(function ChartPanel({
  panelId,
  symbol,
  interval,
  syncHub,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartApi | null>(null);
  const seriesRef = useRef<CandlestickSeriesApi | null>(null);
  const prevCandleCountRef = useRef(0);
  const prevFirstTimeRef = useRef(0);
  const colorsRef = useRef<ChartColors>(DARK_COLORS);

  const [isChartReady, setIsChartReady] = useState(false);

  const theme = useUiStore((state) => state.theme);
  const exchange = useUiStore((state) => state.exchange);
  const setPanelSymbol = useMultiChartStore((state) => state.setPanelSymbol);
  const setPanelInterval = useMultiChartStore((state) => state.setPanelInterval);

  const colors = useMemo(() => getColorsForTheme(theme), [theme]);
  colorsRef.current = colors;

  // Filter symbols to only those available on the active exchange
  const availableSymbols = useMemo(
    () =>
      exchange === 'upbit'
        ? POPULAR_USDT_SYMBOLS.filter((s) => BINANCE_TO_UPBIT_MAP.has(s))
        : POPULAR_USDT_SYMBOLS,
    [exchange],
  );

  // Auto-reset symbol when switching to upbit if current symbol has no mapping
  useEffect(() => {
    if (exchange === 'upbit' && !BINANCE_TO_UPBIT_MAP.has(symbol) && availableSymbols.length > 0) {
      setPanelSymbol(panelId, availableSymbols[0]);
    }
  }, [exchange, symbol, panelId, setPanelSymbol, availableSymbols]);

  // Per-panel data stream
  const { candles, isLoading } = useChartPanelStream({ panelId, symbol, interval });

  // Crosshair sync (uses refs — no re-render on crosshair move)
  useChartSync({
    panelId,
    chartRef: chartRef as React.MutableRefObject<ChartLike | null>,
    seriesRef: seriesRef as React.MutableRefObject<SeriesLike | null>,
    syncHub,
    isChartReady,
  });

  // Mount / unmount chart
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;

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

  // Apply theme changes
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

  // Update candle data
  useEffect(() => {
    const series = seriesRef.current;
    if (!isChartReady || !series) return;

    if (candles.length === 0) {
      prevCandleCountRef.current = 0;
      prevFirstTimeRef.current = 0;
      series.setData([]);
      return;
    }

    const firstTime = candles[0].time;

    const needsFullReset =
      prevCandleCountRef.current === 0 ||
      candles.length < prevCandleCountRef.current ||
      (candles.length === prevCandleCountRef.current && prevFirstTimeRef.current !== firstTime);

    if (needsFullReset) {
      // @ts-expect-error — lightweight-charts Time is a branded number type
      series.setData(candles.map(toOhlcData));
      chartRef.current?.timeScale().fitContent();
    } else {
      const lastCandle = candles[candles.length - 1];
      // @ts-expect-error — branded type mismatch
      series.update(toOhlcData(lastCandle));
    }

    prevCandleCountRef.current = candles.length;
    prevFirstTimeRef.current = firstTime;
  }, [candles, isChartReady]);

  const handleSymbolChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setPanelSymbol(panelId, e.target.value);
    },
    [panelId, setPanelSymbol],
  );

  const handleIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setPanelInterval(panelId, e.target.value as KlineInterval);
    },
    [panelId, setPanelInterval],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Chart container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Symbol & interval overlay */}
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
        <select
          value={symbol}
          onChange={handleSymbolChange}
          className="bg-background-tertiary/80 text-foreground hover:bg-background-tertiary h-6 cursor-pointer rounded px-1 text-xs font-semibold backdrop-blur-sm transition-colors"
        >
          {availableSymbols.map((s) => (
            <option key={s} value={s}>
              {s.replace('USDT', '')}
            </option>
          ))}
        </select>

        <select
          value={interval}
          onChange={handleIntervalChange}
          className="bg-background-tertiary/80 text-foreground-secondary hover:bg-background-tertiary h-6 cursor-pointer rounded px-1 text-xs backdrop-blur-sm transition-colors"
        >
          {KLINE_INTERVALS.map((iv) => (
            <option key={iv} value={iv}>
              {iv}
            </option>
          ))}
        </select>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="bg-background-secondary/80 absolute inset-0 z-10 flex items-center justify-center">
          <span className="text-foreground-secondary text-xs">Loading...</span>
        </div>
      )}
    </div>
  );
});
