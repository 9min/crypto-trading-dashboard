// =============================================================================
// Preferences Service
// =============================================================================
// Supabase CRUD operations for the user_preferences table.
// Pure functions with no React dependency — safe to call from hooks or tests.
// All functions are no-ops when the Supabase client is null.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { KLINE_INTERVALS } from '@/types/chart';
import type { KlineInterval } from '@/types/chart';
import type { Theme } from '@/stores/uiStore';
import type { UserPreferencesRow, UserPreferences } from '@/types/supabase';
import type { ResponsiveLayouts } from 'react-grid-layout';
import { isValidLayoutItem } from '@/utils/layoutStorage';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TABLE_NAME = 'user_preferences';

const VALID_THEMES = new Set<string>(['dark', 'light']);
const VALID_INTERVALS = new Set<string>(KLINE_INTERVALS);

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

/**
 * Validates and parses a raw JSONB layout value into ResponsiveLayouts.
 * Returns null if the value is missing or fails validation.
 */
function parseLayout(raw: unknown): ResponsiveLayouts | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (!Array.isArray(value)) return null;
    if (!value.every(isValidLayoutItem)) return null;
  }

  return raw as ResponsiveLayouts;
}

/**
 * Maps a database row to an app-level UserPreferences object.
 */
function rowToPreferences(row: UserPreferencesRow): UserPreferences {
  return {
    layout: parseLayout(row.layout),
    watchlistSymbols: Array.isArray(row.watchlist_symbols) ? row.watchlist_symbols : [],
    theme: VALID_THEMES.has(row.theme) ? (row.theme as Theme) : 'dark',
    interval: VALID_INTERVALS.has(row.interval) ? (row.interval as KlineInterval) : '1m',
  };
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Fetches a user's preferences from Supabase.
 * Returns null if no row exists or the Supabase client is unavailable.
 * Throws on actual DB/network errors to prevent callers from mistaking
 * a transient failure for a "first login" scenario.
 */
export async function fetchPreferences(userId: string): Promise<UserPreferences | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('id', userId).single();

  if (error) {
    // PGRST116 = "Row not found" from .single() — this is the expected
    // "no preferences yet" case, not an actual error.
    if (error.code === 'PGRST116') return null;

    throw new Error(`[preferencesService] fetchPreferences failed: ${error.message}`);
  }

  if (!data) return null;

  return rowToPreferences(data as UserPreferencesRow);
}

/**
 * Upserts (insert or update) a user's preferences to Supabase.
 * Only sends fields that are provided in the partial update.
 * No-op when the Supabase client is unavailable.
 */
export async function upsertPreferences(
  userId: string,
  prefs: Partial<UserPreferences>,
): Promise<void> {
  if (!supabase) return;

  const row: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
  };

  if (prefs.layout !== undefined) {
    row.layout = prefs.layout;
  }
  if (prefs.watchlistSymbols !== undefined) {
    row.watchlist_symbols = prefs.watchlistSymbols;
  }
  if (prefs.theme !== undefined) {
    row.theme = prefs.theme;
  }
  if (prefs.interval !== undefined) {
    row.interval = prefs.interval;
  }

  const { error } = await supabase.from(TABLE_NAME).upsert(row);

  if (error) {
    console.error('[preferencesService] Failed to upsert preferences', {
      userId,
      timestamp: Date.now(),
      error,
    });
  }
}
