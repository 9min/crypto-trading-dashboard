// =============================================================================
// Local Preferences Utility
// =============================================================================
// Persists and restores user preferences (theme, interval, watchlist symbols)
// to/from localStorage. Used for non-authenticated users and as an offline
// fallback for authenticated users. Handles errors gracefully — returns
// defaults on any failure.
// =============================================================================

import type { KlineInterval } from '@/types/chart';
import { KLINE_INTERVALS } from '@/types/chart';
import type { Theme } from '@/stores/uiStore';
import type { ExchangeId } from '@/types/exchange';
import { EXCHANGE_IDS } from '@/types/exchange';
import { DEFAULT_WATCHLIST_SYMBOLS, DEFAULT_WHALE_THRESHOLD } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const THEME_KEY = 'dashboard-theme';
const INTERVAL_KEY = 'dashboard-interval';
const WATCHLIST_KEY = 'dashboard-watchlist';
const EXCHANGE_KEY = 'dashboard-exchange';
const MOBILE_TAB_KEY = 'dashboard-mobile-tab';
const WHALE_THRESHOLD_KEY = 'dashboard-whale-threshold';

/** Mobile tab identifiers for the bottom tab bar */
export type MobileTab = 'chart' | 'book' | 'trades' | 'more';
const MOBILE_TABS: readonly MobileTab[] = ['chart', 'book', 'trades', 'more'] as const;

const VALID_THEMES = new Set<string>(['dark', 'light']);
const VALID_INTERVALS = new Set<string>(KLINE_INTERVALS);
const VALID_EXCHANGES = new Set<string>(EXCHANGE_IDS);
const VALID_MOBILE_TABS = new Set<string>(MOBILE_TABS);

// -----------------------------------------------------------------------------
// Theme
// -----------------------------------------------------------------------------

/** Saves the theme preference to localStorage. */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error('[localPreferences] Failed to save theme', {
      timestamp: Date.now(),
      error,
    });
  }
}

/** Loads the theme preference from localStorage. Defaults to `'dark'`. */
export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw && VALID_THEMES.has(raw)) return raw as Theme;
  } catch (error) {
    console.error('[localPreferences] Failed to load theme', {
      timestamp: Date.now(),
      error,
    });
  }
  return 'dark';
}

// -----------------------------------------------------------------------------
// Interval
// -----------------------------------------------------------------------------

/** Saves the kline interval preference to localStorage. */
export function saveInterval(interval: KlineInterval): void {
  try {
    localStorage.setItem(INTERVAL_KEY, interval);
  } catch (error) {
    console.error('[localPreferences] Failed to save interval', {
      timestamp: Date.now(),
      error,
    });
  }
}

/** Loads the kline interval preference from localStorage. Defaults to `'1m'`. */
export function loadInterval(): KlineInterval {
  try {
    const raw = localStorage.getItem(INTERVAL_KEY);
    if (raw && VALID_INTERVALS.has(raw)) return raw as KlineInterval;
  } catch (error) {
    console.error('[localPreferences] Failed to load interval', {
      timestamp: Date.now(),
      error,
    });
  }
  return '1m';
}

// -----------------------------------------------------------------------------
// Watchlist Symbols
// -----------------------------------------------------------------------------

/** Saves the watchlist symbol list to localStorage. */
export function saveWatchlistSymbols(symbols: string[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols));
  } catch (error) {
    console.error('[localPreferences] Failed to save watchlist symbols', {
      timestamp: Date.now(),
      error,
    });
  }
}

/** Loads the watchlist symbol list from localStorage. Defaults to `DEFAULT_WATCHLIST_SYMBOLS`. */
export function loadWatchlistSymbols(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [...DEFAULT_WATCHLIST_SYMBOLS];

    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed as string[];
    }
  } catch (error) {
    console.error('[localPreferences] Failed to load watchlist symbols', {
      timestamp: Date.now(),
      error,
    });
  }
  return [...DEFAULT_WATCHLIST_SYMBOLS];
}

// -----------------------------------------------------------------------------
// Exchange
// -----------------------------------------------------------------------------

/** Saves the exchange preference to localStorage. */
export function saveExchange(exchange: ExchangeId): void {
  try {
    localStorage.setItem(EXCHANGE_KEY, exchange);
  } catch (error) {
    console.error('[localPreferences] Failed to save exchange', {
      timestamp: Date.now(),
      error,
    });
  }
}

/** Loads the exchange preference from localStorage. Defaults to `'binance'`. */
export function loadExchange(): ExchangeId {
  try {
    if (typeof window === 'undefined') return 'binance';
    const raw = localStorage.getItem(EXCHANGE_KEY);
    if (raw && VALID_EXCHANGES.has(raw)) return raw as ExchangeId;
  } catch (error) {
    console.error('[localPreferences] Failed to load exchange', {
      timestamp: Date.now(),
      error,
    });
  }
  return 'binance';
}

// -----------------------------------------------------------------------------
// Mobile Tab
// -----------------------------------------------------------------------------

/** Saves the active mobile tab to localStorage. */
export function saveMobileTab(tab: MobileTab): void {
  try {
    localStorage.setItem(MOBILE_TAB_KEY, tab);
  } catch (error) {
    console.error('[localPreferences] Failed to save mobile tab', {
      timestamp: Date.now(),
      error,
    });
  }
}

/** Loads the active mobile tab from localStorage. Defaults to `'chart'`. */
export function loadMobileTab(): MobileTab {
  try {
    if (typeof window === 'undefined') return 'chart';
    const raw = localStorage.getItem(MOBILE_TAB_KEY);
    if (raw && VALID_MOBILE_TABS.has(raw)) return raw as MobileTab;
  } catch (error) {
    console.error('[localPreferences] Failed to load mobile tab', {
      timestamp: Date.now(),
      error,
    });
  }
  return 'chart';
}

// -----------------------------------------------------------------------------
// Whale Threshold
// -----------------------------------------------------------------------------

/** Saves the whale trade threshold to localStorage. */
export function saveWhaleThreshold(threshold: number): void {
  try {
    localStorage.setItem(WHALE_THRESHOLD_KEY, String(threshold));
  } catch (error) {
    console.error('[localPreferences] Failed to save whale threshold', {
      timestamp: Date.now(),
      error,
    });
  }
}

/** Loads the whale trade threshold from localStorage. Defaults to `DEFAULT_WHALE_THRESHOLD`. */
export function loadWhaleThreshold(): number {
  try {
    if (typeof window === 'undefined') return DEFAULT_WHALE_THRESHOLD;
    const raw = localStorage.getItem(WHALE_THRESHOLD_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch (error) {
    console.error('[localPreferences] Failed to load whale threshold', {
      timestamp: Date.now(),
      error,
    });
  }
  return DEFAULT_WHALE_THRESHOLD;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  THEME_KEY,
  INTERVAL_KEY,
  WATCHLIST_KEY,
  EXCHANGE_KEY,
  MOBILE_TAB_KEY,
  WHALE_THRESHOLD_KEY,
};
