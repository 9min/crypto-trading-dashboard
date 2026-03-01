// =============================================================================
// useChartSync Hook
// =============================================================================
// Integrates a chart panel with the ChartSyncHub for crosshair synchronization.
// Registers the panel's chart and series with the hub when the chart is ready,
// and unregisters on cleanup.
//
// The sync hub operates entirely via refs — no React re-renders are triggered
// by crosshair movement, which is critical for 60fps performance.
// =============================================================================

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { ChartSyncHub, ChartLike, SeriesLike } from '@/lib/chart/ChartSyncHub';
import { useMultiChartStore } from '@/stores/multiChartStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseChartSyncParams {
  /** Unique identifier for this panel */
  panelId: string;
  /** Ref to the chart instance (from lightweight-charts) */
  chartRef: MutableRefObject<ChartLike | null>;
  /** Ref to the candlestick series instance */
  seriesRef: MutableRefObject<SeriesLike | null>;
  /** The shared sync hub instance */
  syncHub: ChartSyncHub;
  /** Whether the chart has been initialized and is ready */
  isChartReady: boolean;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useChartSync({
  panelId,
  chartRef,
  seriesRef,
  syncHub,
  isChartReady,
}: UseChartSyncParams): void {
  const crosshairSync = useMultiChartStore((state) => state.crosshairSync);

  useEffect(() => {
    if (!isChartReady || !crosshairSync) {
      // When sync is disabled, ensure the panel is unregistered
      syncHub.unregister(panelId);
      return;
    }

    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    syncHub.register(panelId, chart, series);

    return () => {
      syncHub.unregister(panelId);
    };
  }, [panelId, chartRef, seriesRef, syncHub, isChartReady, crosshairSync]);
}
