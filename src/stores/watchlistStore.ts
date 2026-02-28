// =============================================================================
// Watchlist Store
// =============================================================================
// Manages watchlist ticker data for multiple symbols. Populated initially
// via REST API (fetch24hrTickers) and updated in real-time via WebSocket
// miniTicker stream. Uses a Map for O(1) symbol lookups.
// =============================================================================

import { create } from 'zustand';
import type { WatchlistTicker } from '@/types/chart';
import { DEFAULT_WATCHLIST_SYMBOLS, MAX_WATCHLIST_SYMBOLS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WatchlistStoreState {
  /** Ticker data keyed by symbol for O(1) lookups */
  tickers: Map<string, WatchlistTicker>;
  /** Binance USDT prices — always populated regardless of active exchange.
   *  Used by Futures components to ensure PnL is always calculated in USD. */
  binancePrices: Map<string, WatchlistTicker>;
  /** Ordered list of watchlist symbols */
  symbols: string[];
  /** Whether the initial REST API load is in progress */
  isLoading: boolean;
}

interface WatchlistStoreActions {
  /** Update a single ticker (WebSocket miniTicker handler). Creates new Map reference. */
  updateTicker: (symbol: string, partial: Partial<Omit<WatchlistTicker, 'symbol'>>) => void;
  /** Bulk-set tickers from REST API response */
  setTickers: (tickers: WatchlistTicker[]) => void;
  /** Update a single Binance USDT price (for futures PnL calculation) */
  updateBinanceTicker: (symbol: string, partial: Partial<Omit<WatchlistTicker, 'symbol'>>) => void;
  /** Bulk-set Binance USDT prices from REST API response */
  setBinanceTickers: (tickers: WatchlistTicker[]) => void;
  /** Add a symbol to the watchlist (no-op if duplicate or at capacity) */
  addSymbol: (symbol: string) => void;
  /** Remove a symbol from the watchlist */
  removeSymbol: (symbol: string) => void;
  /** Set the loading state */
  setLoading: (isLoading: boolean) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type WatchlistStore = WatchlistStoreState & WatchlistStoreActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: WatchlistStoreState = {
  tickers: new Map(),
  binancePrices: new Map(),
  symbols: [...DEFAULT_WATCHLIST_SYMBOLS],
  isLoading: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWatchlistStore = create<WatchlistStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  updateTicker: (symbol: string, partial: Partial<Omit<WatchlistTicker, 'symbol'>>): void => {
    set((state) => {
      const existing = state.tickers.get(symbol);
      const updated = new Map(state.tickers);
      updated.set(symbol, {
        symbol,
        price: partial.price ?? existing?.price ?? 0,
        priceChangePercent: partial.priceChangePercent ?? existing?.priceChangePercent ?? 0,
        volume: partial.volume ?? existing?.volume ?? 0,
        lastUpdateTime: partial.lastUpdateTime ?? existing?.lastUpdateTime ?? 0,
      });
      return { tickers: updated };
    });
  },

  setTickers: (tickers: WatchlistTicker[]): void => {
    const tickerMap = new Map<string, WatchlistTicker>();
    for (const ticker of tickers) {
      tickerMap.set(ticker.symbol, ticker);
    }
    set({ tickers: tickerMap, isLoading: false });
  },

  updateBinanceTicker: (
    symbol: string,
    partial: Partial<Omit<WatchlistTicker, 'symbol'>>,
  ): void => {
    set((state) => {
      const existing = state.binancePrices.get(symbol);
      const updated = new Map(state.binancePrices);
      updated.set(symbol, {
        symbol,
        price: partial.price ?? existing?.price ?? 0,
        priceChangePercent: partial.priceChangePercent ?? existing?.priceChangePercent ?? 0,
        volume: partial.volume ?? existing?.volume ?? 0,
        lastUpdateTime: partial.lastUpdateTime ?? existing?.lastUpdateTime ?? 0,
      });
      return { binancePrices: updated };
    });
  },

  setBinanceTickers: (tickers: WatchlistTicker[]): void => {
    const tickerMap = new Map<string, WatchlistTicker>();
    for (const ticker of tickers) {
      tickerMap.set(ticker.symbol, ticker);
    }
    set({ binancePrices: tickerMap });
  },

  addSymbol: (symbol: string): void => {
    set((state) => {
      if (state.symbols.includes(symbol)) return state;
      if (state.symbols.length >= MAX_WATCHLIST_SYMBOLS) return state;
      return { symbols: [...state.symbols, symbol] };
    });
  },

  removeSymbol: (symbol: string): void => {
    set((state) => {
      const nextSymbols = state.symbols.filter((s) => s !== symbol);
      if (nextSymbols.length === state.symbols.length) return state;
      const nextTickers = new Map(state.tickers);
      nextTickers.delete(symbol);
      return { symbols: nextSymbols, tickers: nextTickers };
    });
  },

  setLoading: (isLoading: boolean): void => {
    set({ isLoading });
  },

  reset: (): void => {
    set({
      tickers: new Map(),
      binancePrices: new Map(),
      symbols: [...DEFAULT_WATCHLIST_SYMBOLS],
      isLoading: false,
    });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { WatchlistStoreState, WatchlistStoreActions, WatchlistStore };
