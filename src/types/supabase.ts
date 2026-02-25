// =============================================================================
// Supabase Type Definitions
// =============================================================================
// Types for the user_preferences table and the parsed app-level preferences.
// =============================================================================

import type { ResponsiveLayouts } from 'react-grid-layout';
import type { KlineInterval } from '@/types/chart';
import type { Theme } from '@/stores/uiStore';

// -----------------------------------------------------------------------------
// Database Row Type
// -----------------------------------------------------------------------------

/** Raw row shape from the `user_preferences` table. */
interface UserPreferencesRow {
  /** Supabase user ID (UUID) — primary key */
  id: string;
  /** Dashboard grid layout stored as JSONB (null if never saved) */
  layout: unknown | null;
  /** Ordered list of watchlist trading pair symbols */
  watchlist_symbols: string[];
  /** Color theme preference */
  theme: string;
  /** Kline (candlestick) time interval */
  interval: string;
  /** ISO 8601 timestamp of last update */
  updated_at: string;
}

// -----------------------------------------------------------------------------
// App-Level Preferences Type
// -----------------------------------------------------------------------------

/** Parsed and validated user preferences for app consumption. */
interface UserPreferences {
  /** Dashboard grid layout (null if never saved) */
  layout: ResponsiveLayouts | null;
  /** Ordered list of watchlist symbols */
  watchlistSymbols: string[];
  /** Color theme */
  theme: Theme;
  /** Kline interval */
  interval: KlineInterval;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { UserPreferencesRow, UserPreferences };
