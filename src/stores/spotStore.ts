// =============================================================================
// KRW Spot Portfolio Store
// =============================================================================
// Manages the KRW spot paper trading portfolio: wallet balance, holdings,
// and trade history. Persists to localStorage after every state-changing action.
// Supports buying, selling, and position averaging for spot KRW trading.
// =============================================================================

import { create } from 'zustand';
import type {
  SpotHolding,
  SpotTrade,
  SpotPortfolioTab,
  SpotBuyParams,
  SpotSellParams,
} from '@/types/spot';
import {
  SPOT_INITIAL_BALANCE,
  SPOT_MAX_TRADE_HISTORY,
  SPOT_STORAGE_KEY,
  SPOT_MAX_HOLDINGS,
} from '@/types/spot';
import { calculateSpotFee, calculateSpotAverageEntry } from '@/utils/spotCalc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SpotStoreState {
  /** KRW cash balance */
  walletBalance: number;
  /** Map of symbol → spot holding */
  holdings: Map<string, SpotHolding>;
  /** Trade history (newest first), capped at SPOT_MAX_TRADE_HISTORY */
  trades: SpotTrade[];
  /** Active tab in the spot portfolio widget */
  activeTab: SpotPortfolioTab;
  /** Whether the store has been hydrated from localStorage */
  isHydrated: boolean;
}

interface SpotStoreActions {
  /**
   * Buy an asset. Deducts total cost + fee from wallet.
   * If already holding, averages the entry price.
   * Returns true on success, false on insufficient balance or max holdings.
   */
  buyAsset: (params: SpotBuyParams) => boolean;
  /**
   * Sell an asset. Adds proceeds - fee to wallet, records realized PnL.
   * Returns true on success, false if insufficient holding.
   */
  sellAsset: (params: SpotSellParams) => boolean;
  /** Switch the active tab */
  setActiveTab: (tab: SpotPortfolioTab) => void;
  /** Reset spot portfolio to initial state */
  resetSpot: () => void;
  /** Hydrate from localStorage (SSR-safe) */
  hydrateSpot: () => void;
  /** Full store reset (for testing) */
  reset: () => void;
}

type SpotStore = SpotStoreState & SpotStoreActions;

// -----------------------------------------------------------------------------
// Persistence Helpers
// -----------------------------------------------------------------------------

interface PersistedSpot {
  walletBalance: number;
  holdings: Array<[string, SpotHolding]>;
  trades: SpotTrade[];
}

function persistSpot(state: SpotStoreState): void {
  try {
    if (typeof window === 'undefined') return;
    const data: PersistedSpot = {
      walletBalance: state.walletBalance,
      holdings: [...state.holdings.entries()],
      trades: state.trades,
    };
    localStorage.setItem(SPOT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[spotStore] Failed to persist spot portfolio', {
      timestamp: Date.now(),
      error,
    });
  }
}

function isValidSpotAction(value: unknown): value is 'buy' | 'sell' {
  return value === 'buy' || value === 'sell';
}

function loadPersistedSpot(): Partial<SpotStoreState> | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(SPOT_STORAGE_KEY);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;

    const obj = data as Record<string, unknown>;
    if (typeof obj.walletBalance !== 'number') return null;
    if (!Array.isArray(obj.holdings)) return null;
    if (!Array.isArray(obj.trades)) return null;

    // Validate holdings entries
    const holdingsMap = new Map<string, SpotHolding>();
    for (const entry of obj.holdings) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [symbol, holding] = entry as [unknown, unknown];
      if (typeof symbol !== 'string') continue;
      if (typeof holding !== 'object' || holding === null) continue;
      const h = holding as Record<string, unknown>;
      if (
        typeof h.symbol !== 'string' ||
        typeof h.avgEntryPrice !== 'number' ||
        typeof h.quantity !== 'number' ||
        typeof h.costBasis !== 'number' ||
        typeof h.firstBoughtAt !== 'number'
      ) {
        continue;
      }
      holdingsMap.set(h.symbol, h as unknown as SpotHolding);
    }

    // Validate trades
    const trades: SpotTrade[] = [];
    for (const trade of obj.trades) {
      if (typeof trade !== 'object' || trade === null) continue;
      const t = trade as Record<string, unknown>;
      if (
        typeof t.id === 'string' &&
        typeof t.symbol === 'string' &&
        isValidSpotAction(t.action) &&
        typeof t.price === 'number' &&
        typeof t.quantity === 'number' &&
        typeof t.fee === 'number' &&
        typeof t.realizedPnl === 'number' &&
        typeof t.timestamp === 'number'
      ) {
        trades.push(t as unknown as SpotTrade);
      }
    }

    return {
      walletBalance: obj.walletBalance,
      holdings: holdingsMap,
      trades: trades.slice(0, SPOT_MAX_TRADE_HISTORY),
    };
  } catch (error) {
    console.error('[spotStore] Failed to load spot portfolio', {
      timestamp: Date.now(),
      error,
    });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Trade ID Generator
// -----------------------------------------------------------------------------

function generateSpotTradeId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `spot-${Date.now()}-${random}`;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: SpotStoreState = {
  walletBalance: SPOT_INITIAL_BALANCE,
  holdings: new Map(),
  trades: [],
  activeTab: 'holdings',
  isHydrated: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useSpotStore = create<SpotStore>()((set, get) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  buyAsset: (params: SpotBuyParams): boolean => {
    const state = get();
    const { symbol, price, quantity } = params;

    // Validation
    if (price <= 0 || quantity <= 0) return false;

    const totalCost = price * quantity;
    const fee = calculateSpotFee(price, quantity);
    const totalRequired = totalCost + fee;

    // Check balance
    if (totalRequired > state.walletBalance) return false;

    const existing = state.holdings.get(symbol);

    // Check max holdings limit for new symbols
    if (!existing && state.holdings.size >= SPOT_MAX_HOLDINGS) return false;

    const newHoldings = new Map(state.holdings);

    if (existing) {
      // Average entry price
      const newAvgEntry = calculateSpotAverageEntry(
        existing.avgEntryPrice,
        existing.quantity,
        price,
        quantity,
      );
      const newQty = existing.quantity + quantity;
      const newCostBasis = newAvgEntry * newQty;

      newHoldings.set(symbol, {
        ...existing,
        avgEntryPrice: newAvgEntry,
        quantity: newQty,
        costBasis: newCostBasis,
      });
    } else {
      // New holding
      newHoldings.set(symbol, {
        symbol,
        avgEntryPrice: price,
        quantity,
        costBasis: totalCost,
        firstBoughtAt: Date.now(),
      });
    }

    const trade: SpotTrade = {
      id: generateSpotTradeId(),
      symbol,
      action: 'buy',
      price,
      quantity,
      fee,
      realizedPnl: 0,
      timestamp: Date.now(),
    };

    const newTrades = [trade, ...state.trades].slice(0, SPOT_MAX_TRADE_HISTORY);
    const newWalletBalance = state.walletBalance - totalRequired;

    const newState = {
      walletBalance: newWalletBalance,
      holdings: newHoldings,
      trades: newTrades,
    };

    set(newState);
    persistSpot({ ...state, ...newState });

    return true;
  },

  sellAsset: (params: SpotSellParams): boolean => {
    const state = get();
    const { symbol, price, quantity } = params;

    // Validation
    if (price <= 0 || quantity <= 0) return false;

    const existing = state.holdings.get(symbol);
    if (!existing) return false;
    if (quantity > existing.quantity) return false;

    const isFullSell = Math.abs(quantity - existing.quantity) < 1e-10;

    const proceeds = price * quantity;
    const fee = calculateSpotFee(price, quantity);
    const rawPnl = (price - existing.avgEntryPrice) * quantity;
    const realizedPnl = rawPnl - fee;

    const newHoldings = new Map(state.holdings);
    if (isFullSell) {
      newHoldings.delete(symbol);
    } else {
      const remainingQty = existing.quantity - quantity;
      newHoldings.set(symbol, {
        ...existing,
        quantity: remainingQty,
        costBasis: existing.avgEntryPrice * remainingQty,
      });
    }

    const newWalletBalance = state.walletBalance + proceeds - fee;

    const trade: SpotTrade = {
      id: generateSpotTradeId(),
      symbol,
      action: 'sell',
      price,
      quantity,
      fee,
      realizedPnl,
      timestamp: Date.now(),
    };

    const newTrades = [trade, ...state.trades].slice(0, SPOT_MAX_TRADE_HISTORY);

    const newState = {
      walletBalance: newWalletBalance,
      holdings: newHoldings,
      trades: newTrades,
    };

    set(newState);
    persistSpot({ ...state, ...newState });

    return true;
  },

  setActiveTab: (tab: SpotPortfolioTab): void => {
    set({ activeTab: tab });
  },

  resetSpot: (): void => {
    set({
      walletBalance: SPOT_INITIAL_BALANCE,
      holdings: new Map(),
      trades: [],
    });

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SPOT_STORAGE_KEY);
      }
    } catch {
      // best-effort cleanup
    }
  },

  hydrateSpot: (): void => {
    const persisted = loadPersistedSpot();
    if (persisted) {
      set({ ...persisted, isHydrated: true });
    } else {
      set({ isHydrated: true });
    }
  },

  reset: (): void => {
    set({
      walletBalance: SPOT_INITIAL_BALANCE,
      holdings: new Map(),
      trades: [],
      activeTab: 'holdings',
      isHydrated: false,
    });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { SpotStoreState, SpotStoreActions, SpotStore };
