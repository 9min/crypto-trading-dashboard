// =============================================================================
// Binance WebSocket Stream URL Builders
// =============================================================================
// Utility functions for constructing Binance Combined Stream WebSocket URLs.
// All stream names follow the Binance WebSocket API specification.
// =============================================================================

import { BINANCE_WS_BASE_URL } from '@/utils/constants';

/**
 * Builds a combined stream WebSocket URL from an array of stream names.
 *
 * @example
 * buildStreamUrl(['btcusdt@kline_1m', 'btcusdt@depth@100ms'])
 * // => 'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms'
 */
export function buildStreamUrl(streams: string[]): string {
  if (streams.length === 0) {
    throw new Error('buildStreamUrl: streams must not be empty');
  }
  return `${BINANCE_WS_BASE_URL}?streams=${streams.join('/')}`;
}

/**
 * Returns the kline (candlestick) stream name for a given symbol and interval.
 *
 * @example getKlineStream('BTCUSDT', '1m') // => 'btcusdt@kline_1m'
 */
export function getKlineStream(symbol: string, interval: string): string {
  return `${symbol.toLowerCase()}@kline_${interval}`;
}

/**
 * Returns the depth (order book diff) stream name for a given symbol.
 * Uses 100ms update frequency for real-time order book rendering.
 *
 * @example getDepthStream('BTCUSDT') // => 'btcusdt@depth@100ms'
 */
export function getDepthStream(symbol: string): string {
  return `${symbol.toLowerCase()}@depth@100ms`;
}

/**
 * Returns the individual trade stream name for a given symbol.
 *
 * @example getTradeStream('BTCUSDT') // => 'btcusdt@trade'
 */
export function getTradeStream(symbol: string): string {
  return `${symbol.toLowerCase()}@trade`;
}

/**
 * Returns the 24hr mini ticker stream name for a given symbol.
 *
 * @example getMiniTickerStream('BTCUSDT') // => 'btcusdt@miniTicker'
 */
export function getMiniTickerStream(symbol: string): string {
  return `${symbol.toLowerCase()}@miniTicker`;
}

/**
 * Builds a combined stream URL that includes kline, depth, trade, and
 * mini ticker streams for a single symbol. This is the primary URL used
 * by the dashboard.
 *
 * @example
 * buildCombinedStreamUrl('BTCUSDT', '1m')
 * // => 'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms/btcusdt@trade/btcusdt@miniTicker'
 */
export function buildCombinedStreamUrl(symbol: string, interval: string): string {
  const streams = [
    getKlineStream(symbol, interval),
    getDepthStream(symbol),
    getTradeStream(symbol),
    getMiniTickerStream(symbol),
  ];
  return buildStreamUrl(streams);
}
