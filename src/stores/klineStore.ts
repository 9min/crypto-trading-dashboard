// =============================================================================
// Kline (Candlestick) Store
// =============================================================================
// Manages candlestick chart data, the active time interval, and loading state.
// Enforces a maximum capacity of MAX_CANDLES using FIFO eviction via slice
// (never Array.unshift or Array.splice for high-frequency data).
// =============================================================================

import { create } from 'zustand';
import type { CandleData, KlineInterval } from '@/types/chart';
import { DEFAULT_INTERVAL, MAX_CANDLES } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface KlineStoreState {
  /** Array of candlestick data points, ordered oldest-first */
  candles: CandleData[];
  /** Currently selected kline time interval */
  interval: KlineInterval;
  /** Whether historical candle data is currently being fetched */
  isLoading: boolean;
}

interface KlineStoreActions {
  /** Replace all candles (e.g., after fetching historical data) */
  setCandles: (candles: CandleData[]) => void;
  /** Append a new closed candle, enforcing MAX_CANDLES capacity via FIFO slice */
  addCandle: (candle: CandleData) => void;
  /** Replace the last candle in-place (live update for an unclosed kline) */
  updateLastCandle: (candle: CandleData) => void;
  /** Change the active kline interval */
  setInterval: (interval: KlineInterval) => void;
  /** Set the loading state */
  setLoading: (isLoading: boolean) => void;
  /** Reset only data state (candles + loading), preserving the current interval */
  resetData: () => void;
  /** Reset store to initial state (including interval) */
  reset: () => void;
}

type KlineStore = KlineStoreState & KlineStoreActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: KlineStoreState = {
  candles: [],
  interval: DEFAULT_INTERVAL as KlineInterval,
  isLoading: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useKlineStore = create<KlineStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  setCandles: (candles: CandleData[]): void => {
    set({ candles: candles.slice(-MAX_CANDLES) });
  },

  addCandle: (candle: CandleData): void => {
    set((state) => {
      const next = [...state.candles, candle];
      // If over capacity, remove oldest candles from the front via slice
      return {
        candles: next.length > MAX_CANDLES ? next.slice(-MAX_CANDLES) : next,
      };
    });
  },

  updateLastCandle: (candle: CandleData): void => {
    set((state) => {
      if (state.candles.length === 0) {
        return { candles: [candle] };
      }
      // Replace the last element with a new array reference
      const updated = state.candles.slice(0, -1);
      updated.push(candle);
      return { candles: updated };
    });
  },

  setInterval: (interval: KlineInterval): void => {
    set({ interval });
  },

  setLoading: (isLoading: boolean): void => {
    set({ isLoading });
  },

  resetData: (): void => {
    set({ candles: [], isLoading: false });
  },

  reset: (): void => {
    set({ ...INITIAL_STATE });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { KlineStoreState, KlineStoreActions, KlineStore };
