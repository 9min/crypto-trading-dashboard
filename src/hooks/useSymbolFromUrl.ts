'use client';

// =============================================================================
// useSymbolFromUrl Hook
// =============================================================================
// Reads ?symbol= from the URL on mount and syncs uiStore.symbol ↔ URL.
// Uses window.history.replaceState to update the URL without page reload.
// SSR-safe with typeof window guard.
// =============================================================================

import { useEffect, useRef } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { DEFAULT_WATCHLIST_SYMBOLS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Known symbol validation
// -----------------------------------------------------------------------------

/**
 * Checks whether a symbol string is a plausible USDT pair.
 * Valid if it's in the default watchlist, current watchlist store, or matches
 * the general pattern of an uppercase string ending in "USDT".
 */
function isValidSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();

  // Check default watchlist
  if ((DEFAULT_WATCHLIST_SYMBOLS as readonly string[]).includes(upper)) return true;

  // Check current watchlist store
  const storeSymbols = useWatchlistStore.getState().symbols;
  if (storeSymbols.includes(upper)) return true;

  // Accept any alphanumeric string ending with USDT (general Binance pattern)
  return /^[A-Z0-9]{2,20}USDT$/.test(upper);
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * On mount, reads `?symbol=` from the URL and sets uiStore.symbol if valid.
 * Subscribes to uiStore.symbol changes and updates the URL via replaceState.
 */
export function useSymbolFromUrl(): void {
  const hasReadUrl = useRef(false);

  // Read URL param on mount (once)
  useEffect(() => {
    if (typeof window === 'undefined' || hasReadUrl.current) return;
    hasReadUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlSymbol = params.get('symbol');
    if (!urlSymbol) return;

    const normalized = urlSymbol.toUpperCase();
    if (isValidSymbol(normalized)) {
      const currentSymbol = useUiStore.getState().symbol;
      if (currentSymbol !== normalized) {
        useUiStore.getState().setSymbol(normalized);
      }
    }
  }, []);

  // Sync uiStore.symbol → URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unsubscribe = useUiStore.subscribe((state, prevState) => {
      if (state.symbol !== prevState.symbol) {
        const url = new URL(window.location.href);
        url.searchParams.set('symbol', state.symbol);
        window.history.replaceState(null, '', url.toString());
      }
    });

    return unsubscribe;
  }, []);
}
