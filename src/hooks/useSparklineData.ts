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
import { fetchUpbitCandles } from '@/lib/upbit/restClient';
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

// -----------------------------------------------------------------------------
// Upbit Request Stagger
// -----------------------------------------------------------------------------
// Upbit public API rate-limits at ~10 req/s. When 7+ sparkline requests fire
// simultaneously on exchange switch, many get HTTP 429. This slot-based
// stagger ensures each request waits for its turn (200ms apart).

/** Timestamp (ms) of the next available request slot */
let nextUpbitSlot = 0;

/** Minimum gap between consecutive Upbit sparkline requests */
const UPBIT_STAGGER_MS = 200;

/**
 * Returns a delay (ms) the caller should wait before making an Upbit request.
 * Each call advances the next slot, so concurrent callers get sequential slots.
 */
function acquireUpbitSlot(): number {
  const now = Date.now();
  if (nextUpbitSlot <= now) {
    nextUpbitSlot = now + UPBIT_STAGGER_MS;
    return 0;
  }
  const delay = nextUpbitSlot - now;
  nextUpbitSlot += UPBIT_STAGGER_MS;
  return delay;
}

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
 * Uses fetchUpbitCandles (with retry + exponential backoff) to handle
 * rate limiting when multiple sparkline requests fire simultaneously.
 */
async function fetchUpbitSparkline(symbol: string): Promise<number[]> {
  const candles = await fetchUpbitCandles(symbol, '1h', SPARKLINE_CANDLE_COUNT);
  return candles.map((c) => c.close);
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

        let result: number[];
        if (exchange === 'binance') {
          result = await fetchBinanceSparkline(symbol);
        } else {
          // Skip fetch if symbol has no Upbit mapping (e.g., BNB)
          const upbitMarket = toUpbitSymbol(symbol);
          if (!upbitMarket.startsWith('KRW-')) return;

          // Stagger Upbit requests to stay under rate limit (~10 req/s)
          const staggerDelay = acquireUpbitSlot();
          if (staggerDelay > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, staggerDelay));
            if (controller.signal.aborted) return;
          }

          result = await fetchUpbitSparkline(upbitMarket);
        }

        if (controller.signal.aborted) return;

        setCachedData(cacheKey, result);
        setData(result);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[useSparklineData] Failed to fetch sparkline', {
          symbol,
          exchange,
          timestamp: Date.now(),
          errorMessage,
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
