// =============================================================================
// Symbol Mapping Utility
// =============================================================================
// Converts symbols between Binance format (e.g., "BTCUSDT") and Upbit format
// (e.g., "KRW-BTC"). Only maps watchlist default symbols — not the entire
// exchange catalog.
// =============================================================================

// -----------------------------------------------------------------------------
// Bidirectional Mapping Tables
// -----------------------------------------------------------------------------

/**
 * Maps Binance symbols to Upbit market codes.
 * Only covers the default watchlist symbols.
 */
const BINANCE_TO_UPBIT_MAP: ReadonlyMap<string, string> = new Map([
  ['BTCUSDT', 'KRW-BTC'],
  ['ETHUSDT', 'KRW-ETH'],
  ['BNBUSDT', 'KRW-BNB'],
  ['SOLUSDT', 'KRW-SOL'],
  ['XRPUSDT', 'KRW-XRP'],
  ['DOGEUSDT', 'KRW-DOGE'],
  ['ADAUSDT', 'KRW-ADA'],
  ['AVAXUSDT', 'KRW-AVAX'],
]);

/**
 * Reverse mapping: Upbit market codes to Binance symbols.
 * Built automatically from BINANCE_TO_UPBIT_MAP for consistency.
 */
const UPBIT_TO_BINANCE_MAP: ReadonlyMap<string, string> = new Map(
  [...BINANCE_TO_UPBIT_MAP.entries()].map(([binance, upbit]) => [upbit, binance]),
);

// -----------------------------------------------------------------------------
// Conversion Functions
// -----------------------------------------------------------------------------

/**
 * Converts a Binance symbol to an Upbit market code.
 * Returns the original symbol if no mapping exists.
 *
 * @example
 * toBinanceSymbol('KRW-BTC')  // => 'BTCUSDT'
 * toBinanceSymbol('KRW-UNKNOWN') // => 'KRW-UNKNOWN'
 */
export function toBinanceSymbol(upbitSymbol: string): string {
  return UPBIT_TO_BINANCE_MAP.get(upbitSymbol) ?? upbitSymbol;
}

/**
 * Converts a Binance symbol to an Upbit market code.
 * Returns the original symbol if no mapping exists.
 *
 * @example
 * toUpbitSymbol('BTCUSDT')   // => 'KRW-BTC'
 * toUpbitSymbol('UNKNOWN')   // => 'UNKNOWN'
 */
export function toUpbitSymbol(binanceSymbol: string): string {
  return BINANCE_TO_UPBIT_MAP.get(binanceSymbol) ?? binanceSymbol;
}

/**
 * Returns the Binance symbols that have Upbit mappings.
 * Useful for determining which watchlist symbols are available on both exchanges.
 */
export function getMappedBinanceSymbols(): string[] {
  return [...BINANCE_TO_UPBIT_MAP.keys()];
}

/**
 * Returns the Upbit symbols that have Binance mappings.
 */
export function getMappedUpbitSymbols(): string[] {
  return [...UPBIT_TO_BINANCE_MAP.keys()];
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { BINANCE_TO_UPBIT_MAP, UPBIT_TO_BINANCE_MAP };
