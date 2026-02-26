// =============================================================================
// Binance API Type Definitions
// =============================================================================
// Comprehensive TypeScript types for Binance WebSocket and REST API responses.
// All types strictly reflect the official Binance API documentation.
// =============================================================================

// -----------------------------------------------------------------------------
// WebSocket Stream Types
// -----------------------------------------------------------------------------

/**
 * Wrapper for Binance Combined Stream messages.
 * All messages received from the combined stream endpoint
 * (`wss://stream.binance.com:9443/stream?streams=...`) are wrapped in this format.
 */
interface BinanceCombinedStreamMessage<T> {
  /** The stream name (e.g., "btcusdt@kline_1m") */
  stream: string;
  /** The actual event data payload */
  data: T;
}

/**
 * Kline (candlestick) data nested inside BinanceKlineEvent.
 * Contains OHLCV data and metadata for a single kline bar.
 */
interface BinanceKlineData {
  /** Kline start time (ms) */
  t: number;
  /** Kline close time (ms) */
  T: number;
  /** Symbol (e.g., "BTCUSDT") */
  s: string;
  /** Interval (e.g., "1m", "5m", "1h") */
  i: string;
  /** First trade ID */
  f: number;
  /** Last trade ID */
  L: number;
  /** Open price */
  o: string;
  /** Close price */
  c: string;
  /** High price */
  h: string;
  /** Low price */
  l: string;
  /** Base asset volume */
  v: string;
  /** Number of trades */
  n: number;
  /** Is this kline closed? */
  x: boolean;
  /** Quote asset volume */
  q: string;
  /** Taker buy base asset volume */
  V: string;
  /** Taker buy quote asset volume */
  Q: string;
}

/**
 * Binance Kline/Candlestick WebSocket event.
 * Received from the `<symbol>@kline_<interval>` stream.
 */
interface BinanceKlineEvent {
  /** Event type — always "kline" */
  e: 'kline';
  /** Event time (ms) */
  E: number;
  /** Symbol (e.g., "BTCUSDT") */
  s: string;
  /** Kline data object */
  k: BinanceKlineData;
}

/** A single depth level represented as a [price, quantity] string tuple. */
type DepthLevel = [price: string, quantity: string];

/**
 * Binance Depth Update WebSocket event.
 * Received from the `<symbol>@depth` or `<symbol>@depth@100ms` stream.
 */
interface BinanceDepthEvent {
  /** Event type — always "depthUpdate" */
  e: 'depthUpdate';
  /** Event time (ms) */
  E: number;
  /** Symbol (e.g., "BTCUSDT") */
  s: string;
  /** First update ID in event */
  U: number;
  /** Final update ID in event */
  u: number;
  /** Bids to be updated — array of [price, quantity] string tuples */
  b: DepthLevel[];
  /** Asks to be updated — array of [price, quantity] string tuples */
  a: DepthLevel[];
}

/**
 * Binance Individual Trade WebSocket event.
 * Received from the `<symbol>@trade` stream.
 */
interface BinanceTradeEvent {
  /** Event type — always "trade" */
  e: 'trade';
  /** Event time (ms) */
  E: number;
  /** Symbol (e.g., "BTCUSDT") */
  s: string;
  /** Trade ID */
  t: number;
  /** Price */
  p: string;
  /** Quantity */
  q: string;
  /** Trade time (ms) */
  T: number;
  /** Is the buyer the market maker? */
  m: boolean;
  /** Buyer order ID */
  b: number;
  /** Seller order ID */
  a: number;
}

/**
 * Binance 24hr Mini Ticker WebSocket event.
 * Received from the `<symbol>@miniTicker` or `!miniTicker@arr` stream.
 */
interface BinanceMiniTickerEvent {
  /** Event type — always "24hrMiniTicker" */
  e: '24hrMiniTicker';
  /** Event time (ms) */
  E: number;
  /** Symbol (e.g., "BTCUSDT") */
  s: string;
  /** Close price */
  c: string;
  /** Open price */
  o: string;
  /** High price */
  h: string;
  /** Low price */
  l: string;
  /** Total traded base asset volume */
  v: string;
  /** Total traded quote asset volume */
  q: string;
}

/**
 * Discriminated union of all Binance WebSocket stream event types.
 * The `e` field serves as the discriminant for type narrowing.
 */
type WebSocketStreamMessage =
  | BinanceKlineEvent
  | BinanceDepthEvent
  | BinanceTradeEvent
  | BinanceMiniTickerEvent;

// -----------------------------------------------------------------------------
// REST API Types
// -----------------------------------------------------------------------------

/**
 * A single kline entry from the Binance REST API `/api/v3/klines` endpoint.
 * Returned as a fixed-length tuple of 12 elements.
 *
 * Index mapping:
 *  0: Open time (number)
 *  1: Open (string)
 *  2: High (string)
 *  3: Low (string)
 *  4: Close (string)
 *  5: Volume (string)
 *  6: Close time (number)
 *  7: Quote asset volume (string)
 *  8: Number of trades (number)
 *  9: Taker buy base asset volume (string)
 * 10: Taker buy quote asset volume (string)
 * 11: Unused/ignore (string)
 */
type BinanceKlineRaw = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  closeTime: number,
  quoteAssetVolume: string,
  numberOfTrades: number,
  takerBuyBaseAssetVolume: string,
  takerBuyQuoteAssetVolume: string,
  unused: string,
];

/**
 * Binance REST API Depth Snapshot response from `/api/v3/depth`.
 * Used to initialize the local order book before applying WebSocket diff updates.
 */
interface BinanceDepthSnapshot {
  /** Last update ID — used to synchronize with WebSocket depth events */
  lastUpdateId: number;
  /** Bid levels, each as a [price, quantity] string tuple, sorted descending by price */
  bids: DepthLevel[];
  /** Ask levels, each as a [price, quantity] string tuple, sorted ascending by price */
  asks: DepthLevel[];
}

/**
 * Symbol filter from Binance Exchange Info.
 * Each filter has a `filterType` discriminant and varying additional fields.
 */
interface BinanceSymbolFilter {
  /** Filter type identifier (e.g., "PRICE_FILTER", "LOT_SIZE") */
  filterType: string;
  /** Minimum price (PRICE_FILTER) */
  minPrice?: string;
  /** Maximum price (PRICE_FILTER) */
  maxPrice?: string;
  /** Price tick size (PRICE_FILTER) */
  tickSize?: string;
  /** Minimum quantity (LOT_SIZE) */
  minQty?: string;
  /** Maximum quantity (LOT_SIZE) */
  maxQty?: string;
  /** Quantity step size (LOT_SIZE) */
  stepSize?: string;
  /** Minimum notional value (NOTIONAL / MIN_NOTIONAL) */
  minNotional?: string;
}

/**
 * Information about a single trading symbol from the Binance Exchange Info endpoint.
 */
interface BinanceSymbolInfo {
  /** Symbol name (e.g., "BTCUSDT") */
  symbol: string;
  /** Trading status (e.g., "TRADING") */
  status: string;
  /** Base asset (e.g., "BTC") */
  baseAsset: string;
  /** Precision for base asset quantities */
  baseAssetPrecision: number;
  /** Quote asset (e.g., "USDT") */
  quoteAsset: string;
  /** Precision for quote asset quantities */
  quotePrecision: number;
  /** Precision for quote asset in orders */
  quoteAssetPrecision: number;
  /** Allowed order types (e.g., ["LIMIT", "MARKET"]) */
  orderTypes: string[];
  /** Whether iceberg orders are allowed */
  icebergAllowed: boolean;
  /** Whether OCO orders are allowed */
  ocoAllowed: boolean;
  /** Whether spot trading is allowed */
  isSpotTradingAllowed: boolean;
  /** Whether margin trading is allowed */
  isMarginTradingAllowed: boolean;
  /** Array of symbol-level filters */
  filters: BinanceSymbolFilter[];
  /** Allowed permissions (e.g., ["SPOT", "MARGIN"]) */
  permissions: string[];
}

/**
 * Binance REST API Exchange Info response from `/api/v3/exchangeInfo`.
 * Contains server metadata and information about all available trading symbols.
 */
interface BinanceExchangeInfo {
  /** Server timezone (e.g., "UTC") */
  timezone: string;
  /** Server time (ms) */
  serverTime: number;
  /** Array of rate limit rules */
  rateLimits: BinanceRateLimit[];
  /** Array of all trading symbol information */
  symbols: BinanceSymbolInfo[];
}

/**
 * Rate limit information from the Exchange Info response.
 */
interface BinanceRateLimit {
  /** Rate limit type (e.g., "REQUEST_WEIGHT", "ORDERS") */
  rateLimitType: string;
  /** Time interval (e.g., "MINUTE", "SECOND") */
  interval: string;
  /** Interval number */
  intervalNum: number;
  /** Rate limit value */
  limit: number;
}

/**
 * Response from the Binance REST API `GET /api/v3/ticker/24hr` endpoint.
 * Contains 24-hour price change statistics for a trading pair.
 */
interface Binance24hrTickerResponse {
  /** Symbol name (e.g., "BTCUSDT") */
  symbol: string;
  /** Last traded price */
  lastPrice: string;
  /** Price change percentage over the last 24 hours */
  priceChangePercent: string;
  /** Total traded quote asset volume over the last 24 hours */
  quoteVolume: string;
  /** Highest price over the last 24 hours */
  highPrice: string;
  /** Lowest price over the last 24 hours */
  lowPrice: string;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

/**
 * Binance REST API `/api/v3/ticker/price` single-symbol response.
 * Returns the latest price for the requested symbol.
 */
interface BinanceTickerPriceResponse {
  /** Symbol name (e.g., "BTCUSDT") */
  symbol: string;
  /** Current price as string */
  price: string;
}

export type {
  BinanceCombinedStreamMessage,
  BinanceKlineData,
  BinanceKlineEvent,
  DepthLevel,
  BinanceDepthEvent,
  BinanceTradeEvent,
  BinanceMiniTickerEvent,
  WebSocketStreamMessage,
  BinanceKlineRaw,
  BinanceDepthSnapshot,
  BinanceSymbolFilter,
  BinanceSymbolInfo,
  BinanceExchangeInfo,
  BinanceRateLimit,
  Binance24hrTickerResponse,
  BinanceTickerPriceResponse,
};
