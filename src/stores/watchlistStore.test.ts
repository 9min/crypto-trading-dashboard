// =============================================================================
// Watchlist Store Unit Tests
// =============================================================================

import { useWatchlistStore } from './watchlistStore';
import { DEFAULT_WATCHLIST_SYMBOLS, MAX_WATCHLIST_SYMBOLS } from '@/utils/constants';
import type { WatchlistTicker } from '@/types/chart';

// Helper to create a ticker with sensible defaults
function createTicker(overrides: Partial<WatchlistTicker> = {}): WatchlistTicker {
  return {
    symbol: 'BTCUSDT',
    price: 50000,
    priceChangePercent: 2.5,
    volume: 1_000_000_000,
    lastUpdateTime: Date.now(),
    ...overrides,
  };
}

// Helper to reset store state between tests
function resetStore(): void {
  useWatchlistStore.getState().reset();
}

describe('watchlistStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // Initial State
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with DEFAULT_WATCHLIST_SYMBOLS', () => {
      const state = useWatchlistStore.getState();
      expect(state.symbols).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
    });

    it('starts with an empty tickers map', () => {
      const state = useWatchlistStore.getState();
      expect(state.tickers.size).toBe(0);
    });

    it('starts with isLoading = false', () => {
      expect(useWatchlistStore.getState().isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTicker
  // ---------------------------------------------------------------------------

  describe('updateTicker', () => {
    it('creates a new ticker entry when none exists', () => {
      useWatchlistStore.getState().updateTicker('BTCUSDT', {
        price: 50000,
        priceChangePercent: 1.5,
        volume: 500_000_000,
        lastUpdateTime: 1000,
      });

      const ticker = useWatchlistStore.getState().tickers.get('BTCUSDT');
      expect(ticker).toBeDefined();
      expect(ticker?.price).toBe(50000);
      expect(ticker?.priceChangePercent).toBe(1.5);
      expect(ticker?.volume).toBe(500_000_000);
      expect(ticker?.symbol).toBe('BTCUSDT');
    });

    it('merges partial updates with existing ticker data', () => {
      // Set initial ticker
      useWatchlistStore.getState().updateTicker('ETHUSDT', {
        price: 3000,
        priceChangePercent: -2.0,
        volume: 100_000_000,
        lastUpdateTime: 1000,
      });

      // Update only price
      useWatchlistStore.getState().updateTicker('ETHUSDT', {
        price: 3100,
        lastUpdateTime: 2000,
      });

      const ticker = useWatchlistStore.getState().tickers.get('ETHUSDT');
      expect(ticker?.price).toBe(3100);
      expect(ticker?.priceChangePercent).toBe(-2.0); // Preserved from original
      expect(ticker?.volume).toBe(100_000_000); // Preserved from original
      expect(ticker?.lastUpdateTime).toBe(2000);
    });

    it('creates a new Map reference on each update', () => {
      const mapBefore = useWatchlistStore.getState().tickers;

      useWatchlistStore.getState().updateTicker('BTCUSDT', { price: 50000 });

      const mapAfter = useWatchlistStore.getState().tickers;
      expect(mapAfter).not.toBe(mapBefore);
    });

    it('defaults missing fields to 0 for new tickers with partial data', () => {
      useWatchlistStore.getState().updateTicker('XRPUSDT', {
        price: 0.5,
      });

      const ticker = useWatchlistStore.getState().tickers.get('XRPUSDT');
      expect(ticker?.priceChangePercent).toBe(0);
      expect(ticker?.volume).toBe(0);
      expect(ticker?.lastUpdateTime).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // setTickers
  // ---------------------------------------------------------------------------

  describe('setTickers', () => {
    it('bulk-sets tickers from an array', () => {
      const tickers = [
        createTicker({ symbol: 'BTCUSDT', price: 50000 }),
        createTicker({ symbol: 'ETHUSDT', price: 3000 }),
      ];

      useWatchlistStore.getState().setTickers(tickers);

      const state = useWatchlistStore.getState();
      expect(state.tickers.size).toBe(2);
      expect(state.tickers.get('BTCUSDT')?.price).toBe(50000);
      expect(state.tickers.get('ETHUSDT')?.price).toBe(3000);
    });

    it('sets isLoading to false', () => {
      useWatchlistStore.getState().setLoading(true);
      expect(useWatchlistStore.getState().isLoading).toBe(true);

      useWatchlistStore.getState().setTickers([createTicker()]);
      expect(useWatchlistStore.getState().isLoading).toBe(false);
    });

    it('replaces existing tickers completely', () => {
      useWatchlistStore
        .getState()
        .setTickers([createTicker({ symbol: 'BTCUSDT' }), createTicker({ symbol: 'ETHUSDT' })]);

      useWatchlistStore.getState().setTickers([createTicker({ symbol: 'SOLUSDT' })]);

      const state = useWatchlistStore.getState();
      expect(state.tickers.size).toBe(1);
      expect(state.tickers.has('SOLUSDT')).toBe(true);
      expect(state.tickers.has('BTCUSDT')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // addSymbol
  // ---------------------------------------------------------------------------

  describe('addSymbol', () => {
    it('adds a new symbol to the list', () => {
      const initialLength = useWatchlistStore.getState().symbols.length;

      useWatchlistStore.getState().addSymbol('DOTUSDT');

      const state = useWatchlistStore.getState();
      expect(state.symbols).toHaveLength(initialLength + 1);
      expect(state.symbols).toContain('DOTUSDT');
    });

    it('does not add duplicate symbols', () => {
      const initialLength = useWatchlistStore.getState().symbols.length;

      // BTCUSDT is already in DEFAULT_WATCHLIST_SYMBOLS
      useWatchlistStore.getState().addSymbol('BTCUSDT');

      expect(useWatchlistStore.getState().symbols).toHaveLength(initialLength);
    });

    it('does not exceed MAX_WATCHLIST_SYMBOLS', () => {
      // Reset to empty and fill to capacity
      useWatchlistStore.setState({ symbols: [] });
      for (let i = 0; i < MAX_WATCHLIST_SYMBOLS; i++) {
        useWatchlistStore.getState().addSymbol(`SYMBOL${i}USDT`);
      }
      expect(useWatchlistStore.getState().symbols).toHaveLength(MAX_WATCHLIST_SYMBOLS);

      // Try to add one more
      useWatchlistStore.getState().addSymbol('OVERFLOWUSDT');
      expect(useWatchlistStore.getState().symbols).toHaveLength(MAX_WATCHLIST_SYMBOLS);
      expect(useWatchlistStore.getState().symbols).not.toContain('OVERFLOWUSDT');
    });
  });

  // ---------------------------------------------------------------------------
  // removeSymbol
  // ---------------------------------------------------------------------------

  describe('removeSymbol', () => {
    it('removes a symbol from the list', () => {
      const initialLength = useWatchlistStore.getState().symbols.length;

      useWatchlistStore.getState().removeSymbol('BTCUSDT');

      const state = useWatchlistStore.getState();
      expect(state.symbols).toHaveLength(initialLength - 1);
      expect(state.symbols).not.toContain('BTCUSDT');
    });

    it('also removes the ticker data for the removed symbol', () => {
      useWatchlistStore
        .getState()
        .setTickers([createTicker({ symbol: 'BTCUSDT' }), createTicker({ symbol: 'ETHUSDT' })]);

      useWatchlistStore.getState().removeSymbol('BTCUSDT');

      expect(useWatchlistStore.getState().tickers.has('BTCUSDT')).toBe(false);
      expect(useWatchlistStore.getState().tickers.has('ETHUSDT')).toBe(true);
    });

    it('is a no-op for symbols not in the list', () => {
      const stateBefore = useWatchlistStore.getState();
      const symbolsBefore = stateBefore.symbols;

      useWatchlistStore.getState().removeSymbol('NONEXISTENT');

      // Should return same reference (no-op optimization)
      expect(useWatchlistStore.getState().symbols).toBe(symbolsBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('restores initial state', () => {
      // Modify store
      useWatchlistStore.getState().addSymbol('DOTUSDT');
      useWatchlistStore.getState().setTickers([createTicker({ symbol: 'BTCUSDT' })]);
      useWatchlistStore.getState().setLoading(true);

      // Reset
      useWatchlistStore.getState().reset();

      const state = useWatchlistStore.getState();
      expect(state.symbols).toEqual([...DEFAULT_WATCHLIST_SYMBOLS]);
      expect(state.tickers.size).toBe(0);
      expect(state.isLoading).toBe(false);
    });
  });
});
