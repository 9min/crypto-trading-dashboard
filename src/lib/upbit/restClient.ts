// =============================================================================
// Upbit REST API Client
// =============================================================================
// Typed fetch wrappers for Upbit public REST API endpoints.
// All functions include exponential backoff retry for transient failures.
// =============================================================================

import { EXCHANGES } from '@/types/exchange';
import type { UpbitKlineCandle, UpbitOrderBookResponse, UpbitTickerResponse } from '@/types/upbit';
import type { CandleData } from '@/types/chart';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const UPBIT_REST_BASE_URL = EXCHANGES.upbit.restBaseUrl;

// -----------------------------------------------------------------------------
// Interval Mapping
// -----------------------------------------------------------------------------

/**
 * Maps kline interval strings to Upbit REST API candle endpoint paths.
 */
const INTERVAL_TO_ENDPOINT: ReadonlyMap<string, string> = new Map([
  ['1m', '/candles/minutes/1'],
  ['5m', '/candles/minutes/5'],
  ['15m', '/candles/minutes/15'],
  ['1h', '/candles/minutes/60'],
  ['4h', '/candles/minutes/240'],
  ['1d', '/candles/days'],
]);

/**
 * Returns the Upbit REST API candle endpoint path for the given interval.
 */
export function getUpbitCandleEndpoint(interval: string): string {
  return INTERVAL_TO_ENDPOINT.get(interval) ?? '/candles/minutes/1';
}

// -----------------------------------------------------------------------------
// Generic Fetch with Retry
// -----------------------------------------------------------------------------

async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        // 429 (Too Many Requests) is retryable — Upbit rate limits concurrent requests
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`HTTP ${response.status}: Client error (not retryable)`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not retryable')) {
        throw error;
      }
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('Unreachable: all retry attempts should have returned or thrown');
}

// -----------------------------------------------------------------------------
// Candles (Candlestick Data)
// -----------------------------------------------------------------------------

/**
 * Fetches historical candle data from the Upbit REST API
 * and transforms it into the CandleData format used by TradingView.
 *
 * @param market - Upbit market code (e.g., "KRW-BTC")
 * @param interval - Kline interval (e.g., "1m", "1h", "1d")
 * @param count - Number of candles to fetch (default: 200, max: 200)
 * @param to - Optional last candle time (exclusive) in ISO 8601 format
 *             (e.g., "2024-01-15T12:00:00Z"). Fetches candles before this time.
 * @returns Array of CandleData sorted by time ascending
 */
export async function fetchUpbitCandles(
  market: string,
  interval: string,
  count = 200,
  to?: string,
): Promise<CandleData[]> {
  const endpoint = getUpbitCandleEndpoint(interval);
  const params = new URLSearchParams({
    market,
    count: String(Math.min(count, 200)),
  });
  if (to !== undefined) {
    params.set('to', to);
  }
  const url = `${UPBIT_REST_BASE_URL}${endpoint}?${params}`;
  const raw = await fetchWithRetry<UpbitKlineCandle[]>(url);

  // Upbit returns newest-first; reverse to get time-ascending order.
  // candle_date_time_utc lacks a Z suffix (e.g., "2026-02-26T10:00:00"),
  // so Date() would parse it as local time. Appending 'Z' forces UTC.
  return raw
    .map((candle) => ({
      time: Math.floor(new Date(candle.candle_date_time_utc + 'Z').getTime() / 1000),
      open: candle.opening_price,
      high: candle.high_price,
      low: candle.low_price,
      close: candle.trade_price,
      volume: candle.candle_acc_trade_volume,
    }))
    .reverse();
}

// -----------------------------------------------------------------------------
// Order Book
// -----------------------------------------------------------------------------

/**
 * Fetches an order book snapshot from the Upbit REST API.
 *
 * @param market - Upbit market code (e.g., "KRW-BTC")
 * @returns UpbitOrderBookResponse
 */
export async function fetchUpbitOrderBook(market: string): Promise<UpbitOrderBookResponse> {
  const params = new URLSearchParams({ markets: market });
  const url = `${UPBIT_REST_BASE_URL}/orderbook?${params}`;
  const raw = await fetchWithRetry<UpbitOrderBookResponse[]>(url);

  if (raw.length === 0) {
    throw new Error(`No orderbook data for ${market}`);
  }
  return raw[0];
}

// -----------------------------------------------------------------------------
// Ticker
// -----------------------------------------------------------------------------

/**
 * Fetches 24hr ticker data for the given markets.
 *
 * @param markets - Array of Upbit market codes (e.g., ["KRW-BTC", "KRW-ETH"])
 * @returns Array of UpbitTickerResponse
 */
export async function fetchUpbitTickers(markets: string[]): Promise<UpbitTickerResponse[]> {
  if (markets.length === 0) return [];

  const params = new URLSearchParams({ markets: markets.join(',') });
  const url = `${UPBIT_REST_BASE_URL}/ticker?${params}`;
  return fetchWithRetry<UpbitTickerResponse[]>(url);
}
