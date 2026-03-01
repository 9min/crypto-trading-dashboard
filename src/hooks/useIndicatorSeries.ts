// =============================================================================
// useIndicatorSeries Hook
// =============================================================================
// Manages Lightweight Charts series lifecycle for technical indicators.
// Subscribes to indicatorStore (configs) and klineStore (candles), creating
// or removing chart series as indicators are toggled on/off, and updating
// series data when candles change.
//
// Series pane mapping:
//   - SMA, EMA, Bollinger Bands → pane 0 (overlay on candlestick chart)
//   - RSI → pane 1 (sub-plot, compact 80px)
//   - Volume → pane 2 (sub-plot, compact 60px)
// =============================================================================

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useIndicatorStore } from '@/stores/indicatorStore';
import { useKlineStore } from '@/stores/klineStore';
import type { IndicatorConfig } from '@/types/indicator';
import {
  computeSma,
  computeEma,
  computeBollingerBands,
  computeRsi,
  computeVolumeWithMa,
} from '@/utils/indicators';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Lightweight Charts types inferred from the dynamic import
type LWC = typeof import('lightweight-charts');
type ChartApi = ReturnType<LWC['createChart']>;
type SeriesApi = ReturnType<ChartApi['addSeries']>;

interface UseIndicatorSeriesParams {
  /** Ref to the Lightweight Charts chart instance */
  chartRef: MutableRefObject<ChartApi | null>;
  /** Whether the chart has been initialized and is ready for series */
  isChartReady: boolean;
}

/** Tracks all series instances for a single indicator */
interface SeriesEntry {
  /** Series API instances (1 for line indicators, 3 for BB, 2 for volume) */
  series: SeriesApi[];
  /** Indicator type for cleanup logic */
  type: IndicatorConfig['type'];
  /** Pane index where this series was created (for detecting pane changes) */
  paneIndex?: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Compact pane heights — keep sub-plots minimal to preserve price chart space */
const RSI_PANE_HEIGHT = 80;
const VOLUME_PANE_HEIGHT = 60;

// RSI reference levels (overbought/oversold visual guides)
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT_COLOR = 'rgba(246, 70, 93, 0.25)';
const RSI_OVERSOLD_COLOR = 'rgba(0, 192, 135, 0.25)';
const RSI_MID_COLOR = 'rgba(132, 142, 156, 0.15)';

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useIndicatorSeries({ chartRef, isChartReady }: UseIndicatorSeriesParams): void {
  const seriesMapRef = useRef<Map<string, SeriesEntry>>(new Map());
  const lwcModuleRef = useRef<LWC | null>(null);

  const indicators = useIndicatorStore((state) => state.indicators);
  const candles = useKlineStore((state) => state.candles);

  // Load lightweight-charts module once
  useEffect(() => {
    let disposed = false;
    import('lightweight-charts').then((mod) => {
      if (!disposed) {
        lwcModuleRef.current = mod;
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  // Main effect: sync indicator series with configs and candle data
  useEffect(() => {
    const chart = chartRef.current;
    const lwc = lwcModuleRef.current;
    if (!isChartReady || !chart || !lwc) return;

    const { LineSeries, HistogramSeries } = lwc;
    const seriesMap = seriesMapRef.current;

    // -- Remove series for indicators that are no longer visible or removed --
    for (const [id, entry] of seriesMap) {
      const config = indicators[id];
      if (!config || !config.visible) {
        for (const s of entry.series) {
          try {
            chart.removeSeries(s);
          } catch {
            // Series may already be removed if chart was recreated
          }
        }
        seriesMap.delete(id);
      }
    }

    // When candles are empty (exchange switch, symbol change), remove ALL
    // indicator series rather than just clearing data. Clearing via setData([])
    // can cause LWC to collapse empty panes; when data returns, the series
    // may render on pane 0 instead of pane 1, mixing volume (~0) with price
    // data (~96M KRW) and pulling the Y-axis down to 0.
    if (candles.length === 0) {
      for (const [, entry] of seriesMap) {
        for (const s of entry.series) {
          try {
            chart.removeSeries(s);
          } catch {
            // Series may already be removed if chart was recreated
          }
        }
      }
      seriesMap.clear();
      return;
    }

    // -- Create / update series for visible indicators --
    for (const config of Object.values(indicators)) {
      if (!config.visible) continue;

      const existing = seriesMap.get(config.id);

      switch (config.type) {
        case 'sma': {
          const data = computeSma(candles, config.period);
          if (existing) {
            // @ts-expect-error — Time is a branded type but our data uses plain numbers
            existing.series[0].setData(data);
          } else {
            const series = chart.addSeries(LineSeries, {
              color: config.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            // @ts-expect-error — Time branded type
            series.setData(data);
            seriesMap.set(config.id, { series: [series], type: 'sma' });
          }
          break;
        }

        case 'ema': {
          const data = computeEma(candles, config.period);
          if (existing) {
            // @ts-expect-error — Time branded type
            existing.series[0].setData(data);
          } else {
            const series = chart.addSeries(LineSeries, {
              color: config.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            // @ts-expect-error — Time branded type
            series.setData(data);
            seriesMap.set(config.id, { series: [series], type: 'ema' });
          }
          break;
        }

        case 'bollingerBands': {
          const data = computeBollingerBands(candles, config.period, config.stdDev);
          const upperData = data.map((d) => ({ time: d.time, value: d.upper }));
          const middleData = data.map((d) => ({ time: d.time, value: d.middle }));
          const lowerData = data.map((d) => ({ time: d.time, value: d.lower }));

          if (existing) {
            // @ts-expect-error — Time branded type
            existing.series[0].setData(upperData);
            // @ts-expect-error — Time branded type
            existing.series[1].setData(middleData);
            // @ts-expect-error — Time branded type
            existing.series[2].setData(lowerData);
          } else {
            const upper = chart.addSeries(LineSeries, {
              color: config.upperColor,
              lineWidth: 1,
              lineStyle: 2, // Dashed
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            const middle = chart.addSeries(LineSeries, {
              color: config.middleColor,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            const lower = chart.addSeries(LineSeries, {
              color: config.lowerColor,
              lineWidth: 1,
              lineStyle: 2, // Dashed
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });

            // @ts-expect-error — Time branded type
            upper.setData(upperData);
            // @ts-expect-error — Time branded type
            middle.setData(middleData);
            // @ts-expect-error — Time branded type
            lower.setData(lowerData);

            seriesMap.set(config.id, {
              series: [upper, middle, lower],
              type: 'bollingerBands',
            });
          }
          break;
        }

        case 'rsi': {
          const data = computeRsi(candles, config.period);
          if (existing) {
            // @ts-expect-error — Time branded type
            existing.series[0].setData(data);
          } else {
            const series = chart.addSeries(
              LineSeries,
              {
                color: config.color,
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 3,
                priceScaleId: 'rsi',
                priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(0) },
              },
              1,
            );

            // Configure compact RSI pane
            const rsiPane = chart.panes()[1];
            if (rsiPane) {
              rsiPane.setHeight(RSI_PANE_HEIGHT);
            }

            series.applyOptions({
              autoscaleInfoProvider: () => ({
                priceRange: { minValue: 0, maxValue: 100 },
              }),
            });

            // Add overbought/oversold/midline reference lines
            series.createPriceLine({
              price: RSI_OVERBOUGHT,
              color: RSI_OVERBOUGHT_COLOR,
              lineWidth: 1,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              axisLabelColor: RSI_OVERBOUGHT_COLOR,
            });
            series.createPriceLine({
              price: 50,
              color: RSI_MID_COLOR,
              lineWidth: 1,
              lineStyle: 2, // Dashed
              axisLabelVisible: false,
            });
            series.createPriceLine({
              price: RSI_OVERSOLD,
              color: RSI_OVERSOLD_COLOR,
              lineWidth: 1,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              axisLabelColor: RSI_OVERSOLD_COLOR,
            });

            // @ts-expect-error — Time branded type
            series.setData(data);
            seriesMap.set(config.id, { series: [series], type: 'rsi' });
          }
          break;
        }

        case 'volume': {
          const { volumes, ma } = computeVolumeWithMa(candles, config.maPeriod);
          const rsiVisible = Object.values(indicators).some(
            (ind) => ind.type === 'rsi' && ind.visible,
          );
          const volumePaneIndex = rsiVisible ? 2 : 1;

          // If RSI visibility changed, the volume pane index shifts.
          // Detect stale pane index and force recreation.
          if (existing && existing.paneIndex !== volumePaneIndex) {
            for (const s of existing.series) {
              try {
                chart.removeSeries(s);
              } catch {
                // Series may already be removed
              }
            }
            seriesMap.delete(config.id);
          }

          const current = seriesMap.get(config.id);
          if (current) {
            // @ts-expect-error — Time branded type
            current.series[0].setData(volumes);
            // @ts-expect-error — Time branded type
            current.series[1].setData(ma);
          } else {
            const histogram = chart.addSeries(
              HistogramSeries,
              {
                priceLineVisible: false,
                lastValueVisible: true,
                priceScaleId: 'volume',
                priceFormat: { type: 'volume' },
              },
              volumePaneIndex,
            );

            const maLine = chart.addSeries(
              LineSeries,
              {
                color: config.maColor,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                priceScaleId: 'volume',
              },
              volumePaneIndex,
            );

            // Configure compact volume pane
            const volumePane = chart.panes()[volumePaneIndex];
            if (volumePane) {
              volumePane.setHeight(VOLUME_PANE_HEIGHT);
            }

            // @ts-expect-error — Time branded type
            histogram.setData(volumes);
            // @ts-expect-error — Time branded type
            maLine.setData(ma);

            seriesMap.set(config.id, {
              series: [histogram, maLine],
              type: 'volume',
              paneIndex: volumePaneIndex,
            });
          }
          break;
        }
      }
    }
  }, [indicators, candles, isChartReady, chartRef]);

  // Cleanup all series on unmount
  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    const chart = chartRef.current;
    return () => {
      if (chart) {
        for (const [, entry] of seriesMap) {
          for (const s of entry.series) {
            try {
              chart.removeSeries(s);
            } catch {
              // Chart may already be disposed
            }
          }
        }
      }
      seriesMap.clear();
    };
  }, [chartRef]);
}
