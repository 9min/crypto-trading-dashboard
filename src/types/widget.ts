// =============================================================================
// Widget Type Definitions
// =============================================================================
// Types for configuring, laying out, and managing dashboard widgets.
// =============================================================================

// -----------------------------------------------------------------------------
// Widget Type Constants
// -----------------------------------------------------------------------------

/**
 * All supported widget types in the dashboard.
 * Uses `const` assertion to derive a narrow literal union type.
 */
const WIDGET_TYPES = [
  'candlestick',
  'orderbook',
  'trades',
  'watchlist',
  'premium',
  'depth',
  'perf',
  'portfolio',
  'tradepanel',
  'multichart',
] as const;

/**
 * Union type of all valid widget type identifiers.
 * Derived from the WIDGET_TYPES const assertion.
 */
type WidgetType = (typeof WIDGET_TYPES)[number];

// -----------------------------------------------------------------------------
// Widget Configuration
// -----------------------------------------------------------------------------

/**
 * Configuration for a single dashboard widget.
 * Describes the widget's identity, type, and data-binding properties.
 */
interface WidgetConfig {
  /** Unique identifier for this widget instance */
  i: string;
  /** The type of widget to render */
  type: WidgetType;
  /** Trading symbol this widget is bound to (e.g., "BTCUSDT") */
  symbol: string;
  /** Kline interval for candlestick widgets (e.g., "1m", "1h") */
  interval?: string;
  /** Number of order book depth levels to display */
  depth?: number;
}

// -----------------------------------------------------------------------------
// Layout Types
// -----------------------------------------------------------------------------

/**
 * A widget's position and size within the dashboard grid.
 * Extends WidgetConfig with grid coordinates and dimensions
 * compatible with React Grid Layout.
 */
interface LayoutItem extends WidgetConfig {
  /** Column position (0-indexed from left) */
  x: number;
  /** Row position (0-indexed from top) */
  y: number;
  /** Width in grid units */
  w: number;
  /** Height in grid units */
  h: number;
}

/**
 * Complete dashboard layout state.
 * Contains all widget layout configurations and the currently active symbol.
 */
interface DashboardLayout {
  /** Array of all widgets with their positions and configurations */
  widgets: LayoutItem[];
  /** The currently selected/active trading symbol across the dashboard */
  activeSymbol: string;
}

// -----------------------------------------------------------------------------
// Widget Metadata
// -----------------------------------------------------------------------------

/**
 * Display metadata for each widget type.
 * Used by the WidgetSelector popover and default layout placement.
 */
interface WidgetMeta {
  /** Human-readable label for UI display */
  label: string;
  /** Minimum grid width */
  minW: number;
  /** Minimum grid height */
  minH: number;
  /** Default grid width when adding a widget back */
  defaultW: number;
  /** Default grid height when adding a widget back */
  defaultH: number;
}

const WIDGET_METADATA: Record<WidgetType, WidgetMeta> = {
  candlestick: { label: 'Chart', minW: 4, minH: 8, defaultW: 9, defaultH: 14 },
  orderbook: { label: 'Order Book', minW: 2, minH: 6, defaultW: 3, defaultH: 14 },
  trades: { label: 'Trades', minW: 2, minH: 6, defaultW: 2, defaultH: 10 },
  watchlist: { label: 'Watchlist', minW: 2, minH: 6, defaultW: 3, defaultH: 10 },
  premium: { label: 'Kimchi Premium', minW: 2, minH: 6, defaultW: 2, defaultH: 10 },
  depth: { label: 'Depth Chart', minW: 2, minH: 6, defaultW: 2, defaultH: 10 },
  perf: { label: 'Performance', minW: 2, minH: 6, defaultW: 3, defaultH: 10 },
  portfolio: { label: 'Futures', minW: 3, minH: 8, defaultW: 4, defaultH: 12 },
  tradepanel: { label: 'Trade Panel', minW: 2, minH: 8, defaultW: 3, defaultH: 14 },
  multichart: { label: 'Multi Chart', minW: 6, minH: 10, defaultW: 9, defaultH: 14 },
} as const;

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { WIDGET_TYPES, WIDGET_METADATA };
export type { WidgetType, WidgetConfig, LayoutItem, DashboardLayout, WidgetMeta };
