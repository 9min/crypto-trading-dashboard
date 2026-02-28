// =============================================================================
// Futures Paper Trading Type Definitions
// =============================================================================
// Types for the Futures Paper Trading feature. Covers positions, trades,
// PnL calculations, liquidation, and allocation chart data structures.
// =============================================================================

// -----------------------------------------------------------------------------
// Position & Trade Types
// -----------------------------------------------------------------------------

/** Direction of a futures position */
type PositionSide = 'long' | 'short';

/** Margin mode for a futures position */
type MarginType = 'cross' | 'isolated';

/** Reason a position was closed */
type CloseReason = 'manual' | 'liquidated';

/** A single open futures position */
interface FuturesPosition {
  /** Unique identifier: 'futures-{timestamp}-{random6}' */
  id: string;
  /** Trading pair symbol (e.g., 'BTCUSDT') */
  symbol: string;
  /** Long or short */
  side: PositionSide;
  /** Average entry price */
  entryPrice: number;
  /** Position quantity in base asset */
  quantity: number;
  /** Leverage multiplier (1x ~ 125x) */
  leverage: number;
  /** Margin mode */
  marginType: MarginType;
  /** Deposited margin (collateral) = (entryPrice * quantity) / leverage */
  margin: number;
  /** Price at which the position gets liquidated */
  liquidationPrice: number;
  /** Unix timestamp (ms) when the position was opened */
  openedAt: number;
}

/** A single futures trade record (open or close) */
interface FuturesTrade {
  /** Unique identifier */
  id: string;
  /** Trading pair symbol */
  symbol: string;
  /** Long or short */
  side: PositionSide;
  /** Whether this was an open or close action */
  action: 'open' | 'close';
  /** Execution price */
  price: number;
  /** Quantity traded */
  quantity: number;
  /** Leverage used */
  leverage: number;
  /** Realized PnL (0 for opens, calculated for closes) */
  realizedPnl: number;
  /** Reason for close (null for opens) */
  closeReason: CloseReason | null;
  /** Unix timestamp (ms) */
  timestamp: number;
}

// -----------------------------------------------------------------------------
// Enriched Position (with real-time PnL)
// -----------------------------------------------------------------------------

/** Position enriched with real-time PnL data */
interface PositionWithPnl extends FuturesPosition {
  /** Current market price */
  currentPrice: number;
  /** Unrealized profit/loss */
  unrealizedPnl: number;
  /** Return on equity: unrealizedPnl / margin * 100 */
  roe: number;
  /** PnL as percentage of margin */
  pnlPercent: number;
  /** Margin allocation percentage of total equity */
  allocationPercent: number;
}

// -----------------------------------------------------------------------------
// Summary Types
// -----------------------------------------------------------------------------

/** Aggregate futures account summary */
interface FuturesSummary {
  /** Total equity: walletBalance + totalUnrealizedPnl */
  totalEquity: number;
  /** Wallet balance (cash) */
  walletBalance: number;
  /** Available balance: walletBalance - totalMarginUsed */
  availableBalance: number;
  /** Sum of all position margins */
  totalMarginUsed: number;
  /** Sum of all unrealized PnL */
  totalUnrealizedPnl: number;
  /** Total unrealized PnL as percentage of total margin used */
  totalUnrealizedPnlPercent: number;
  /** Number of open positions */
  positionCount: number;
}

// -----------------------------------------------------------------------------
// Allocation Chart Types
// -----------------------------------------------------------------------------

/** A single slice in the allocation donut chart */
interface AllocationSlice {
  /** Display label (e.g., 'BTC 10x L', 'Cash') */
  label: string;
  /** Absolute value in USDT */
  value: number;
  /** Percentage of total */
  percent: number;
  /** Fill color for the chart slice */
  color: string;
}

// -----------------------------------------------------------------------------
// Store Types
// -----------------------------------------------------------------------------

/** Active tab in the PortfolioWidget */
type PortfolioTab = 'positions' | 'history';

/** Parameters for opening a new position */
interface OpenPositionParams {
  symbol: string;
  side: PositionSide;
  price: number;
  quantity: number;
  leverage: number;
  marginType: MarginType;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Starting wallet balance for paper trading (USDT) */
const INITIAL_CASH_BALANCE = 100_000;

/** Maximum number of trade records to persist */
const MAX_TRADE_HISTORY = 500;

/** localStorage key for futures portfolio data */
const PORTFOLIO_STORAGE_KEY = 'dashboard-futures';

/** Maximum leverage multiplier */
const MAX_LEVERAGE = 125;

/** Default leverage for new positions */
const DEFAULT_LEVERAGE = 10;

/** Default margin type for new positions */
const DEFAULT_MARGIN_TYPE: MarginType = 'isolated';

/** Maximum number of simultaneously open positions */
const MAX_OPEN_POSITIONS = 20;

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  INITIAL_CASH_BALANCE,
  MAX_TRADE_HISTORY,
  PORTFOLIO_STORAGE_KEY,
  MAX_LEVERAGE,
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_TYPE,
  MAX_OPEN_POSITIONS,
};
export type {
  PositionSide,
  MarginType,
  CloseReason,
  FuturesPosition,
  FuturesTrade,
  PositionWithPnl,
  FuturesSummary,
  AllocationSlice,
  PortfolioTab,
  OpenPositionParams,
};
