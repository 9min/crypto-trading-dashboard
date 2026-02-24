// =============================================================================
// Depth (Order Book) Store
// =============================================================================
// Manages order book state: bid/ask price levels, snapshot tracking, and
// incremental depth updates. Bids are sorted descending by price, asks
// ascending. Both sides are capped at MAX_DEPTH_LEVELS.
//
// The `isDirty` flag signals the Canvas renderer that new data is available,
// allowing rAF-based rendering without React re-render coupling.
// =============================================================================

import { create } from 'zustand';
import type { PriceLevel } from '@/types/chart';
import { MAX_DEPTH_LEVELS } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface DepthStoreState {
  /** Buy orders sorted by price descending (highest bid first) */
  bids: PriceLevel[];
  /** Sell orders sorted by price ascending (lowest ask first) */
  asks: PriceLevel[];
  /** Last processed update ID for sequencing Binance depth updates */
  lastUpdateId: number;
  /** Signals the Canvas renderer that data has changed since last draw */
  isDirty: boolean;
}

interface DepthStoreActions {
  /** Replace all bid levels */
  setBids: (bids: PriceLevel[]) => void;
  /** Replace all ask levels */
  setAsks: (asks: PriceLevel[]) => void;
  /** Set a full order book snapshot (e.g., from REST API initial fetch) */
  setSnapshot: (bids: PriceLevel[], asks: PriceLevel[], lastUpdateId: number) => void;
  /** Apply an incremental depth update: upsert or remove levels, re-sort, and cap */
  applyDepthUpdate: (
    bidUpdates: PriceLevel[],
    askUpdates: PriceLevel[],
    finalUpdateId: number,
  ) => void;
  /** Clear the dirty flag after the Canvas renderer has drawn */
  markClean: () => void;
  /** Reset store to initial state */
  reset: () => void;
}

type DepthStore = DepthStoreState & DepthStoreActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Applies incremental updates to a list of price levels.
 * - If an update has quantity === 0, the price level is removed.
 * - Otherwise the price level is upserted (updated if exists, inserted if new).
 */
function applyLevelUpdates(existing: PriceLevel[], updates: PriceLevel[]): PriceLevel[] {
  // Build a Map for O(1) lookups by price
  const map = new Map<number, number>();
  for (const level of existing) {
    map.set(level.price, level.quantity);
  }

  for (const update of updates) {
    if (update.quantity === 0) {
      map.delete(update.price);
    } else {
      map.set(update.price, update.quantity);
    }
  }

  const result: PriceLevel[] = [];
  map.forEach((quantity, price) => {
    result.push({ price, quantity });
  });

  return result;
}

/**
 * Sorts bids descending by price (highest first) and caps at MAX_DEPTH_LEVELS.
 */
function sortAndCapBids(levels: PriceLevel[]): PriceLevel[] {
  return [...levels].sort((a, b) => b.price - a.price).slice(0, MAX_DEPTH_LEVELS);
}

/**
 * Sorts asks ascending by price (lowest first) and caps at MAX_DEPTH_LEVELS.
 */
function sortAndCapAsks(levels: PriceLevel[]): PriceLevel[] {
  return [...levels].sort((a, b) => a.price - b.price).slice(0, MAX_DEPTH_LEVELS);
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: DepthStoreState = {
  bids: [],
  asks: [],
  lastUpdateId: 0,
  isDirty: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useDepthStore = create<DepthStore>()((set) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  setBids: (bids: PriceLevel[]): void => {
    set({ bids: sortAndCapBids([...bids]), isDirty: true });
  },

  setAsks: (asks: PriceLevel[]): void => {
    set({ asks: sortAndCapAsks([...asks]), isDirty: true });
  },

  setSnapshot: (bids: PriceLevel[], asks: PriceLevel[], lastUpdateId: number): void => {
    set({
      bids: sortAndCapBids([...bids]),
      asks: sortAndCapAsks([...asks]),
      lastUpdateId,
      isDirty: true,
    });
  },

  applyDepthUpdate: (
    bidUpdates: PriceLevel[],
    askUpdates: PriceLevel[],
    finalUpdateId: number,
  ): void => {
    set((state) => {
      // Guard against stale or duplicate updates
      if (finalUpdateId <= state.lastUpdateId) return state;

      const updatedBids = applyLevelUpdates(state.bids, bidUpdates);
      const updatedAsks = applyLevelUpdates(state.asks, askUpdates);

      return {
        bids: sortAndCapBids(updatedBids),
        asks: sortAndCapAsks(updatedAsks),
        lastUpdateId: finalUpdateId,
        isDirty: true,
      };
    });
  },

  markClean: (): void => {
    set({ isDirty: false });
  },

  reset: (): void => {
    set({ ...INITIAL_STATE });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { DepthStoreState, DepthStoreActions, DepthStore };
