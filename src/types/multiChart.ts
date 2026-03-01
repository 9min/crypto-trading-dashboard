// =============================================================================
// Multi-Chart Type Definitions
// =============================================================================
// Types for the multi-chart comparison widget, supporting 2-4 independent
// chart panels with optional crosshair and interval synchronization.
// =============================================================================

import type { KlineInterval } from './chart';

// -----------------------------------------------------------------------------
// Layout Types
// -----------------------------------------------------------------------------

/**
 * Supported multi-chart grid layouts.
 * - '2x1': Two charts side by side (2 columns, 1 row)
 * - '1x2': Two charts stacked vertically (1 column, 2 rows)
 * - '2x2': Four charts in a 2x2 grid
 */
type MultiChartLayout = '2x1' | '1x2' | '2x2';

const MULTI_CHART_LAYOUTS = ['2x1', '1x2', '2x2'] as const;

// -----------------------------------------------------------------------------
// Panel Configuration
// -----------------------------------------------------------------------------

/**
 * Configuration for a single chart panel within the multi-chart widget.
 */
interface ChartPanelConfig {
  /** Unique panel identifier */
  id: string;
  /** Trading pair symbol (e.g., "BTCUSDT") */
  symbol: string;
  /** Kline interval for this panel */
  interval: KlineInterval;
}

// -----------------------------------------------------------------------------
// Store State
// -----------------------------------------------------------------------------

interface MultiChartState {
  /** Current grid layout mode */
  layout: MultiChartLayout;
  /** Panel configurations (2 or 4 panels) */
  panels: ChartPanelConfig[];
  /** Whether crosshair movement is synchronized across panels */
  crosshairSync: boolean;
  /** Whether interval changes are synchronized across all panels */
  intervalSync: boolean;
}

interface MultiChartActions {
  /** Change the grid layout. Adjusts panel count automatically. */
  setLayout: (layout: MultiChartLayout) => void;
  /** Change the symbol for a specific panel */
  setPanelSymbol: (panelId: string, symbol: string) => void;
  /** Change the interval for a specific panel (or all panels if intervalSync is on) */
  setPanelInterval: (panelId: string, interval: KlineInterval) => void;
  /** Toggle crosshair synchronization on/off */
  toggleCrosshairSync: () => void;
  /** Toggle interval synchronization on/off */
  toggleIntervalSync: () => void;
  /** Reset store to default state */
  reset: () => void;
}

type MultiChartStore = MultiChartState & MultiChartActions;

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { MULTI_CHART_LAYOUTS };
export type {
  MultiChartLayout,
  ChartPanelConfig,
  MultiChartState,
  MultiChartActions,
  MultiChartStore,
};
