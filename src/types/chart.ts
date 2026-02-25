// =============================================================================
// Chart & Trading Data Type Definitions
// =============================================================================
// Types for candlestick data, order book structures, trade entries,
// and WebSocket connection state management.
// =============================================================================

// -----------------------------------------------------------------------------
// Kline Interval Constants
// -----------------------------------------------------------------------------

/**
 * All supported kline (candlestick) time intervals.
 * Uses `const` assertion to derive a narrow literal union type.
 */
const KLINE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

/**
 * Union type of all valid kline interval identifiers.
 * Derived from the KLINE_INTERVALS const assertion.
 */
type KlineInterval = (typeof KLINE_INTERVALS)[number];

// -----------------------------------------------------------------------------
// Candlestick Data
// -----------------------------------------------------------------------------

/**
 * A single candlestick (OHLCV) data point used by the charting library.
 * All price and volume values are pre-parsed to numbers for rendering performance.
 */
interface CandleData {
  /** Candle open time as a Unix timestamp in seconds (for TradingView Lightweight Charts) */
  time: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Trading volume in base asset */
  volume: number;
}

// -----------------------------------------------------------------------------
// Order Book Types
// -----------------------------------------------------------------------------

/**
 * A single price level in the order book.
 * Pre-parsed to numbers from Binance string format for rendering performance.
 */
interface PriceLevel {
  /** Price at this level */
  price: number;
  /** Aggregate quantity at this price */
  quantity: number;
}

/**
 * Identifies which side of the order book: buy orders (bids) or sell orders (asks).
 */
type OrderBookSide = 'bids' | 'asks';

// -----------------------------------------------------------------------------
// Trade Entry
// -----------------------------------------------------------------------------

/**
 * A single executed trade entry displayed in the trades feed.
 * Pre-parsed to numbers from Binance string format for rendering performance.
 */
interface TradeEntry {
  /** Unique trade ID from the exchange */
  id: number;
  /** Execution price */
  price: number;
  /** Traded quantity in base asset */
  quantity: number;
  /** Trade execution time in milliseconds */
  time: number;
  /** Whether the buyer is the market maker (true = sell aggressor, false = buy aggressor) */
  isBuyerMaker: boolean;
}

// -----------------------------------------------------------------------------
// Connection State (Discriminated Union)
// -----------------------------------------------------------------------------

/**
 * WebSocket connection state modeled as a discriminated union.
 * The `status` field serves as the discriminant for exhaustive type narrowing.
 *
 * State transitions:
 *   idle -> connecting -> connected
 *   connected -> reconnecting -> connected
 *   reconnecting -> failed
 *   failed -> connecting (manual retry)
 */
type ConnectionState =
  | { /** No connection has been initiated */ status: 'idle' }
  | { /** Attempting initial connection */ status: 'connecting' }
  | {
      /** Successfully connected */ status: 'connected';
      /** Timestamp when connection was established (ms) */ connectedAt: number;
    }
  | {
      /** Connection lost, attempting automatic reconnection */ status: 'reconnecting';
      /** Current reconnection attempt number (1-based) */ attempt: number;
    }
  | {
      /** All reconnection attempts exhausted or fatal error */ status: 'failed';
      /** Human-readable error description */ error: string;
    };

// -----------------------------------------------------------------------------
// Watchlist Ticker
// -----------------------------------------------------------------------------

/**
 * Real-time ticker data for a single watchlist symbol.
 * Populated initially via REST API and updated via WebSocket miniTicker stream.
 */
interface WatchlistTicker {
  /** Trading pair symbol (e.g., "BTCUSDT") */
  symbol: string;
  /** Current price (close price from miniTicker) */
  price: number;
  /** 24-hour price change percentage */
  priceChangePercent: number;
  /** 24-hour quote asset volume */
  volume: number;
  /** Timestamp of the last update (ms) */
  lastUpdateTime: number;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { KLINE_INTERVALS };
export type {
  KlineInterval,
  CandleData,
  PriceLevel,
  OrderBookSide,
  TradeEntry,
  ConnectionState,
  WatchlistTicker,
};
