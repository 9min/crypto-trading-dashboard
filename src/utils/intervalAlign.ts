// =============================================================================
// Interval Alignment Utility
// =============================================================================
// Aligns a millisecond timestamp to the start of its containing candle period.
// Used to construct live candles from individual trade events when the exchange
// (e.g., Upbit) does not provide a dedicated kline WebSocket stream.
// =============================================================================

import type { KlineInterval } from '@/types/chart';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Millisecond duration for each supported kline interval. */
const INTERVAL_MS: Record<KlineInterval, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Aligns a millisecond timestamp to the start of its containing candle period.
 *
 * @param timestampMs - Trade timestamp in milliseconds (e.g., Date.now())
 * @param interval - Kline interval (e.g., "1m", "5m", "1h")
 * @returns Candle open time as a Unix timestamp in **seconds**
 *          (matching TradingView Lightweight Charts convention)
 *
 * @example
 * // 2024-01-15 12:03:45.000 UTC aligned to 1m → 2024-01-15 12:03:00.000 UTC
 * alignToIntervalSec(1705320225000, '1m') // → 1705320180
 */
export function alignToIntervalSec(timestampMs: number, interval: KlineInterval): number {
  const ms = INTERVAL_MS[interval];
  return (Math.floor(timestampMs / ms) * ms) / 1000;
}

export { INTERVAL_MS };
