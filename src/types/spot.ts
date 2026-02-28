// =============================================================================
// KRW Spot Mock Trading Type Definitions
// =============================================================================
// Types for the Upbit KRW spot paper trading feature. Covers holdings, trades,
// PnL calculations, and allocation chart data structures.
// =============================================================================

// -----------------------------------------------------------------------------
// Holding & Trade Types
// -----------------------------------------------------------------------------

/** Trade direction for spot trading */
type SpotTradeAction = 'buy' | 'sell';

/** Active tab in the SpotPortfolioWidget */
type SpotPortfolioTab = 'holdings' | 'history';

/** A single spot holding */
interface SpotHolding {
  /** Trading pair symbol in Binance format (e.g., 'BTCUSDT') */
  symbol: string;
  /** Average entry price in KRW */
  avgEntryPrice: number;
  /** Quantity of the base asset held */
  quantity: number;
  /** Total cost basis: avgEntryPrice * quantity */
  costBasis: number;
  /** Unix timestamp (ms) when the asset was first bought */
  firstBoughtAt: number;
}

/** A single spot trade record */
interface SpotTrade {
  /** Unique identifier: 'spot-{timestamp}-{random6}' */
  id: string;
  /** Trading pair symbol in Binance format */
  symbol: string;
  /** Buy or sell */
  action: SpotTradeAction;
  /** Execution price in KRW */
  price: number;
  /** Quantity traded */
  quantity: number;
  /** Trading fee in KRW */
  fee: number;
  /** Realized PnL (0 for buys, calculated for sells) */
  realizedPnl: number;
  /** Unix timestamp (ms) */
  timestamp: number;
}

// -----------------------------------------------------------------------------
// Enriched Holding (with real-time PnL)
// -----------------------------------------------------------------------------

/** Holding enriched with real-time PnL data */
interface HoldingWithPnl extends SpotHolding {
  /** Current market price in KRW */
  currentPrice: number;
  /** Unrealized profit/loss in KRW */
  unrealizedPnl: number;
  /** PnL as percentage of cost basis */
  pnlPercent: number;
  /** Current market value: currentPrice * quantity */
  marketValue: number;
  /** Allocation percentage of total portfolio value */
  allocationPercent: number;
}

// -----------------------------------------------------------------------------
// Summary Types
// -----------------------------------------------------------------------------

/** Aggregate spot portfolio summary */
interface SpotSummary {
  /** Total portfolio value: walletBalance + totalMarketValue */
  totalValue: number;
  /** KRW cash balance */
  walletBalance: number;
  /** Sum of all holdings' market values */
  totalMarketValue: number;
  /** Sum of all unrealized PnL */
  totalUnrealizedPnl: number;
  /** Total unrealized PnL as percentage of total cost basis */
  totalUnrealizedPnlPercent: number;
  /** Number of distinct holdings */
  holdingCount: number;
}

// -----------------------------------------------------------------------------
// Action Params
// -----------------------------------------------------------------------------

/** Parameters for buying a spot asset */
interface SpotBuyParams {
  symbol: string;
  price: number;
  quantity: number;
}

/** Parameters for selling a spot asset */
interface SpotSellParams {
  symbol: string;
  price: number;
  quantity: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Starting KRW balance for spot paper trading (100M KRW) */
const SPOT_INITIAL_BALANCE = 100_000_000;

/** Spot trading fee rate (0.05%, Upbit standard) */
const SPOT_FEE_RATE = 0.0005;

/** localStorage key for spot portfolio data */
const SPOT_STORAGE_KEY = 'dashboard-spot';

/** Maximum number of trade records to persist */
const SPOT_MAX_TRADE_HISTORY = 500;

/** Maximum number of distinct holdings */
const SPOT_MAX_HOLDINGS = 20;

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  SPOT_INITIAL_BALANCE,
  SPOT_FEE_RATE,
  SPOT_STORAGE_KEY,
  SPOT_MAX_TRADE_HISTORY,
  SPOT_MAX_HOLDINGS,
};
export type {
  SpotTradeAction,
  SpotPortfolioTab,
  SpotHolding,
  SpotTrade,
  HoldingWithPnl,
  SpotSummary,
  SpotBuyParams,
  SpotSellParams,
};
