// =============================================================================
// Futures Portfolio Store
// =============================================================================
// Manages the futures paper trading portfolio: wallet balance, open positions,
// leverage settings, and trade history. Persists to localStorage after every
// state-changing action. Supports position opening, closing, and forced
// liquidation simulation.
// =============================================================================

import { create } from 'zustand';
import type {
  FuturesPosition,
  FuturesTrade,
  PortfolioTab,
  MarginType,
  OpenPositionParams,
} from '@/types/portfolio';
import {
  INITIAL_CASH_BALANCE,
  MAX_TRADE_HISTORY,
  PORTFOLIO_STORAGE_KEY,
  MAX_OPEN_POSITIONS,
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_TYPE,
} from '@/types/portfolio';
import {
  calculateLiquidationPrice,
  calculateMargin,
  calculateUnrealizedPnl,
} from '@/utils/portfolioCalc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PortfolioStoreState {
  /** Wallet balance in USDT (cash not locked in margin) */
  walletBalance: number;
  /** Map of symbol → open futures position (1 symbol = 1 position) */
  positions: Map<string, FuturesPosition>;
  /** Trade history (newest first), capped at MAX_TRADE_HISTORY */
  trades: FuturesTrade[];
  /** Active tab in the portfolio widget */
  activeTab: PortfolioTab;
  /** Whether the store has been hydrated from localStorage */
  isHydrated: boolean;
  /** Default leverage for new positions */
  defaultLeverage: number;
  /** Default margin type for new positions */
  defaultMarginType: MarginType;
}

interface PortfolioStoreActions {
  /**
   * Open a new futures position.
   * Returns true if opened, false if rejected (insufficient balance,
   * existing position on same symbol, or max positions reached).
   */
  openPosition: (params: OpenPositionParams) => boolean;
  /**
   * Close a position partially or fully.
   * Returns true if closed, false if no position or insufficient quantity.
   */
  closePosition: (symbol: string, price: number, quantity: number) => boolean;
  /**
   * Check all positions for liquidation at given prices.
   * Returns array of liquidated symbols.
   */
  checkLiquidations: (prices: Map<string, number>) => string[];
  /** Set default leverage for new positions */
  setDefaultLeverage: (leverage: number) => void;
  /** Set default margin type for new positions */
  setDefaultMarginType: (marginType: MarginType) => void;
  /** Switch the active tab in the portfolio widget */
  setActiveTab: (tab: PortfolioTab) => void;
  /** Reset portfolio to initial state ($100K, no positions) */
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
  walletBalance: number;
  positions: Array<[string, FuturesPosition]>;
  trades: FuturesTrade[];
  defaultLeverage: number;
  defaultMarginType: MarginType;
}

function persistPortfolio(state: PortfolioStoreState): void {
  try {
    if (typeof window === 'undefined') return;
    const data: PersistedPortfolio = {
      walletBalance: state.walletBalance,
      positions: [...state.positions.entries()],
      trades: state.trades,
      defaultLeverage: state.defaultLeverage,
      defaultMarginType: state.defaultMarginType,
    };
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[portfolioStore] Failed to persist portfolio', {
      timestamp: Date.now(),
      error,
    });
  }
}

function isValidPositionSide(value: unknown): value is 'long' | 'short' {
  return value === 'long' || value === 'short';
}

function isValidMarginType(value: unknown): value is MarginType {
  return value === 'cross' || value === 'isolated';
}

function loadPersistedPortfolio(): Partial<PortfolioStoreState> | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;

    const obj = data as Record<string, unknown>;
    if (typeof obj.walletBalance !== 'number') return null;
    if (!Array.isArray(obj.positions)) return null;
    if (!Array.isArray(obj.trades)) return null;

    // Validate positions entries
    const positionsMap = new Map<string, FuturesPosition>();
    for (const entry of obj.positions) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [symbol, position] = entry as [unknown, unknown];
      if (typeof symbol !== 'string') continue;
      if (typeof position !== 'object' || position === null) continue;
      const p = position as Record<string, unknown>;
      if (
        typeof p.id !== 'string' ||
        typeof p.symbol !== 'string' ||
        !isValidPositionSide(p.side) ||
        typeof p.entryPrice !== 'number' ||
        typeof p.quantity !== 'number' ||
        typeof p.leverage !== 'number' ||
        !isValidMarginType(p.marginType) ||
        typeof p.margin !== 'number' ||
        typeof p.liquidationPrice !== 'number' ||
        typeof p.openedAt !== 'number'
      ) {
        continue;
      }
      positionsMap.set(symbol, p as unknown as FuturesPosition);
    }

    // Validate trades
    const trades: FuturesTrade[] = [];
    for (const trade of obj.trades) {
      if (typeof trade !== 'object' || trade === null) continue;
      const t = trade as Record<string, unknown>;
      if (
        typeof t.id === 'string' &&
        typeof t.symbol === 'string' &&
        isValidPositionSide(t.side) &&
        (t.action === 'open' || t.action === 'close') &&
        typeof t.price === 'number' &&
        typeof t.quantity === 'number' &&
        typeof t.leverage === 'number' &&
        typeof t.realizedPnl === 'number' &&
        (t.closeReason === null || t.closeReason === 'manual' || t.closeReason === 'liquidated') &&
        typeof t.timestamp === 'number'
      ) {
        trades.push(t as unknown as FuturesTrade);
      }
    }

    const result: Partial<PortfolioStoreState> = {
      walletBalance: obj.walletBalance,
      positions: positionsMap,
      trades: trades.slice(0, MAX_TRADE_HISTORY),
    };

    // Optional fields
    if (typeof obj.defaultLeverage === 'number' && obj.defaultLeverage >= 1) {
      result.defaultLeverage = obj.defaultLeverage;
    }
    if (isValidMarginType(obj.defaultMarginType)) {
      result.defaultMarginType = obj.defaultMarginType;
    }

    return result;
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
  return `futures-${Date.now()}-${random}`;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: PortfolioStoreState = {
  walletBalance: INITIAL_CASH_BALANCE,
  positions: new Map(),
  trades: [],
  activeTab: 'positions',
  isHydrated: false,
  defaultLeverage: DEFAULT_LEVERAGE,
  defaultMarginType: DEFAULT_MARGIN_TYPE,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePortfolioStore = create<PortfolioStore>()((set, get) => ({
  // -- State ------------------------------------------------------------------
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------
  openPosition: (params: OpenPositionParams): boolean => {
    const state = get();
    const { symbol, side, price, quantity, leverage, marginType } = params;

    // Validation
    if (price <= 0 || quantity <= 0 || leverage < 1) return false;
    if (state.positions.has(symbol)) return false;
    if (state.positions.size >= MAX_OPEN_POSITIONS) return false;

    const margin = calculateMargin(price, quantity, leverage);
    const totalMarginUsed = [...state.positions.values()].reduce((sum, p) => sum + p.margin, 0);
    const availableBalance = state.walletBalance - totalMarginUsed;

    if (margin > availableBalance) return false;

    const liquidationPrice = calculateLiquidationPrice(price, leverage, side, marginType);

    const position: FuturesPosition = {
      id: generateTradeId(),
      symbol,
      side,
      entryPrice: price,
      quantity,
      leverage,
      marginType,
      margin,
      liquidationPrice,
      openedAt: Date.now(),
    };

    const trade: FuturesTrade = {
      id: generateTradeId(),
      symbol,
      side,
      action: 'open',
      price,
      quantity,
      leverage,
      realizedPnl: 0,
      closeReason: null,
      timestamp: Date.now(),
    };

    const newPositions = new Map(state.positions);
    newPositions.set(symbol, position);
    const newTrades = [trade, ...state.trades].slice(0, MAX_TRADE_HISTORY);

    const newState = {
      positions: newPositions,
      trades: newTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return true;
  },

  closePosition: (symbol: string, price: number, quantity: number): boolean => {
    const state = get();
    const position = state.positions.get(symbol);

    if (!position) return false;
    if (price <= 0 || quantity <= 0) return false;
    if (quantity > position.quantity) return false;

    const isFullClose = Math.abs(quantity - position.quantity) < 1e-10;

    // Calculate realized PnL for the closed quantity
    const realizedPnl = calculateUnrealizedPnl(position.entryPrice, price, quantity, position.side);

    // Wallet balance change: only add realized PnL.
    // Margin was never deducted from wallet on open (it's "reserved"),
    // so we must NOT add it back on close — only the PnL delta matters.
    const newWalletBalance = state.walletBalance + realizedPnl;

    // Update or remove position
    const newPositions = new Map(state.positions);
    if (isFullClose) {
      newPositions.delete(symbol);
    } else {
      const remainingRatio = (position.quantity - quantity) / position.quantity;
      newPositions.set(symbol, {
        ...position,
        quantity: position.quantity - quantity,
        margin: position.margin * remainingRatio,
      });
    }

    const trade: FuturesTrade = {
      id: generateTradeId(),
      symbol,
      side: position.side,
      action: 'close',
      price,
      quantity,
      leverage: position.leverage,
      realizedPnl,
      closeReason: 'manual',
      timestamp: Date.now(),
    };

    const newTrades = [trade, ...state.trades].slice(0, MAX_TRADE_HISTORY);

    const newState = {
      walletBalance: newWalletBalance,
      positions: newPositions,
      trades: newTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return true;
  },

  checkLiquidations: (prices: Map<string, number>): string[] => {
    const state = get();
    const liquidated: string[] = [];

    for (const [symbol, position] of state.positions) {
      const currentPrice = prices.get(symbol);
      if (currentPrice === undefined) continue;

      let shouldLiquidate = false;
      if (position.marginType === 'isolated') {
        if (position.side === 'long' && currentPrice <= position.liquidationPrice) {
          shouldLiquidate = true;
        } else if (position.side === 'short' && currentPrice >= position.liquidationPrice) {
          shouldLiquidate = true;
        }
      }

      if (shouldLiquidate) {
        liquidated.push(symbol);
      }
    }

    if (liquidated.length === 0) return liquidated;

    // Process liquidations
    const newPositions = new Map(state.positions);
    const newTrades = [...state.trades];
    let newWalletBalance = state.walletBalance;

    for (const symbol of liquidated) {
      const position = state.positions.get(symbol);
      if (!position) continue;

      const currentPrice = prices.get(symbol);
      if (currentPrice === undefined) continue;

      // Liquidation: lose the entire margin
      newWalletBalance -= position.margin;
      newPositions.delete(symbol);

      const trade: FuturesTrade = {
        id: generateTradeId(),
        symbol,
        side: position.side,
        action: 'close',
        price: currentPrice,
        quantity: position.quantity,
        leverage: position.leverage,
        realizedPnl: -position.margin,
        closeReason: 'liquidated',
        timestamp: Date.now(),
      };

      newTrades.unshift(trade);
    }

    const cappedTrades = newTrades.slice(0, MAX_TRADE_HISTORY);
    const newState = {
      walletBalance: newWalletBalance,
      positions: newPositions,
      trades: cappedTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return liquidated;
  },

  setDefaultLeverage: (leverage: number): void => {
    if (leverage < 1) return;
    set({ defaultLeverage: leverage });
    persistPortfolio(get());
  },

  setDefaultMarginType: (marginType: MarginType): void => {
    set({ defaultMarginType: marginType });
    persistPortfolio(get());
  },

  setActiveTab: (tab: PortfolioTab): void => {
    set({ activeTab: tab });
  },

  resetPortfolio: (): void => {
    set({
      walletBalance: INITIAL_CASH_BALANCE,
      positions: new Map(),
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
      walletBalance: INITIAL_CASH_BALANCE,
      positions: new Map(),
      trades: [],
      activeTab: 'positions',
      isHydrated: false,
      defaultLeverage: DEFAULT_LEVERAGE,
      defaultMarginType: DEFAULT_MARGIN_TYPE,
    });
  },
}));

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { PortfolioStoreState, PortfolioStoreActions, PortfolioStore };
