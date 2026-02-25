// =============================================================================
// useSparklineData Hook
// =============================================================================
// Fetches 24-hour hourly candle data for sparkline visualization.
// Supports both Binance and Upbit with exchange-aware API calls.
// Includes a stale-while-revalidate cache (5-minute TTL).
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import type { ExchangeId } from '@/types/exchange';
import { EXCHANGES } from '@/types/exchange';
import { toUpbitSymbol } from '@/utils/symbolMap';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SparklineCache {
  data: number[];
  timestamp: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Cache time-to-live in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Number of hourly candles to fetch for 24-hour sparkline */
const SPARKLINE_CANDLE_COUNT = 24;

// -----------------------------------------------------------------------------
// Module-level cache
// -----------------------------------------------------------------------------

const sparklineCache = new Map<string, SparklineCache>();

/**
 * Returns cached data if still valid, otherwise null.
 */
function getCachedData(cacheKey: string): number[] | null {
  const cached = sparklineCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
  return cached.data;
}

/**
 * Stores data in the cache with the current timestamp.
 */
function setCachedData(cacheKey: string, data: number[]): void {
  sparklineCache.set(cacheKey, { data, timestamp: Date.now() });
}

// -----------------------------------------------------------------------------
// Fetch Functions
// -----------------------------------------------------------------------------

/**
 * Fetches 24 hourly close prices from Binance klines API.
 */
async function fetchBinanceSparkline(symbol: string): Promise<number[]> {
  const baseUrl = EXCHANGES.binance.restBaseUrl;
  const params = new URLSearchParams({
    symbol,
    interval: '1h',
    limit: String(SPARKLINE_CANDLE_COUNT),
  });
  const url = `${baseUrl}/klines?${params}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const raw = (await response.json()) as unknown[][];
  // Binance kline array: [0]=openTime, [4]=closePrice, ...
  return raw.map((kline) => parseFloat(kline[4] as string));
}

/**
 * Fetches 24 hourly close prices from Upbit candles API.
 */
async function fetchUpbitSparkline(symbol: string): Promise<number[]> {
  const baseUrl = EXCHANGES.upbit.restBaseUrl;
  const params = new URLSearchParams({
    market: symbol,
    count: String(SPARKLINE_CANDLE_COUNT),
  });
  const url = `${baseUrl}/candles/minutes/60?${params}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const raw = (await response.json()) as Array<{ trade_price: number }>;
  // Upbit returns newest-first; reverse for time-ascending order
  return raw.map((candle) => candle.trade_price).reverse();
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Fetches and caches 24-hour sparkline data for a symbol.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT" or "KRW-BTC")
 * @param exchange - Exchange identifier
 * @returns Array of close prices (24 points, hourly), empty while loading
 */
export function useSparklineData(symbol: string, exchange: ExchangeId): number[] {
  const [data, setData] = useState<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const cacheKey = `${exchange}:${symbol}`;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async (): Promise<void> => {
      try {
        // Check cache first (inside async function to avoid sync setState in effect)
        const cached = getCachedData(cacheKey);
        if (cached) {
          if (!controller.signal.aborted) setData(cached);
          return;
        }

        const result =
          exchange === 'binance'
            ? await fetchBinanceSparkline(symbol)
            : await fetchUpbitSparkline(toUpbitSymbol(symbol));

        if (controller.signal.aborted) return;

        setCachedData(cacheKey, result);
        setData(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[useSparklineData] Failed to fetch sparkline', {
          symbol,
          exchange,
          timestamp: Date.now(),
          error,
        });
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [symbol, exchange]);

  return data;
}

// -----------------------------------------------------------------------------
// Exports (for testing)
// -----------------------------------------------------------------------------

export { sparklineCache, CACHE_TTL_MS, SPARKLINE_CANDLE_COUNT };
