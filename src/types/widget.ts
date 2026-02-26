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
// Exports
// -----------------------------------------------------------------------------

export { WIDGET_TYPES };
export type { WidgetType, WidgetConfig, LayoutItem, DashboardLayout };
