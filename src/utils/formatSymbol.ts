// =============================================================================
// Symbol Formatting Utility
// =============================================================================
// Converts Binance symbol identifiers (e.g., "BTCUSDT") into human-readable
// trading pair format (e.g., "BTC/USDT").
// =============================================================================

/**
 * Known quote assets in order of matching priority.
 * Longer quote assets are listed first to avoid partial matches
 * (e.g., "USDT" before "BTC" to prevent matching "BTC" in "BTCUSDT").
 */
const QUOTE_ASSETS = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB'] as const;

/**
 * Formats a Binance symbol identifier into a human-readable trading pair.
 *
 * @example
 * formatSymbol('BTCUSDT')   // => 'BTC/USDT'
 * formatSymbol('ETHBTC')    // => 'ETH/BTC'
 * formatSymbol('DOGEUSDT')  // => 'DOGE/USDT'
 * formatSymbol('UNKNOWN')   // => 'UNKNOWN' (no match — returns original)
 */
export function formatSymbol(symbol: string): string {
  for (const quote of QUOTE_ASSETS) {
    if (symbol.endsWith(quote) && symbol.length > quote.length) {
      const base = symbol.slice(0, -quote.length);
      return `${base}/${quote}`;
    }
  }
  return symbol;
}
