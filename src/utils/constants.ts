export const BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/stream';
export const BINANCE_REST_BASE_URL = 'https://data-api.binance.vision/api/v3';

export const DEFAULT_SYMBOL = 'BTCUSDT';
export const DEFAULT_INTERVAL = '1m';

export const MAX_CANDLES = 2000;
export const MAX_TRADES = 200;
export const MAX_DEPTH_LEVELS = 50;
export const TRADE_FIELDS_PER_ENTRY = 5; // id, price, quantity, time, isBuyerMaker

/** Field index constants for RingBuffer trade entries */
export const TRADE_FIELD_ID = 0;
export const TRADE_FIELD_PRICE = 1;
export const TRADE_FIELD_QUANTITY = 2;
export const TRADE_FIELD_TIME = 3;
export const TRADE_FIELD_IS_BUYER_MAKER = 4;

export const RECONNECT_MAX_DELAY_MS = 30000;
export const RECONNECT_BASE_DELAY_MS = 1000;
export const HEARTBEAT_TIMEOUT_MS = 30000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

/** Upbit WS uses fewer attempts before falling back to REST polling */
export const UPBIT_WS_MAX_RECONNECT_ATTEMPTS = 3;

/** REST polling interval for candles, orderbook, and trades (ms) */
export const REST_POLL_INTERVAL_MS = 3_000;

/** REST polling interval for watchlist tickers (ms) */
export const REST_POLL_TICKER_INTERVAL_MS = 5_000;

export const DEFAULT_WATCHLIST_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
] as const;

export const DEFAULT_UPBIT_WATCHLIST_SYMBOLS = [
  'KRW-BTC',
  'KRW-ETH',
  'KRW-BNB',
  'KRW-SOL',
  'KRW-XRP',
  'KRW-DOGE',
  'KRW-ADA',
  'KRW-AVAX',
] as const;

export const MAX_WATCHLIST_SYMBOLS = 20;

export const COLORS = {
  BUY: '#00C087',
  SELL: '#F6465D',
  CONNECTED: '#00C087',
  RECONNECTING: '#F0B90B',
  DISCONNECTED: '#F6465D',
} as const;

export const INDICATOR_COLORS = {
  SMA_20: '#e6a817',
  SMA_50: '#8b5cf6',
  EMA_12: '#06b6d4',
  EMA_26: '#ec4899',
  BB_UPPER: '#6366f1',
  BB_MIDDLE: '#a5b4fc',
  BB_LOWER: '#6366f1',
  RSI: '#f59e0b',
  VOLUME_MA: '#8b5cf6',
  VOLUME_UP: 'rgba(0, 192, 135, 0.5)',
  VOLUME_DOWN: 'rgba(246, 70, 93, 0.5)',
} as const;
