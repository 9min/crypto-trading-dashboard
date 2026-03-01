// =============================================================================
// usePositionPriceLines Hook
// =============================================================================
// Renders position-related price lines on the candlestick chart series.
// Subscribes to portfolioStore (Binance futures) or spotStore (Upbit spot)
// and creates/updates/removes price lines as positions change.
//
// Price lines shown per exchange:
//   - Binance (futures): entry, liquidation, take-profit, stop-loss
//   - Upbit (spot): average buy price only
//
// Uses the same hook pattern as useIndicatorSeries and useHistoricalLoader.
// =============================================================================

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSpotStore } from '@/stores/spotStore';
import { positionKey } from '@/types/portfolio';
import type { FuturesPosition } from '@/types/portfolio';
import type { SpotHolding } from '@/types/spot';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LWC = typeof import('lightweight-charts');
type ChartApi = ReturnType<LWC['createChart']>;
type CandlestickSeriesApi = ReturnType<ChartApi['addSeries']>;
type PriceLineApi = ReturnType<CandlestickSeriesApi['createPriceLine']>;

interface UsePositionPriceLinesParams {
  /** Ref to the candlestick series instance */
  seriesRef: MutableRefObject<CandlestickSeriesApi | null>;
  /** Whether the chart has been initialized and is ready */
  isChartReady: boolean;
}

/** Tracks all price lines for a single position */
interface PriceLineGroup {
  /** Composite key: "BTCUSDT_long", "BTCUSDT_short", or "BTCUSDT_spot" */
  key: string;
  /** Entry/avg buy price line */
  entryLine: PriceLineApi;
  /** Liquidation price line (futures only) */
  liquidationLine: PriceLineApi | null;
  /** Take-profit price line (futures only) */
  takeProfitLine: PriceLineApi | null;
  /** Stop-loss price line (futures only) */
  stopLossLine: PriceLineApi | null;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Colors matching the project's standard palette */
const COLOR_GREEN = '#00C087';
const COLOR_RED = '#F6465D';
const COLOR_YELLOW = '#F0B90B';

/** Line style constants (matches lightweight-charts LineStyle enum values) */
const LINE_STYLE_DASHED = 2;
const LINE_STYLE_DOTTED = 1;
const LINE_STYLE_SPARSE_DOTTED = 4;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Builds the set of desired price line groups from current positions/holdings.
 * Returns a Map of key → position/holding data needed to create lines.
 */
function buildDesiredLines(
  exchange: string,
  symbol: string,
  positions: Map<string, FuturesPosition>,
  holdings: Map<string, SpotHolding>,
): Map<
  string,
  { type: 'futures'; position: FuturesPosition } | { type: 'spot'; holding: SpotHolding }
> {
  const desired = new Map<
    string,
    { type: 'futures'; position: FuturesPosition } | { type: 'spot'; holding: SpotHolding }
  >();

  if (exchange === 'binance') {
    const longKey = positionKey(symbol, 'long');
    const shortKey = positionKey(symbol, 'short');
    const longPos = positions.get(longKey);
    const shortPos = positions.get(shortKey);

    if (longPos) {
      desired.set(longKey, { type: 'futures', position: longPos });
    }
    if (shortPos) {
      desired.set(shortKey, { type: 'futures', position: shortPos });
    }
  } else if (exchange === 'upbit') {
    const holding = holdings.get(symbol);
    if (holding) {
      desired.set(`${symbol}_spot`, { type: 'spot', holding });
    }
  }

  return desired;
}

/**
 * Creates price lines for a futures position on the given series.
 */
function createFuturesLines(
  series: CandlestickSeriesApi,
  position: FuturesPosition,
): PriceLineGroup {
  const isLong = position.side === 'long';
  const entryColor = isLong ? COLOR_GREEN : COLOR_RED;
  const entryLabel = `${isLong ? 'Long' : 'Short'} ${position.leverage}x`;

  const entryLine = series.createPriceLine({
    price: position.entryPrice,
    color: entryColor,
    lineWidth: 1,
    lineStyle: LINE_STYLE_DASHED,
    axisLabelVisible: true,
    title: entryLabel,
  });

  let liquidationLine: PriceLineApi | null = null;
  if (position.liquidationPrice > 0 && isFinite(position.liquidationPrice)) {
    liquidationLine = series.createPriceLine({
      price: position.liquidationPrice,
      color: COLOR_RED,
      lineWidth: 1,
      lineStyle: LINE_STYLE_DOTTED,
      axisLabelVisible: true,
      title: 'Liq.',
    });
  }

  let takeProfitLine: PriceLineApi | null = null;
  if (position.takeProfitPrice !== null) {
    takeProfitLine = series.createPriceLine({
      price: position.takeProfitPrice,
      color: COLOR_GREEN,
      lineWidth: 1,
      lineStyle: LINE_STYLE_SPARSE_DOTTED,
      axisLabelVisible: true,
      title: 'TP',
    });
  }

  let stopLossLine: PriceLineApi | null = null;
  if (position.stopLossPrice !== null) {
    stopLossLine = series.createPriceLine({
      price: position.stopLossPrice,
      color: COLOR_YELLOW,
      lineWidth: 1,
      lineStyle: LINE_STYLE_SPARSE_DOTTED,
      axisLabelVisible: true,
      title: 'SL',
    });
  }

  return {
    key: positionKey(position.symbol, position.side),
    entryLine,
    liquidationLine,
    takeProfitLine,
    stopLossLine,
  };
}

/**
 * Creates a single avg buy price line for a spot holding.
 */
function createSpotLines(series: CandlestickSeriesApi, holding: SpotHolding): PriceLineGroup {
  const entryLine = series.createPriceLine({
    price: holding.avgEntryPrice,
    color: COLOR_GREEN,
    lineWidth: 1,
    lineStyle: LINE_STYLE_DASHED,
    axisLabelVisible: true,
    title: 'Avg Buy',
  });

  return {
    key: `${holding.symbol}_spot`,
    entryLine,
    liquidationLine: null,
    takeProfitLine: null,
    stopLossLine: null,
  };
}

/**
 * Safely removes a single price line from the series.
 * Swallows errors if the line or series is already disposed.
 */
function safeRemovePriceLine(series: CandlestickSeriesApi, line: PriceLineApi): void {
  try {
    series.removePriceLine(line);
  } catch {
    // Line or series may already be removed if chart was recreated
  }
}

/**
 * Removes all price lines in a group from the series.
 * Each removal is independent so one failure doesn't prevent the others.
 */
function removeLineGroup(series: CandlestickSeriesApi, group: PriceLineGroup): void {
  safeRemovePriceLine(series, group.entryLine);
  if (group.liquidationLine) safeRemovePriceLine(series, group.liquidationLine);
  if (group.takeProfitLine) safeRemovePriceLine(series, group.takeProfitLine);
  if (group.stopLossLine) safeRemovePriceLine(series, group.stopLossLine);
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePositionPriceLines({
  seriesRef,
  isChartReady,
}: UsePositionPriceLinesParams): void {
  const activeLinesRef = useRef<Map<string, PriceLineGroup>>(new Map());
  const prevExchangeRef = useRef<string>('');

  const symbol = useUiStore((state) => state.symbol);
  const exchange = useUiStore((state) => state.exchange);
  const positions = usePortfolioStore((state) => state.positions);
  const holdings = useSpotStore((state) => state.holdings);

  // Main effect: sync price lines with position/holding data
  useEffect(() => {
    const series = seriesRef.current;
    if (!isChartReady || !series) return;

    const activeLines = activeLinesRef.current;

    // Force-clear ALL lines on exchange switch to prevent stale USDT lines
    // appearing on KRW charts (or vice versa). The incremental diff below
    // handles normal position changes; this block is a safety net for the
    // exchange transition where price scales differ by orders of magnitude.
    if (prevExchangeRef.current !== '' && prevExchangeRef.current !== exchange) {
      for (const [, group] of activeLines) {
        removeLineGroup(series, group);
      }
      activeLines.clear();
    }
    prevExchangeRef.current = exchange;

    const desired = buildDesiredLines(exchange, symbol, positions, holdings);

    // Remove lines for positions that no longer exist
    for (const [key, group] of activeLines) {
      if (!desired.has(key)) {
        removeLineGroup(series, group);
        activeLines.delete(key);
      }
    }

    // Create or update lines for current positions
    for (const [key, data] of desired) {
      const existing = activeLines.get(key);

      if (data.type === 'futures') {
        const pos = data.position;
        if (existing) {
          // Update existing lines via applyOptions
          existing.entryLine.applyOptions({
            price: pos.entryPrice,
            title: `${pos.side === 'long' ? 'Long' : 'Short'} ${pos.leverage}x`,
          });

          // Liquidation line
          if (pos.liquidationPrice > 0 && isFinite(pos.liquidationPrice)) {
            if (existing.liquidationLine) {
              existing.liquidationLine.applyOptions({ price: pos.liquidationPrice });
            } else {
              existing.liquidationLine = series.createPriceLine({
                price: pos.liquidationPrice,
                color: COLOR_RED,
                lineWidth: 1,
                lineStyle: LINE_STYLE_DOTTED,
                axisLabelVisible: true,
                title: 'Liq.',
              });
            }
          } else if (existing.liquidationLine) {
            series.removePriceLine(existing.liquidationLine);
            existing.liquidationLine = null;
          }

          // Take-profit line
          if (pos.takeProfitPrice !== null) {
            if (existing.takeProfitLine) {
              existing.takeProfitLine.applyOptions({ price: pos.takeProfitPrice });
            } else {
              existing.takeProfitLine = series.createPriceLine({
                price: pos.takeProfitPrice,
                color: COLOR_GREEN,
                lineWidth: 1,
                lineStyle: LINE_STYLE_SPARSE_DOTTED,
                axisLabelVisible: true,
                title: 'TP',
              });
            }
          } else if (existing.takeProfitLine) {
            series.removePriceLine(existing.takeProfitLine);
            existing.takeProfitLine = null;
          }

          // Stop-loss line
          if (pos.stopLossPrice !== null) {
            if (existing.stopLossLine) {
              existing.stopLossLine.applyOptions({ price: pos.stopLossPrice });
            } else {
              existing.stopLossLine = series.createPriceLine({
                price: pos.stopLossPrice,
                color: COLOR_YELLOW,
                lineWidth: 1,
                lineStyle: LINE_STYLE_SPARSE_DOTTED,
                axisLabelVisible: true,
                title: 'SL',
              });
            }
          } else if (existing.stopLossLine) {
            series.removePriceLine(existing.stopLossLine);
            existing.stopLossLine = null;
          }
        } else {
          // Create new line group
          activeLines.set(key, createFuturesLines(series, pos));
        }
      } else {
        // Spot holding
        const holding = data.holding;
        if (existing) {
          existing.entryLine.applyOptions({ price: holding.avgEntryPrice });
        } else {
          activeLines.set(key, createSpotLines(series, holding));
        }
      }
    }
  }, [symbol, exchange, positions, holdings, isChartReady, seriesRef]);

  // Cleanup all lines on unmount
  useEffect(() => {
    const activeLines = activeLinesRef.current;
    const series = seriesRef.current;
    return () => {
      if (series) {
        for (const [, group] of activeLines) {
          removeLineGroup(series, group);
        }
      }
      activeLines.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup; refs are stable
  }, []);
}

// Export types and helpers for testing
export type { UsePositionPriceLinesParams, PriceLineGroup };
export { buildDesiredLines, createFuturesLines, createSpotLines, removeLineGroup };
