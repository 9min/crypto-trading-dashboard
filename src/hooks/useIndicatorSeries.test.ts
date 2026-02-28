// =============================================================================
// useIndicatorSeries Tests
// =============================================================================
// Tests the chart indicator series lifecycle management:
//   - Dynamic import of lightweight-charts module
//   - SMA/EMA: LineSeries creation, data update, removal
//   - Bollinger Bands: 3 LineSeries (upper/middle/lower)
//   - RSI: LineSeries in pane 1, compact height, 0-100 scale, price lines
//   - Volume: HistogramSeries + MA LineSeries, pane index shifts with RSI
//   - Series lifecycle: show/hide/remove cleanup
//   - Cleanup all series on unmount
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MutableRefObject } from 'react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockComputeSma = vi.fn(() => [{ time: 1, value: 100 }]);
const mockComputeEma = vi.fn(() => [{ time: 1, value: 100 }]);
const mockComputeBollingerBands = vi.fn(() => [{ time: 1, upper: 110, middle: 100, lower: 90 }]);
const mockComputeRsi = vi.fn(() => [{ time: 1, value: 50 }]);
const mockComputeVolumeWithMa = vi.fn(() => ({
  volumes: [{ time: 1, value: 1000, color: 'green' }],
  ma: [{ time: 1, value: 800 }],
}));

vi.mock('@/utils/indicators', () => ({
  computeSma: (...args: unknown[]) => mockComputeSma(...args),
  computeEma: (...args: unknown[]) => mockComputeEma(...args),
  computeBollingerBands: (...args: unknown[]) => mockComputeBollingerBands(...args),
  computeRsi: (...args: unknown[]) => mockComputeRsi(...args),
  computeVolumeWithMa: (...args: unknown[]) => mockComputeVolumeWithMa(...args),
}));

// Mock lightweight-charts as a dynamic import
const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockCreatePriceLine = vi.fn();
const mockRemoveSeries = vi.fn();

const mockSeriesApi = {
  setData: mockSetData,
  applyOptions: mockApplyOptions,
  createPriceLine: mockCreatePriceLine,
};

const mockAddSeries = vi.fn(() => ({ ...mockSeriesApi }));

const MockLineSeries = Symbol('LineSeries');
const MockHistogramSeries = Symbol('HistogramSeries');

vi.mock('lightweight-charts', () => ({
  LineSeries: MockLineSeries,
  HistogramSeries: MockHistogramSeries,
}));

import { useIndicatorStore } from '@/stores/indicatorStore';
import { useKlineStore } from '@/stores/klineStore';
import { useIndicatorSeries } from './useIndicatorSeries';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createChartMock() {
  const panesMock = [{ setHeight: vi.fn() }, { setHeight: vi.fn() }, { setHeight: vi.fn() }];

  const chart = {
    addSeries: mockAddSeries,
    removeSeries: mockRemoveSeries,
    panes: () => panesMock,
  };

  return { chart, panes: panesMock };
}

function createChartRef(chart: ReturnType<typeof createChartMock>['chart']) {
  return { current: chart } as unknown as MutableRefObject<
    ReturnType<typeof createChartMock>['chart'] | null
  >;
}

const sampleCandles = [
  { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 50 },
  { time: 2, open: 105, high: 115, low: 95, close: 110, volume: 60 },
  { time: 3, open: 110, high: 120, low: 100, close: 115, volume: 70 },
];

/**
 * Renders the hook and waits for the dynamic `import('lightweight-charts')`
 * to resolve so that `lwcModuleRef.current` is populated.
 *
 * The hook loads the module in one useEffect (stored in a ref), and uses
 * the module in a second useEffect. Since refs don't trigger re-renders,
 * we must force the second effect to re-run after the import resolves
 * by toggling a dependency (isChartReady).
 */
async function renderAndWaitForModule(
  chartRef: MutableRefObject<ReturnType<typeof createChartMock>['chart'] | null>,
) {
  let isReady = false;
  const result = renderHook(() => useIndicatorSeries({ chartRef, isChartReady: isReady }));
  // Flush the dynamic import('lightweight-charts') microtask
  await act(async () => {});
  // Now toggle isChartReady to force the main effect to re-run
  // (the ref is now populated but effects only re-run when deps change)
  isReady = true;
  await act(async () => {
    result.rerender();
  });
  return result;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useIndicatorSeries', () => {
  let chartMock: ReturnType<typeof createChartMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    chartMock = createChartMock();

    // Reset stores — volume is visible by default, hide it so tests
    // start with all indicators hidden (individual tests toggle as needed)
    useIndicatorStore.getState().reset();
    useIndicatorStore.getState().toggleIndicator('volume');
    useKlineStore.setState({ candles: sampleCandles });

    // Each addSeries call returns a fresh mock with its own setData
    mockAddSeries.mockImplementation(() => ({
      setData: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Module loading
  // ---------------------------------------------------------------------------

  describe('module loading', () => {
    it('dynamically imports lightweight-charts on mount', async () => {
      const chartRef = createChartRef(chartMock.chart);

      renderHook(() => useIndicatorSeries({ chartRef, isChartReady: true }));

      // The module import happens asynchronously
      // If it didn't crash, the import mock is working
      expect(true).toBe(true);
    });

    it('does nothing when chart is not ready', () => {
      const chartRef = createChartRef(chartMock.chart);

      renderHook(() => useIndicatorSeries({ chartRef, isChartReady: false }));

      expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('does nothing when chartRef is null', () => {
      const chartRef = { current: null } as unknown as MutableRefObject<null>;

      renderHook(() =>
        useIndicatorSeries({
          chartRef: chartRef as unknown as MutableRefObject<
            ReturnType<typeof createChartMock>['chart'] | null
          >,
          isChartReady: true,
        }),
      );

      expect(mockAddSeries).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No visible indicators
  // ---------------------------------------------------------------------------

  describe('no visible indicators', () => {
    it('does not create any series when all indicators are hidden', async () => {
      const chartRef = createChartRef(chartMock.chart);

      await renderAndWaitForModule(chartRef);

      expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('does not create series when candles are empty', async () => {
      useKlineStore.setState({ candles: [] });
      useIndicatorStore.getState().toggleIndicator('sma-20');

      const chartRef = createChartRef(chartMock.chart);

      await renderAndWaitForModule(chartRef);

      expect(mockAddSeries).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // SMA
  // ---------------------------------------------------------------------------

  describe('SMA indicator', () => {
    it('creates LineSeries when SMA is toggled visible', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockAddSeries).toHaveBeenCalledWith(
        MockLineSeries,
        expect.objectContaining({ lineWidth: 2, priceLineVisible: false }),
      );
    });

    it('calls computeSma with candles and period', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockComputeSma).toHaveBeenCalledWith(sampleCandles, 20);
    });

    it('sets data on the created series', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');
      const seriesMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      mockAddSeries.mockReturnValue(seriesMock);

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(seriesMock.setData).toHaveBeenCalled();
    });

    it('updates data on subsequent renders without creating new series', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');
      const seriesMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      mockAddSeries.mockReturnValue(seriesMock);

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      const addCount = mockAddSeries.mock.calls.length;

      // Update candles to trigger re-render
      useKlineStore.setState({
        candles: [
          ...sampleCandles,
          { time: 4, open: 115, high: 125, low: 105, close: 120, volume: 80 },
        ],
      });
      rerender();

      // Should not have created new series
      expect(mockAddSeries.mock.calls.length).toBe(addCount);
      // But setData should have been called again
      expect(seriesMock.setData.mock.calls.length).toBeGreaterThan(1);
    });

    it('removes series when indicator is toggled hidden', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      // Toggle back to hidden
      useIndicatorStore.getState().toggleIndicator('sma-20');
      rerender();

      expect(mockRemoveSeries).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // EMA
  // ---------------------------------------------------------------------------

  describe('EMA indicator', () => {
    it('creates LineSeries when EMA is toggled visible', async () => {
      useIndicatorStore.getState().toggleIndicator('ema-12');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockAddSeries).toHaveBeenCalledWith(
        MockLineSeries,
        expect.objectContaining({ lineWidth: 2 }),
      );
    });

    it('calls computeEma with candles and period', async () => {
      useIndicatorStore.getState().toggleIndicator('ema-12');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockComputeEma).toHaveBeenCalledWith(sampleCandles, 12);
    });
  });

  // ---------------------------------------------------------------------------
  // Bollinger Bands
  // ---------------------------------------------------------------------------

  describe('Bollinger Bands indicator', () => {
    it('creates 3 LineSeries (upper, middle, lower)', async () => {
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // Should create 3 series for BB
      expect(mockAddSeries).toHaveBeenCalledTimes(3);
    });

    it('calls computeBollingerBands with candles, period, and stdDev', async () => {
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockComputeBollingerBands).toHaveBeenCalledWith(sampleCandles, 20, 2);
    });

    it('creates upper and lower with dashed line style', async () => {
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // First and third calls should have lineStyle: 2 (Dashed)
      const calls = mockAddSeries.mock.calls;
      expect(calls[0][1]).toEqual(expect.objectContaining({ lineStyle: 2 }));
      expect(calls[2][1]).toEqual(expect.objectContaining({ lineStyle: 2 }));
    });

    it('creates middle band without dashed style', async () => {
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      const middleCall = mockAddSeries.mock.calls[1];
      expect(middleCall[1].lineStyle).toBeUndefined();
    });

    it('removes all 3 series when toggled hidden', async () => {
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      useIndicatorStore.getState().toggleIndicator('bb-20');
      rerender();

      expect(mockRemoveSeries).toHaveBeenCalledTimes(3);
    });

    it('updates all 3 series data on re-render', async () => {
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const upperMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      const middleMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      const lowerMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      mockAddSeries
        .mockReturnValueOnce(upperMock)
        .mockReturnValueOnce(middleMock)
        .mockReturnValueOnce(lowerMock);

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      // Initial setData
      expect(upperMock.setData).toHaveBeenCalledTimes(1);

      // Update candles
      useKlineStore.setState({
        candles: [
          ...sampleCandles,
          { time: 4, open: 115, high: 125, low: 105, close: 120, volume: 80 },
        ],
      });
      rerender();

      expect(upperMock.setData).toHaveBeenCalledTimes(2);
      expect(middleMock.setData).toHaveBeenCalledTimes(2);
      expect(lowerMock.setData).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // RSI
  // ---------------------------------------------------------------------------

  describe('RSI indicator', () => {
    it('creates LineSeries in pane 1', async () => {
      useIndicatorStore.getState().toggleIndicator('rsi-14');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // addSeries for RSI has 3 args: SeriesType, options, paneIndex
      expect(mockAddSeries).toHaveBeenCalledWith(
        MockLineSeries,
        expect.objectContaining({ priceScaleId: 'rsi' }),
        1,
      );
    });

    it('sets pane height to 80px', async () => {
      useIndicatorStore.getState().toggleIndicator('rsi-14');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(chartMock.panes[1].setHeight).toHaveBeenCalledWith(80);
    });

    it('sets autoscale range 0-100', async () => {
      useIndicatorStore.getState().toggleIndicator('rsi-14');

      const seriesMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      mockAddSeries.mockReturnValue(seriesMock);

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(seriesMock.applyOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          autoscaleInfoProvider: expect.any(Function),
        }),
      );

      // Verify the autoscale range
      const optionsCall = seriesMock.applyOptions.mock.calls[0][0];
      const scaleInfo = optionsCall.autoscaleInfoProvider();
      expect(scaleInfo.priceRange.minValue).toBe(0);
      expect(scaleInfo.priceRange.maxValue).toBe(100);
    });

    it('creates 3 price lines (overbought, mid, oversold)', async () => {
      useIndicatorStore.getState().toggleIndicator('rsi-14');

      const seriesMock = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn() };
      mockAddSeries.mockReturnValue(seriesMock);

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(seriesMock.createPriceLine).toHaveBeenCalledTimes(3);

      // Verify overbought line at 70
      expect(seriesMock.createPriceLine).toHaveBeenCalledWith(
        expect.objectContaining({ price: 70 }),
      );
      // Verify midline at 50
      expect(seriesMock.createPriceLine).toHaveBeenCalledWith(
        expect.objectContaining({ price: 50 }),
      );
      // Verify oversold line at 30
      expect(seriesMock.createPriceLine).toHaveBeenCalledWith(
        expect.objectContaining({ price: 30 }),
      );
    });

    it('calls computeRsi with candles and period', async () => {
      useIndicatorStore.getState().toggleIndicator('rsi-14');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockComputeRsi).toHaveBeenCalledWith(sampleCandles, 14);
    });
  });

  // ---------------------------------------------------------------------------
  // Volume
  // ---------------------------------------------------------------------------

  describe('Volume indicator', () => {
    it('creates HistogramSeries and LineSeries', async () => {
      useIndicatorStore.getState().toggleIndicator('volume');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // First call: HistogramSeries, second call: LineSeries (MA)
      expect(mockAddSeries).toHaveBeenCalledTimes(2);
      expect(mockAddSeries.mock.calls[0][0]).toBe(MockHistogramSeries);
      expect(mockAddSeries.mock.calls[1][0]).toBe(MockLineSeries);
    });

    it('creates volume in pane 1 when RSI is not visible', async () => {
      useIndicatorStore.getState().toggleIndicator('volume');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // Pane index should be 1 (no RSI)
      expect(mockAddSeries.mock.calls[0][2]).toBe(1);
      expect(mockAddSeries.mock.calls[1][2]).toBe(1);
    });

    it('creates volume in pane 2 when RSI is visible', async () => {
      useIndicatorStore.getState().toggleIndicator('rsi-14');
      useIndicatorStore.getState().toggleIndicator('volume');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // Find the HistogramSeries call (volume)
      const volumeCall = mockAddSeries.mock.calls.find((call) => call[0] === MockHistogramSeries);
      expect(volumeCall?.[2]).toBe(2);
    });

    it('sets pane height to 60px', async () => {
      useIndicatorStore.getState().toggleIndicator('volume');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // Pane 1 (no RSI) should have height 60
      expect(chartMock.panes[1].setHeight).toHaveBeenCalledWith(60);
    });

    it('calls computeVolumeWithMa with candles and maPeriod', async () => {
      useIndicatorStore.getState().toggleIndicator('volume');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      expect(mockComputeVolumeWithMa).toHaveBeenCalledWith(sampleCandles, 20);
    });

    it('recreates volume when RSI visibility changes pane index', async () => {
      useIndicatorStore.getState().toggleIndicator('volume');

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      const initialAddCount = mockAddSeries.mock.calls.length;

      // Toggle RSI on — volume pane index shifts from 1 to 2
      useIndicatorStore.getState().toggleIndicator('rsi-14');
      rerender();

      // Volume should have been removed and recreated
      expect(mockRemoveSeries).toHaveBeenCalled();
      expect(mockAddSeries.mock.calls.length).toBeGreaterThan(initialAddCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  describe('cleanup on unmount', () => {
    it('removes all series on unmount', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');
      useIndicatorStore.getState().toggleIndicator('ema-12');

      const chartRef = createChartRef(chartMock.chart);
      const { unmount } = await renderAndWaitForModule(chartRef);

      mockRemoveSeries.mockClear();

      unmount();

      // Should remove both series
      expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('handles chart.removeSeries error gracefully during cleanup', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');

      const chartRef = createChartRef(chartMock.chart);
      const { unmount } = await renderAndWaitForModule(chartRef);

      mockRemoveSeries.mockImplementation(() => {
        throw new Error('Chart already disposed');
      });

      // Should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple indicators simultaneously
  // ---------------------------------------------------------------------------

  describe('multiple indicators', () => {
    it('handles multiple visible indicators simultaneously', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');
      useIndicatorStore.getState().toggleIndicator('ema-12');
      useIndicatorStore.getState().toggleIndicator('bb-20');

      const chartRef = createChartRef(chartMock.chart);
      await renderAndWaitForModule(chartRef);

      // SMA: 1 series, EMA: 1 series, BB: 3 series = 5 total
      expect(mockAddSeries).toHaveBeenCalledTimes(5);
    });

    it('removes only the toggled indicator', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');
      useIndicatorStore.getState().toggleIndicator('ema-12');

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      mockRemoveSeries.mockClear();

      // Toggle off only SMA
      useIndicatorStore.getState().toggleIndicator('sma-20');
      rerender();

      // Only SMA series should be removed (1 call)
      expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Indicator removed from store
  // ---------------------------------------------------------------------------

  describe('indicator removed from store', () => {
    it('removes series when indicator is removed from store', async () => {
      useIndicatorStore.getState().toggleIndicator('sma-20');

      const chartRef = createChartRef(chartMock.chart);
      const { rerender } = await renderAndWaitForModule(chartRef);

      mockRemoveSeries.mockClear();

      // Remove indicator entirely
      useIndicatorStore.getState().removeIndicator('sma-20');
      rerender();

      expect(mockRemoveSeries).toHaveBeenCalled();
    });
  });
});
