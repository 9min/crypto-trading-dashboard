// =============================================================================
// Binance REST API Client
// =============================================================================
// Typed fetch wrappers for Binance public REST API endpoints.
// All functions include exponential backoff retry for transient failures.
// =============================================================================

import { BINANCE_REST_BASE_URL } from '@/utils/constants';
import type { BinanceKlineRaw, BinanceDepthSnapshot, BinanceExchangeInfo } from '@/types/binance';
import type { CandleData } from '@/types/chart';

// -----------------------------------------------------------------------------
// Generic Fetch with Retry
// -----------------------------------------------------------------------------

/**
 * Fetches a URL with exponential backoff retry.
 * Retries up to `maxRetries` times on failure, with delays of 1s, 2s, 4s, etc.
 *
 * @throws The last error encountered after all retries are exhausted.
 */
async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  // TypeScript requires a return/throw after the loop even though it's unreachable
  throw new Error('Unreachable: all retry attempts should have returned or thrown');
}

// -----------------------------------------------------------------------------
// Klines (Candlestick Data)
// -----------------------------------------------------------------------------

/**
 * Fetches historical kline (candlestick) data from the Binance REST API
 * and transforms it into the CandleData format used by TradingView Lightweight Charts.
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param interval - Kline interval (e.g., "1m", "5m", "1h")
 * @param limit - Maximum number of klines to fetch (default: 500, max: 1000)
 * @returns Array of CandleData sorted by time ascending
 */
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 500,
): Promise<CandleData[]> {
  const url = `${BINANCE_REST_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const raw = await fetchWithRetry<BinanceKlineRaw[]>(url);

  return raw.map((k) => ({
    time: k[0] / 1000, // Convert milliseconds to seconds for TradingView
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// -----------------------------------------------------------------------------
// Depth Snapshot (Order Book)
// -----------------------------------------------------------------------------

/**
 * Fetches an order book depth snapshot from the Binance REST API.
 * Used to initialize the local order book before applying WebSocket diff updates.
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param limit - Number of price levels per side (default: 1000)
 * @returns BinanceDepthSnapshot containing bids, asks, and lastUpdateId
 */
export async function fetchDepthSnapshot(
  symbol: string,
  limit = 1000,
): Promise<BinanceDepthSnapshot> {
  const url = `${BINANCE_REST_BASE_URL}/depth?symbol=${symbol}&limit=${limit}`;
  return fetchWithRetry<BinanceDepthSnapshot>(url);
}

// -----------------------------------------------------------------------------
// Exchange Info
// -----------------------------------------------------------------------------

/**
 * Fetches exchange information including all available trading symbols,
 * their filters, and precision settings.
 *
 * @returns BinanceExchangeInfo containing symbol metadata and rate limits
 */
export async function fetchExchangeInfo(): Promise<BinanceExchangeInfo> {
  const url = `${BINANCE_REST_BASE_URL}/exchangeInfo`;
  return fetchWithRetry<BinanceExchangeInfo>(url);
}
