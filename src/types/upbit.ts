// =============================================================================
// Upbit API Type Definitions
// =============================================================================
// TypeScript types for Upbit WebSocket and REST API responses.
// All types strictly reflect the official Upbit API documentation.
// =============================================================================

// -----------------------------------------------------------------------------
// WebSocket Event Types
// -----------------------------------------------------------------------------

/**
 * Upbit WebSocket ticker event.
 * Received from the `ticker` subscription type.
 */
interface UpbitTickerEvent {
  /** Event type — always "ticker" */
  type: 'ticker';
  /** Market code (e.g., "KRW-BTC") */
  code: string;
  /** Current trade price */
  trade_price: number;
  /** Opening price (00:00 UTC) */
  opening_price: number;
  /** High price */
  high_price: number;
  /** Low price */
  low_price: number;
  /** Previous closing price */
  prev_closing_price: number;
  /** Signed change rate (-1 to 1) */
  signed_change_rate: number;
  /** Signed change price */
  signed_change_price: number;
  /** Accumulated trade volume (24h) */
  acc_trade_volume_24h: number;
  /** Accumulated trade price (24h, in quote currency) */
  acc_trade_price_24h: number;
  /** Trade timestamp (ms) */
  trade_timestamp: number;
  /** Change type: RISE, EVEN, FALL */
  change: 'RISE' | 'EVEN' | 'FALL';
}

/**
 * Upbit WebSocket trade event.
 * Received from the `trade` subscription type.
 */
interface UpbitTradeEvent {
  /** Event type — always "trade" */
  type: 'trade';
  /** Market code (e.g., "KRW-BTC") */
  code: string;
  /** Trade price */
  trade_price: number;
  /** Trade volume */
  trade_volume: number;
  /** Ask/bid type: ASK (sell) or BID (buy) */
  ask_bid: 'ASK' | 'BID';
  /** Trade timestamp (ms) */
  trade_timestamp: number;
  /** Sequential ID for the trade */
  sequential_id: number;
}

/**
 * A single order book unit from the Upbit orderbook event.
 */
interface UpbitOrderBookUnit {
  /** Ask (sell) price */
  ask_price: number;
  /** Bid (buy) price */
  bid_price: number;
  /** Ask quantity */
  ask_size: number;
  /** Bid quantity */
  bid_size: number;
}

/**
 * Upbit WebSocket orderbook event.
 * Received from the `orderbook` subscription type.
 */
interface UpbitOrderBookEvent {
  /** Event type — always "orderbook" */
  type: 'orderbook';
  /** Market code (e.g., "KRW-BTC") */
  code: string;
  /** Total ask (sell) volume */
  total_ask_size: number;
  /** Total bid (buy) volume */
  total_bid_size: number;
  /** Order book units (15 levels) */
  orderbook_units: UpbitOrderBookUnit[];
  /** Timestamp (ms) */
  timestamp: number;
}

/**
 * Discriminated union of all Upbit WebSocket event types.
 * The `type` field serves as the discriminant for type narrowing.
 */
type UpbitWebSocketMessage = UpbitTickerEvent | UpbitTradeEvent | UpbitOrderBookEvent;

// -----------------------------------------------------------------------------
// WebSocket Subscription Types
// -----------------------------------------------------------------------------

/**
 * Upbit WebSocket subscription ticket.
 * Used to identify a subscription session.
 */
interface UpbitSubscriptionTicket {
  ticket: string;
}

/**
 * Upbit WebSocket subscription type definition.
 * Specifies which event types and market codes to subscribe to.
 */
interface UpbitSubscriptionType {
  type: 'ticker' | 'trade' | 'orderbook';
  codes: string[];
  /** When true, only sends changes (not full snapshots) */
  isOnlyRealtime?: boolean;
}

/**
 * Complete Upbit WebSocket subscription message.
 * Sent as a JSON array: [ticket, ...types]
 */
type UpbitSubscription = [UpbitSubscriptionTicket, ...UpbitSubscriptionType[]];

// -----------------------------------------------------------------------------
// REST API Types
// -----------------------------------------------------------------------------

/**
 * Upbit REST API candle response (minutes/days).
 * From `/v1/candles/minutes/{unit}` or `/v1/candles/days`.
 */
interface UpbitKlineCandle {
  /** Market code (e.g., "KRW-BTC") */
  market: string;
  /** Candle date/time in UTC (e.g., "2024-01-01T00:00:00") */
  candle_date_time_utc: string;
  /** Opening price */
  opening_price: number;
  /** High price */
  high_price: number;
  /** Low price */
  low_price: number;
  /** Closing/trade price */
  trade_price: number;
  /** Candle timestamp (ms) */
  timestamp: number;
  /** Accumulated trade price (in quote currency) */
  candle_acc_trade_price: number;
  /** Accumulated trade volume */
  candle_acc_trade_volume: number;
}

/**
 * Upbit REST API orderbook response.
 * From `/v1/orderbook`.
 */
interface UpbitOrderBookResponse {
  /** Market code (e.g., "KRW-BTC") */
  market: string;
  /** Orderbook units (15 levels) */
  orderbook_units: UpbitOrderBookUnit[];
  /** Total ask volume */
  total_ask_size: number;
  /** Total bid volume */
  total_bid_size: number;
  /** Timestamp (ms) */
  timestamp: number;
}

/**
 * Upbit REST API recent trades (ticks) response.
 * From `/v1/trades/ticks`.
 */
interface UpbitTradeTickResponse {
  /** Market code (e.g., "KRW-BTC") */
  market: string;
  /** Trade date (UTC, e.g., "2024-01-15") */
  trade_date_utc: string;
  /** Trade time (UTC, e.g., "12:00:00") */
  trade_time_utc: string;
  /** Trade timestamp (ms) */
  timestamp: number;
  /** Trade price */
  trade_price: number;
  /** Trade volume */
  trade_volume: number;
  /** Previous closing price */
  prev_closing_price: number;
  /** Absolute change price */
  change_price: number;
  /** Ask/bid type: ASK (sell) or BID (buy) */
  ask_bid: 'ASK' | 'BID';
  /** Sequential ID for deduplication */
  sequential_id: number;
}

/**
 * Upbit REST API ticker response.
 * From `/v1/ticker`.
 */
interface UpbitTickerResponse {
  /** Market code (e.g., "KRW-BTC") */
  market: string;
  /** Current trade price */
  trade_price: number;
  /** Opening price */
  opening_price: number;
  /** High price */
  high_price: number;
  /** Low price */
  low_price: number;
  /** Previous closing price */
  prev_closing_price: number;
  /** Signed change rate */
  signed_change_rate: number;
  /** Accumulated trade volume (24h) */
  acc_trade_volume_24h: number;
  /** Accumulated trade price (24h) */
  acc_trade_price_24h: number;
  /** Trade timestamp (ms) */
  trade_timestamp: number;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type {
  UpbitTickerEvent,
  UpbitTradeEvent,
  UpbitOrderBookUnit,
  UpbitOrderBookEvent,
  UpbitWebSocketMessage,
  UpbitSubscriptionTicket,
  UpbitSubscriptionType,
  UpbitSubscription,
  UpbitKlineCandle,
  UpbitOrderBookResponse,
  UpbitTradeTickResponse,
  UpbitTickerResponse,
};
