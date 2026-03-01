// =============================================================================
// usePositionPriceLines Tests
// =============================================================================
// Tests the position price line lifecycle on the candlestick chart:
//   - Binance futures: entry, liquidation, TP, SL lines
//   - Upbit spot: avg buy price line
//   - Hedge mode: long + short coexistence
//   - Position updates via applyOptions
//   - Cleanup on symbol change, exchange switch, and unmount
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { FuturesPosition } from '@/types/portfolio';
import type { SpotHolding } from '@/types/spot';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

// Mock uiStore
let mockSymbol = 'BTCUSDT';
let mockExchange: 'binance' | 'upbit' = 'binance';

vi.mock('@/stores/uiStore', () => ({
  useUiStore: (selector: (state: { symbol: string; exchange: string }) => unknown) =>
    selector({ symbol: mockSymbol, exchange: mockExchange }),
}));

// Mock portfolioStore
let mockPositions = new Map<string, FuturesPosition>();

vi.mock('@/stores/portfolioStore', () => ({
  usePortfolioStore: (selector: (state: { positions: Map<string, FuturesPosition> }) => unknown) =>
    selector({ positions: mockPositions }),
}));

// Mock spotStore
let mockHoldings = new Map<string, SpotHolding>();

vi.mock('@/stores/spotStore', () => ({
  useSpotStore: (selector: (state: { holdings: Map<string, SpotHolding> }) => unknown) =>
    selector({ holdings: mockHoldings }),
}));

import { usePositionPriceLines } from './usePositionPriceLines';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createMockPriceLine() {
  return {
    applyOptions: vi.fn(),
  };
}

function createMockSeries() {
  const lines: ReturnType<typeof createMockPriceLine>[] = [];
  return {
    createPriceLine: vi.fn(() => {
      const line = createMockPriceLine();
      lines.push(line);
      return line;
    }),
    removePriceLine: vi.fn(),
    _lines: lines,
  };
}

function createSeriesRef(series: ReturnType<typeof createMockSeries> | null) {
  return { current: series } as unknown as MutableRefObject<ReturnType<
    typeof createMockSeries
  > | null>;
}

function makeFuturesPosition(overrides: Partial<FuturesPosition> = {}): FuturesPosition {
  return {
    id: 'futures-1234567890-abc123',
    symbol: 'BTCUSDT',
    side: 'long',
    entryPrice: 50000,
    quantity: 0.1,
    leverage: 10,
    marginType: 'isolated',
    margin: 500,
    liquidationPrice: 45000,
    openedAt: Date.now(),
    takeProfitPrice: null,
    stopLossPrice: null,
    ...overrides,
  };
}

function makeSpotHolding(overrides: Partial<SpotHolding> = {}): SpotHolding {
  return {
    symbol: 'BTCUSDT',
    avgEntryPrice: 94850000,
    quantity: 0.01,
    costBasis: 948500,
    firstBoughtAt: Date.now(),
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('usePositionPriceLines', () => {
  beforeEach(() => {
    mockSymbol = 'BTCUSDT';
    mockExchange = 'binance';
    mockPositions = new Map();
    mockHoldings = new Map();
  });

  // ---- Binance Futures: Entry Lines ----

  it('creates entry + liquidation lines for a long position', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ side: 'long', leverage: 10 });
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Entry + liquidation = 2 lines
    expect(series.createPriceLine).toHaveBeenCalledTimes(2);
    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 50000,
        color: '#00C087',
        title: 'Long 10x',
      }),
    );
    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 45000,
        color: '#F6465D',
        title: 'Liq.',
      }),
    );
  });

  it('creates entry + liquidation lines for a short position with correct colors', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({
      side: 'short',
      leverage: 25,
      entryPrice: 50000,
      liquidationPrice: 52000,
    });
    mockPositions.set('BTCUSDT_short', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 50000,
        color: '#F6465D',
        title: 'Short 25x',
      }),
    );
  });

  // ---- Hedge Mode ----

  it('creates separate line groups for long and short (hedge mode)', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const longPos = makeFuturesPosition({ side: 'long' });
    const shortPos = makeFuturesPosition({
      side: 'short',
      entryPrice: 55000,
      liquidationPrice: 57000,
    });
    mockPositions.set('BTCUSDT_long', longPos);
    mockPositions.set('BTCUSDT_short', shortPos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // 2 entries + 2 liquidations = 4 lines
    expect(series.createPriceLine).toHaveBeenCalledTimes(4);
  });

  // ---- TP/SL Lines ----

  it('creates TP line when takeProfitPrice is set', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ takeProfitPrice: 60000 });
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 60000,
        color: '#00C087',
        title: 'TP',
      }),
    );
  });

  it('creates SL line when stopLossPrice is set', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ stopLossPrice: 48000 });
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 48000,
        color: '#F0B90B',
        title: 'SL',
      }),
    );
  });

  it('does not create TP/SL lines when prices are null', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({
      takeProfitPrice: null,
      stopLossPrice: null,
    });
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Only entry + liquidation
    expect(series.createPriceLine).toHaveBeenCalledTimes(2);
    const titles = series.createPriceLine.mock.calls.map(
      (call) => (call[0] as { title: string }).title,
    );
    expect(titles).not.toContain('TP');
    expect(titles).not.toContain('SL');
  });

  // ---- Cross Margin: No Liquidation Line ----

  it('does not create liquidation line when liquidationPrice is 0 (cross margin)', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({
      marginType: 'cross',
      liquidationPrice: 0,
    });
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Only entry line
    expect(series.createPriceLine).toHaveBeenCalledTimes(1);
    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Long 10x' }),
    );
  });

  it('does not create liquidation line when liquidationPrice is Infinity', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({
      marginType: 'cross',
      liquidationPrice: Infinity,
    });
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledTimes(1);
  });

  // ---- Position Close: Remove Lines ----

  it('removes price lines when position is closed', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition();
    mockPositions.set('BTCUSDT_long', pos);

    const { rerender } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledTimes(2);

    // Close position
    mockPositions = new Map();
    rerender();

    // Both entry and liquidation lines removed
    expect(series.removePriceLine).toHaveBeenCalledTimes(2);
  });

  // ---- Symbol Change ----

  it('removes previous lines and creates new ones on symbol change', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const btcPos = makeFuturesPosition({ symbol: 'BTCUSDT' });
    mockPositions.set('BTCUSDT_long', btcPos);

    const { rerender } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledTimes(2);

    // Change symbol to ETH (no positions on ETH)
    mockSymbol = 'ETHUSDT';
    mockPositions = new Map();
    rerender();

    expect(series.removePriceLine).toHaveBeenCalledTimes(2);
  });

  // ---- Upbit Spot ----

  it('creates avg buy line for upbit spot holding', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    mockExchange = 'upbit';
    const holding = makeSpotHolding();
    mockHoldings.set('BTCUSDT', holding);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledTimes(1);
    expect(series.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 94850000,
        color: '#00C087',
        title: 'Avg Buy',
      }),
    );
  });

  it('does not create lines for upbit when symbol has no holding', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    mockExchange = 'upbit';
    // No holding for current symbol

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).not.toHaveBeenCalled();
  });

  // ---- Exchange Switch ----

  it('removes futures lines and creates spot lines on exchange switch', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition();
    mockPositions.set('BTCUSDT_long', pos);

    const { rerender } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    expect(series.createPriceLine).toHaveBeenCalledTimes(2);

    // Switch to upbit
    mockExchange = 'upbit';
    const holding = makeSpotHolding();
    mockHoldings.set('BTCUSDT', holding);
    rerender();

    // Futures lines removed (entry + liquidation)
    expect(series.removePriceLine).toHaveBeenCalledTimes(2);
    // Spot avg buy line created (total calls: 2 + 1 = 3)
    expect(series.createPriceLine).toHaveBeenCalledTimes(3);
  });

  // ---- isChartReady ----

  it('does not create lines when isChartReady is false', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition();
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: false }));

    expect(series.createPriceLine).not.toHaveBeenCalled();
  });

  // ---- Unmount Cleanup ----

  it('removes all lines on unmount', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ takeProfitPrice: 60000, stopLossPrice: 48000 });
    mockPositions.set('BTCUSDT_long', pos);

    const { unmount } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Entry + liquidation + TP + SL = 4 lines created
    expect(series.createPriceLine).toHaveBeenCalledTimes(4);

    unmount();

    // All 4 lines removed
    expect(series.removePriceLine).toHaveBeenCalledTimes(4);
  });

  // ---- Position Averaging: applyOptions Update ----

  it('updates entry price via applyOptions when position is averaged', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ entryPrice: 50000 });
    mockPositions.set('BTCUSDT_long', pos);

    const { rerender } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Get the entry line (first created line)
    const entryLine = series._lines[0];
    expect(entryLine.applyOptions).not.toHaveBeenCalled();

    // Average down: entry price changes
    mockPositions = new Map([
      ['BTCUSDT_long', makeFuturesPosition({ entryPrice: 48000, liquidationPrice: 43000 })],
    ]);
    rerender();

    // applyOptions called on the entry line
    expect(entryLine.applyOptions).toHaveBeenCalledWith(expect.objectContaining({ price: 48000 }));
  });

  // ---- No Series Ref ----

  it('does not create lines when seriesRef.current is null', () => {
    const seriesRef = createSeriesRef(null);
    const pos = makeFuturesPosition();
    mockPositions.set('BTCUSDT_long', pos);

    renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Nothing should happen (no series to create lines on)
  });

  // ---- TP/SL Dynamic Add/Remove ----

  it('adds TP line dynamically when takeProfitPrice changes from null to value', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ takeProfitPrice: null });
    mockPositions.set('BTCUSDT_long', pos);

    const { rerender } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Only entry + liquidation = 2
    expect(series.createPriceLine).toHaveBeenCalledTimes(2);

    // Set TP
    mockPositions = new Map([['BTCUSDT_long', makeFuturesPosition({ takeProfitPrice: 60000 })]]);
    rerender();

    // TP line created (3rd call)
    expect(series.createPriceLine).toHaveBeenCalledTimes(3);
    expect(series.createPriceLine).toHaveBeenLastCalledWith(
      expect.objectContaining({ price: 60000, title: 'TP' }),
    );
  });

  it('removes SL line dynamically when stopLossPrice changes from value to null', () => {
    const series = createMockSeries();
    const seriesRef = createSeriesRef(series);
    const pos = makeFuturesPosition({ stopLossPrice: 48000 });
    mockPositions.set('BTCUSDT_long', pos);

    const { rerender } = renderHook(() => usePositionPriceLines({ seriesRef, isChartReady: true }));

    // Entry + liquidation + SL = 3
    expect(series.createPriceLine).toHaveBeenCalledTimes(3);

    // Remove SL
    mockPositions = new Map([['BTCUSDT_long', makeFuturesPosition({ stopLossPrice: null })]]);
    rerender();

    // SL line removed
    expect(series.removePriceLine).toHaveBeenCalledTimes(1);
  });
});
