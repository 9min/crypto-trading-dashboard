// =============================================================================
// Symbol Search Utility
// =============================================================================
// Provides a list of popular USDT trading pairs and a filter function for
// searching symbols in the watchlist management popover.
// Supports exchange-aware filtering: Upbit results are limited to symbols
// that have a BINANCE_TO_UPBIT_MAP mapping.
// =============================================================================

import type { ExchangeId } from '@/types/exchange';
import { BINANCE_TO_UPBIT_MAP } from '@/utils/symbolMap';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Popular USDT trading pairs on Binance, sorted by typical market cap / volume.
 * Used as the searchable pool for the watchlist add UI.
 */
export const POPULAR_USDT_SYMBOLS: readonly string[] = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'MATICUSDT',
  'LINKUSDT',
  'UNIUSDT',
  'SHIBUSDT',
  'LTCUSDT',
  'ATOMUSDT',
  'NEARUSDT',
  'BCHUSDT',
  'APTUSDT',
  'FILUSDT',
  'ARBUSDT',
  'OPUSDT',
  'MKRUSDT',
  'AAVEUSDT',
  'ALGOUSDT',
  'XLMUSDT',
  'VETUSDT',
  'ICPUSDT',
  'HBARUSDT',
  'FTMUSDT',
  'SANDUSDT',
  'MANAUSDT',
  'AXSUSDT',
  'THETAUSDT',
  'EGLDUSDT',
  'EOSUSDT',
  'FLOWUSDT',
  'XTZUSDT',
  'NEOUSDT',
  'CHZUSDT',
  'GALAUSDT',
  'APEUSDT',
  'GMTUSDT',
  'CRVUSDT',
  'SNXUSDT',
  'LRCUSDT',
  'ENJUSDT',
  'COMPUSDT',
  'DYDXUSDT',
  'SUIUSDT',
  'SEIUSDT',
] as const;

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

const MAX_RESULTS = 20;

/**
 * Filters the popular symbols list by a case-insensitive query,
 * excluding any symbols already in the exclude list.
 * When exchange is 'upbit', only symbols with a BINANCE_TO_UPBIT_MAP mapping
 * are included, and the query matches against both Binance and Upbit formats.
 *
 * @param query - Search string (e.g., "DOT" or "BTC")
 * @param exclude - Symbols already in the watchlist (always in Binance format)
 * @param exchange - Current exchange; filters to mapped symbols for Upbit
 * @returns Filtered symbols in Binance format, max 20 results
 */
export function filterSymbols(
  query: string,
  exclude: string[],
  exchange: ExchangeId = 'binance',
): string[] {
  const upperQuery = query.toUpperCase().trim();
  const excludeSet = new Set(exclude);

  const results: string[] = [];

  for (const symbol of POPULAR_USDT_SYMBOLS) {
    if (excludeSet.has(symbol)) continue;

    // On Upbit, skip symbols that don't have a KRW mapping
    if (exchange === 'upbit' && !BINANCE_TO_UPBIT_MAP.has(symbol)) continue;

    // Match query against Binance symbol (e.g., "BTCUSDT") and,
    // for Upbit, also against the Upbit market code (e.g., "KRW-BTC")
    if (upperQuery) {
      const matchesBinance = symbol.includes(upperQuery);
      const upbitSymbol = BINANCE_TO_UPBIT_MAP.get(symbol);
      const matchesUpbit = upbitSymbol ? upbitSymbol.toUpperCase().includes(upperQuery) : false;
      if (!matchesBinance && !matchesUpbit) continue;
    }

    results.push(symbol);
    if (results.length >= MAX_RESULTS) break;
  }

  return results;
}
