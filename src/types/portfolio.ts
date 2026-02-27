// =============================================================================
// Portfolio Type Definitions
// =============================================================================
// Types for the Paper Trading / Mock Portfolio feature. Covers trades,
// holdings, PnL calculations, and allocation chart data structures.
// =============================================================================

// -----------------------------------------------------------------------------
// Trade Types
// -----------------------------------------------------------------------------

/** Direction of a portfolio trade */
type TradeSide = 'buy' | 'sell';

/** A single executed trade in the mock portfolio */
interface PortfolioTrade {
  /** Unique identifier: 'portfolio-{timestamp}-{random6}' */
  id: string;
  /** Trading pair symbol (e.g., 'BTCUSDT') */
  symbol: string;
  /** Buy or sell */
  side: TradeSide;
  /** Execution price */
  price: number;
  /** Quantity of the base asset */
  quantity: number;
  /** Total notional value: price * quantity */
  notional: number;
  /** Unix timestamp (ms) of the trade */
  timestamp: number;
}

// -----------------------------------------------------------------------------
// Holding Types
// -----------------------------------------------------------------------------

/** A single holding (position) in the portfolio */
interface PortfolioHolding {
  /** Trading pair symbol (e.g., 'BTCUSDT') */
  symbol: string;
  /** Current quantity held */
  quantity: number;
  /** Volume-weighted average entry price */
  avgEntryPrice: number;
  /** Total cost basis (sum of all buy notionals minus proportional sell reductions) */
  costBasis: number;
}

/** Holding enriched with real-time PnL data */
interface HoldingWithPnl extends PortfolioHolding {
  /** Current market price from watchlist ticker */
  currentPrice: number;
  /** Current market value: currentPrice * quantity */
  marketValue: number;
  /** Unrealized profit/loss: marketValue - costBasis */
  unrealizedPnl: number;
  /** Unrealized PnL as a percentage of cost basis */
  unrealizedPnlPercent: number;
  /** Allocation percentage of total portfolio value */
  allocationPercent: number;
}

// -----------------------------------------------------------------------------
// Summary Types
// -----------------------------------------------------------------------------

/** Aggregate portfolio summary */
interface PortfolioSummary {
  /** Total portfolio value: sum of all holdings' market value + cash */
  totalValue: number;
  /** Total unrealized PnL across all holdings */
  totalUnrealizedPnl: number;
  /** Total unrealized PnL as a percentage of total cost basis */
  totalUnrealizedPnlPercent: number;
  /** Number of distinct holdings */
  holdingCount: number;
}

// -----------------------------------------------------------------------------
// Allocation Chart Types
// -----------------------------------------------------------------------------

/** A single slice in the allocation donut chart */
interface AllocationSlice {
  /** Display label (e.g., 'BTC', 'ETH', 'Cash') */
  label: string;
  /** Absolute value in USDT */
  value: number;
  /** Percentage of total portfolio */
  percent: number;
  /** Fill color for the chart slice */
  color: string;
}

// -----------------------------------------------------------------------------
// Store Types
// -----------------------------------------------------------------------------

/** Active tab in the PortfolioWidget */
type PortfolioTab = 'holdings' | 'history';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Starting cash balance for paper trading (USDT) */
const INITIAL_CASH_BALANCE = 100_000;

/** Maximum number of trade records to persist */
const MAX_TRADE_HISTORY = 500;

/** localStorage key for portfolio data */
const PORTFOLIO_STORAGE_KEY = 'dashboard-portfolio';

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { INITIAL_CASH_BALANCE, MAX_TRADE_HISTORY, PORTFOLIO_STORAGE_KEY };
export type {
  TradeSide,
  PortfolioTrade,
  PortfolioHolding,
  HoldingWithPnl,
  PortfolioSummary,
  AllocationSlice,
  PortfolioTab,
};
