// =============================================================================
// Trade Store
// =============================================================================
// Manages the trade history feed displayed in the trades widget.
// Trades are stored newest-first (prepended) and capped at MAX_TRADES.
//
// Note: The low-level Float64Array RingBuffer in utils/ is used by the Canvas
// renderer directly. This store uses a plain array for React-accessible state
// (e.g., watchlist price display, last price indicator).
// =============================================================================

import { create } from 'zustand';
import type { TradeEntry } from '@/types/chart';
import { MAX_TRADES } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Direction of the last price change relative to the previous trade */
type PriceDirection = 'up' | 'down' | 'neutral';

interface TradeStoreState {
  /** Trade entries ordered newest-first */
  trades: TradeEntry[];
  /** Most recent trade price (0 when no trades have been received) */
  lastPrice: number;
  /** Direction of last price movement */
  lastPriceDirection: PriceDirection;
}

interface TradeStoreActions {
  /** Prepend a single trade, update lastPrice/direction, and enforce MAX_TRADES cap */
  addTrade: (trade: TradeEntry) => void;
  /** Bulk-set trades (e.g., from REST API initial fetch) */
  setTrades: (trades: TradeEntry[]) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type TradeStore = TradeStoreState & TradeStoreActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Computes the price direction by comparing the new price against the previous.
 */
function computePriceDirection(newPrice: number, previousPrice: number): PriceDirection {
  if (previousPrice === 0) return 'neutral';
  if (newPrice > previousPrice) return 'up';
  if (newPrice < previousPrice) return 'down';
  return 'neutral';
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: TradeStoreState = {
  trades: [],
  lastPrice: 0,
  lastPriceDirection: 'neutral',
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useTradeStore = create<TradeStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  addTrade: (trade: TradeEntry): void => {
    set((state) => {
      const direction = computePriceDirection(trade.price, state.lastPrice);

      // Prepend new trade and cap at MAX_TRADES by slicing from the end
      const next = [trade, ...state.trades];
      const capped = next.length > MAX_TRADES ? next.slice(0, MAX_TRADES) : next;

      return {
        trades: capped,
        lastPrice: trade.price,
        lastPriceDirection: direction,
      };
    });
  },

  /**
   * Bulk-set trades from an external source (e.g., REST API).
   * Input must be newest-first (reverse Binance REST response before passing).
   */
  setTrades: (trades: TradeEntry[]): void => {
    const capped = trades.slice(0, MAX_TRADES);
    const lastPrice = capped.length > 0 ? capped[0].price : 0;

    set({
      trades: capped,
      lastPrice,
      lastPriceDirection: 'neutral',
    });
  },

  reset: (): void => {
    set({ ...INITIAL_STATE });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { PriceDirection, TradeStoreState, TradeStoreActions, TradeStore };
