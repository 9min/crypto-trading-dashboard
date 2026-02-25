// =============================================================================
// usePreferencesSync Hook
// =============================================================================
// Synchronizes user preferences between the app state, localStorage, and
// Supabase cloud storage. On login, loads cloud preferences and applies them.
// On state changes, saves to both localStorage and Supabase (debounced).
// On logout, stops cloud sync and reverts to localStorage-only mode.
// =============================================================================

'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useToastStore } from '@/stores/toastStore';
import { fetchPreferences, upsertPreferences } from '@/lib/supabase/preferencesService';
import {
  saveTheme,
  loadTheme,
  saveInterval,
  loadInterval,
  saveWatchlistSymbols,
  loadWatchlistSymbols,
} from '@/utils/localPreferences';
import { loadLayout, saveLayout } from '@/utils/layoutStorage';
import type { UserPreferences } from '@/types/supabase';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEBOUNCE_MS = 500;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Replaces the watchlist store's symbols with the given list.
 * Uses add/remove to work with the existing store API.
 */
function replaceWatchlistSymbols(nextSymbols: string[]): void {
  const store = useWatchlistStore.getState();
  const current = store.symbols;

  // Remove symbols not in the new list
  for (const s of current) {
    if (!nextSymbols.includes(s)) {
      store.removeSymbol(s);
    }
  }
  // Add symbols not yet present
  for (const s of nextSymbols) {
    store.addSymbol(s);
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePreferencesSync(): void {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Debounced cloud save helper (defined before effects that use it)
  // ---------------------------------------------------------------------------
  const debouncedCloudSaveRef = useRef((partial: Partial<UserPreferences>): void => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await upsertPreferences(user.id, partial);
        } catch {
          useToastStore.getState().addToast('Failed to save preferences to cloud', 'warning');
        }
      })();
    }, DEBOUNCE_MS);
  });

  // ---------------------------------------------------------------------------
  // 1. Load local preferences on mount (once)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const theme = loadTheme();
    const interval = loadInterval();
    const watchlistSymbols = loadWatchlistSymbols();

    useUiStore.getState().setTheme(theme);
    useKlineStore.getState().setInterval(interval);
    replaceWatchlistSymbols(watchlistSymbols);

    isInitialLoadRef.current = false;
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Load cloud preferences on login
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state, prevState) => {
      const user = state.user;
      const prevUser = prevState.user;

      // Only trigger on login (null → non-null)
      if (!user || prevUser) return;

      void (async () => {
        const prefs = await fetchPreferences(user.id);

        if (prefs) {
          // Apply cloud preferences to app state
          useUiStore.getState().setTheme(prefs.theme);
          useKlineStore.getState().setInterval(prefs.interval);
          replaceWatchlistSymbols(prefs.watchlistSymbols);

          // Apply layout if available
          if (prefs.layout) {
            saveLayout(prefs.layout);
          }

          // Also update localStorage as offline backup
          saveTheme(prefs.theme);
          saveInterval(prefs.interval);
          saveWatchlistSymbols(prefs.watchlistSymbols);
        } else {
          // First login: migrate current localStorage values to Supabase
          const currentTheme = useUiStore.getState().theme;
          const currentInterval = useKlineStore.getState().interval;
          const currentSymbols = useWatchlistStore.getState().symbols;
          const currentLayout = loadLayout();

          await upsertPreferences(user.id, {
            theme: currentTheme,
            interval: currentInterval,
            watchlistSymbols: currentSymbols,
            layout: currentLayout,
          });
        }
      })();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 3. Save preferences on change (debounced, to both localStorage and cloud)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const debouncedCloudSave = debouncedCloudSaveRef.current;

    // Subscribe to theme changes
    const unsubTheme = useUiStore.subscribe((state, prevState) => {
      if (isInitialLoadRef.current) return;
      if (state.theme === prevState.theme) return;
      saveTheme(state.theme);
      debouncedCloudSave({ theme: state.theme });
    });

    // Subscribe to interval changes
    const unsubInterval = useKlineStore.subscribe((state, prevState) => {
      if (isInitialLoadRef.current) return;
      if (state.interval === prevState.interval) return;
      saveInterval(state.interval);
      debouncedCloudSave({ interval: state.interval });
    });

    // Subscribe to watchlist symbol changes
    const unsubWatchlist = useWatchlistStore.subscribe((state, prevState) => {
      if (isInitialLoadRef.current) return;
      if (state.symbols === prevState.symbols) return;
      saveWatchlistSymbols(state.symbols);
      debouncedCloudSave({ watchlistSymbols: state.symbols });
    });

    return () => {
      unsubTheme();
      unsubInterval();
      unsubWatchlist();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
}
