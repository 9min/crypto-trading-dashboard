// =============================================================================
// Portfolio Store
// =============================================================================
// Manages the mock (paper trading) portfolio: cash balance, holdings, and
// trade history. Automatically persists to localStorage after every trade.
// =============================================================================

import { create } from 'zustand';
import type { PortfolioHolding, PortfolioTrade, PortfolioTab } from '@/types/portfolio';
import { INITIAL_CASH_BALANCE, MAX_TRADE_HISTORY, PORTFOLIO_STORAGE_KEY } from '@/types/portfolio';
import { applyBuyTrade, applySellTrade } from '@/utils/portfolioCalc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PortfolioStoreState {
  /** Available cash balance in USDT */
  cashBalance: number;
  /** Map of symbol → holding */
  holdings: Map<string, PortfolioHolding>;
  /** Trade history (newest first), capped at MAX_TRADE_HISTORY */
  trades: PortfolioTrade[];
  /** Active tab in the portfolio widget */
  activeTab: PortfolioTab;
  /** Whether the store has been hydrated from localStorage */
  isHydrated: boolean;
}

interface PortfolioStoreActions {
  /**
   * Execute a buy order. Deducts cash and adds/updates holding.
   * Returns true if executed, false if insufficient cash.
   */
  executeBuy: (symbol: string, price: number, quantity: number) => boolean;
  /**
   * Execute a sell order. Adds cash and reduces/removes holding.
   * Returns true if executed, false if insufficient quantity.
   */
  executeSell: (symbol: string, price: number, quantity: number) => boolean;
  /** Switch the active tab in the portfolio widget */
  setActiveTab: (tab: PortfolioTab) => void;
  /** Reset portfolio to initial state ($100k cash, no holdings) */
  resetPortfolio: () => void;
  /** Hydrate portfolio from localStorage (SSR-safe) */
  hydratePortfolio: () => void;
  /** Full store reset (for testing) */
  reset: () => void;
}

type PortfolioStore = PortfolioStoreState & PortfolioStoreActions;

// -----------------------------------------------------------------------------
// Persistence Helpers
// -----------------------------------------------------------------------------

interface PersistedPortfolio {
  cashBalance: number;
  holdings: Array<[string, PortfolioHolding]>;
  trades: PortfolioTrade[];
}

function persistPortfolio(state: PortfolioStoreState): void {
  try {
    if (typeof window === 'undefined') return;
    const data: PersistedPortfolio = {
      cashBalance: state.cashBalance,
      holdings: [...state.holdings.entries()],
      trades: state.trades,
    };
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[portfolioStore] Failed to persist portfolio', {
      timestamp: Date.now(),
      error,
    });
  }
}

function loadPersistedPortfolio(): Partial<PortfolioStoreState> | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;

    const obj = data as Record<string, unknown>;
    if (typeof obj.cashBalance !== 'number') return null;
    if (!Array.isArray(obj.holdings)) return null;
    if (!Array.isArray(obj.trades)) return null;

    // Validate holdings entries
    const holdingsMap = new Map<string, PortfolioHolding>();
    for (const entry of obj.holdings) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [symbol, holding] = entry as [unknown, unknown];
      if (typeof symbol !== 'string') continue;
      if (typeof holding !== 'object' || holding === null) continue;
      const h = holding as Record<string, unknown>;
      if (
        typeof h.symbol !== 'string' ||
        typeof h.quantity !== 'number' ||
        typeof h.avgEntryPrice !== 'number' ||
        typeof h.costBasis !== 'number'
      ) {
        continue;
      }
      holdingsMap.set(symbol, h as unknown as PortfolioHolding);
    }

    // Validate trades (basic check)
    const trades: PortfolioTrade[] = [];
    for (const trade of obj.trades) {
      if (typeof trade !== 'object' || trade === null) continue;
      const t = trade as Record<string, unknown>;
      if (
        typeof t.id === 'string' &&
        typeof t.symbol === 'string' &&
        (t.side === 'buy' || t.side === 'sell') &&
        typeof t.price === 'number' &&
        typeof t.quantity === 'number' &&
        typeof t.notional === 'number' &&
        typeof t.timestamp === 'number'
      ) {
        trades.push(t as unknown as PortfolioTrade);
      }
    }

    return {
      cashBalance: obj.cashBalance,
      holdings: holdingsMap,
      trades: trades.slice(0, MAX_TRADE_HISTORY),
    };
  } catch (error) {
    console.error('[portfolioStore] Failed to load portfolio', {
      timestamp: Date.now(),
      error,
    });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Trade ID Generator
// -----------------------------------------------------------------------------

function generateTradeId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `portfolio-${Date.now()}-${random}`;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: PortfolioStoreState = {
  cashBalance: INITIAL_CASH_BALANCE,
  holdings: new Map(),
  trades: [],
  activeTab: 'holdings',
  isHydrated: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePortfolioStore = create<PortfolioStore>()((set, get) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  executeBuy: (symbol: string, price: number, quantity: number): boolean => {
    const state = get();
    const notional = price * quantity;

    // Insufficient cash check
    if (notional > state.cashBalance) return false;
    if (quantity <= 0 || price <= 0) return false;

    const existing = state.holdings.get(symbol);
    const updatedHolding = applyBuyTrade(existing, symbol, price, quantity);

    const newHoldings = new Map(state.holdings);
    newHoldings.set(symbol, updatedHolding);

    const trade: PortfolioTrade = {
      id: generateTradeId(),
      symbol,
      side: 'buy',
      price,
      quantity,
      notional,
      timestamp: Date.now(),
    };

    const newTrades = [trade, ...state.trades].slice(0, MAX_TRADE_HISTORY);
    const newCash = state.cashBalance - notional;

    const newState = {
      cashBalance: newCash,
      holdings: newHoldings,
      trades: newTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return true;
  },

  executeSell: (symbol: string, price: number, quantity: number): boolean => {
    const state = get();
    const existing = state.holdings.get(symbol);

    // Cannot sell what we don't hold
    if (!existing) return false;
    if (quantity <= 0 || price <= 0) return false;
    if (quantity > existing.quantity) return false;

    const notional = price * quantity;
    const updatedHolding = applySellTrade(existing, price, quantity);

    const newHoldings = new Map(state.holdings);
    if (updatedHolding) {
      newHoldings.set(symbol, updatedHolding);
    } else {
      newHoldings.delete(symbol);
    }

    const trade: PortfolioTrade = {
      id: generateTradeId(),
      symbol,
      side: 'sell',
      price,
      quantity,
      notional,
      timestamp: Date.now(),
    };

    const newTrades = [trade, ...state.trades].slice(0, MAX_TRADE_HISTORY);
    const newCash = state.cashBalance + notional;

    const newState = {
      cashBalance: newCash,
      holdings: newHoldings,
      trades: newTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return true;
  },

  setActiveTab: (tab: PortfolioTab): void => {
    set({ activeTab: tab });
  },

  resetPortfolio: (): void => {
    set({
      cashBalance: INITIAL_CASH_BALANCE,
      holdings: new Map(),
      trades: [],
    });

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
      }
    } catch {
      // best-effort cleanup
    }
  },

  hydratePortfolio: (): void => {
    const persisted = loadPersistedPortfolio();
    if (persisted) {
      set({ ...persisted, isHydrated: true });
    } else {
      set({ isHydrated: true });
    }
  },

  reset: (): void => {
    set({
      cashBalance: INITIAL_CASH_BALANCE,
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

export type { PortfolioStoreState, PortfolioStoreActions, PortfolioStore };
