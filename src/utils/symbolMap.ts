// =============================================================================
// Symbol Mapping Utility
// =============================================================================
// Converts symbols between Binance format (e.g., "BTCUSDT") and Upbit format
// (e.g., "KRW-BTC"). Covers popular KRW-listed coins on Upbit that also
// trade as USDT pairs on Binance.
// =============================================================================

// -----------------------------------------------------------------------------
// Bidirectional Mapping Tables
// -----------------------------------------------------------------------------

/**
 * Maps Binance symbols to Upbit KRW market codes.
 * Covers popular coins listed on both exchanges.
 * BNB, UNI, MKR, COMP, DYDX etc. are excluded (not on Upbit KRW market).
 */
const BINANCE_TO_UPBIT_MAP: ReadonlyMap<string, string> = new Map([
  // --- Default watchlist ---
  ['BTCUSDT', 'KRW-BTC'],
  ['ETHUSDT', 'KRW-ETH'],
  ['SOLUSDT', 'KRW-SOL'],
  ['XRPUSDT', 'KRW-XRP'],
  ['DOGEUSDT', 'KRW-DOGE'],
  ['ADAUSDT', 'KRW-ADA'],
  ['AVAXUSDT', 'KRW-AVAX'],
  // --- Popular alts verified on Upbit KRW market (2026-02) ---
  ['DOTUSDT', 'KRW-DOT'],
  ['LINKUSDT', 'KRW-LINK'],
  ['SHIBUSDT', 'KRW-SHIB'],
  ['ATOMUSDT', 'KRW-ATOM'],
  ['NEARUSDT', 'KRW-NEAR'],
  ['BCHUSDT', 'KRW-BCH'],
  ['APTUSDT', 'KRW-APT'],
  ['ARBUSDT', 'KRW-ARB'],
  ['XLMUSDT', 'KRW-XLM'],
  ['VETUSDT', 'KRW-VET'],
  ['HBARUSDT', 'KRW-HBAR'],
  ['SANDUSDT', 'KRW-SAND'],
  ['AXSUSDT', 'KRW-AXS'],
  ['THETAUSDT', 'KRW-THETA'],
  ['FLOWUSDT', 'KRW-FLOW'],
  ['XTZUSDT', 'KRW-XTZ'],
  ['NEOUSDT', 'KRW-NEO'],
  ['CHZUSDT', 'KRW-CHZ'],
  ['GMTUSDT', 'KRW-GMT'],
  ['SUIUSDT', 'KRW-SUI'],
  ['SEIUSDT', 'KRW-SEI'],
  ['AAVEUSDT', 'KRW-AAVE'],
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
