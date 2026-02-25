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
import { DEFAULT_WATCHLIST_SYMBOLS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const THEME_KEY = 'dashboard-theme';
const INTERVAL_KEY = 'dashboard-interval';
const WATCHLIST_KEY = 'dashboard-watchlist';

const VALID_THEMES = new Set<string>(['dark', 'light']);
const VALID_INTERVALS = new Set<string>(KLINE_INTERVALS);

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
// Exports
// -----------------------------------------------------------------------------

export { THEME_KEY, INTERVAL_KEY, WATCHLIST_KEY };
