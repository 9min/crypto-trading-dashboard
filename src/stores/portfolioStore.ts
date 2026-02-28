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
  PositionSide,
  OpenPositionParams,
  AutoCloseResult,
} from '@/types/portfolio';
import {
  INITIAL_CASH_BALANCE,
  MAX_TRADE_HISTORY,
  PORTFOLIO_STORAGE_KEY,
  MAX_OPEN_POSITIONS,
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_TYPE,
  positionKey,
} from '@/types/portfolio';
import {
  calculateLiquidationPrice,
  calculateMargin,
  calculateUnrealizedPnl,
  calculateFee,
  calculateAverageEntry,
  isTakeProfitHit,
  isStopLossHit,
} from '@/utils/portfolioCalc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PortfolioStoreState {
  /** Wallet balance in USDT (cash not locked in margin) */
  walletBalance: number;
  /** Map of positionKey (symbol_side) → open futures position (hedge mode: 1 per symbol+side) */
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
   * Open a new futures position or add to existing same-direction position.
   * Hedge mode: long and short on the same symbol are independent positions.
   * Returns true if opened/averaged, false if rejected (insufficient balance
   * or max positions reached).
   */
  openPosition: (params: OpenPositionParams) => boolean;
  /**
   * Close a position partially or fully.
   * Returns true if closed, false if no position or insufficient quantity.
   */
  closePosition: (symbol: string, side: PositionSide, price: number, quantity: number) => boolean;
  /**
   * Check all positions for auto-close (liquidation, TP, SL).
   * Returns array of auto-close results with symbol and reason.
   */
  checkAutoClose: (prices: Map<string, number>) => AutoCloseResult[];
  /**
   * Update TP/SL prices for an existing position.
   * Returns true if updated, false if no position found.
   */
  updatePositionTpSl: (
    symbol: string,
    side: PositionSide,
    tp: number | null,
    sl: number | null,
  ) => boolean;
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
      // Backward compat: add TP/SL defaults for old data
      const restoredPos: FuturesPosition = {
        ...(p as unknown as FuturesPosition),
        takeProfitPrice: typeof p.takeProfitPrice === 'number' ? p.takeProfitPrice : null,
        stopLossPrice: typeof p.stopLossPrice === 'number' ? p.stopLossPrice : null,
      };
      positionsMap.set(positionKey(restoredPos.symbol, restoredPos.side), restoredPos);
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
        (t.closeReason === null ||
          t.closeReason === 'manual' ||
          t.closeReason === 'liquidated' ||
          t.closeReason === 'take-profit' ||
          t.closeReason === 'stop-loss') &&
        typeof t.timestamp === 'number'
      ) {
        // Backward compat: add fee default for old data
        const restoredTrade: FuturesTrade = {
          ...(t as unknown as FuturesTrade),
          fee: typeof t.fee === 'number' ? t.fee : 0,
        };
        trades.push(restoredTrade);
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
    const takeProfitPrice = params.takeProfitPrice ?? null;
    const stopLossPrice = params.stopLossPrice ?? null;

    // Validation
    if (price <= 0 || quantity <= 0 || leverage < 1) return false;

    const key = positionKey(symbol, side);
    const existing = state.positions.get(key);

    if (!existing && state.positions.size >= MAX_OPEN_POSITIONS) return false;

    const fee = calculateFee(price, quantity);

    const totalMarginUsed = [...state.positions.values()].reduce((sum, p) => sum + p.margin, 0);
    const availableBalance = state.walletBalance - totalMarginUsed;

    if (existing) {
      // Position averaging: same symbol, same direction
      const avgEntry = calculateAverageEntry(
        existing.entryPrice,
        existing.quantity,
        price,
        quantity,
      );
      const newQty = existing.quantity + quantity;
      const newMargin = calculateMargin(avgEntry, newQty, existing.leverage);
      const additionalMargin = newMargin - existing.margin;

      if (additionalMargin > availableBalance) return false;
      if (fee > state.walletBalance - totalMarginUsed) return false;

      const newLiqPrice = calculateLiquidationPrice(
        avgEntry,
        existing.leverage,
        existing.side,
        existing.marginType,
      );

      const updatedPosition: FuturesPosition = {
        ...existing,
        entryPrice: avgEntry,
        quantity: newQty,
        margin: newMargin,
        liquidationPrice: newLiqPrice,
        takeProfitPrice: takeProfitPrice ?? existing.takeProfitPrice,
        stopLossPrice: stopLossPrice ?? existing.stopLossPrice,
      };

      const trade: FuturesTrade = {
        id: generateTradeId(),
        symbol,
        side,
        action: 'open',
        price,
        quantity,
        leverage: existing.leverage,
        realizedPnl: 0,
        fee,
        closeReason: null,
        timestamp: Date.now(),
      };

      const newPositions = new Map(state.positions);
      newPositions.set(key, updatedPosition);
      const newTrades = [trade, ...state.trades].slice(0, MAX_TRADE_HISTORY);

      const newState = {
        walletBalance: state.walletBalance - fee,
        positions: newPositions,
        trades: newTrades,
      };

      set(newState);
      persistPortfolio({ ...state, ...newState });
      return true;
    }

    // New position
    const margin = calculateMargin(price, quantity, leverage);

    if (margin > availableBalance) return false;
    if (fee > state.walletBalance - totalMarginUsed) return false;

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
      takeProfitPrice,
      stopLossPrice,
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
      fee,
      closeReason: null,
      timestamp: Date.now(),
    };

    const newPositions = new Map(state.positions);
    newPositions.set(key, position);
    const newTrades = [trade, ...state.trades].slice(0, MAX_TRADE_HISTORY);

    const newState = {
      walletBalance: state.walletBalance - fee,
      positions: newPositions,
      trades: newTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return true;
  },

  closePosition: (symbol: string, side: PositionSide, price: number, quantity: number): boolean => {
    const state = get();
    const key = positionKey(symbol, side);
    const position = state.positions.get(key);

    if (!position) return false;
    if (price <= 0 || quantity <= 0) return false;
    if (quantity > position.quantity) return false;

    const isFullClose = Math.abs(quantity - position.quantity) < 1e-10;

    // Calculate realized PnL for the closed quantity, minus fee
    const rawPnl = calculateUnrealizedPnl(position.entryPrice, price, quantity, position.side);
    const fee = calculateFee(price, quantity);
    const realizedPnl = rawPnl - fee;

    // Wallet balance change: only add realized PnL (fee already deducted).
    // Margin was never deducted from wallet on open (it's "reserved"),
    // so we must NOT add it back on close — only the PnL delta matters.
    const newWalletBalance = Math.max(0, state.walletBalance + realizedPnl);

    // Update or remove position
    const newPositions = new Map(state.positions);
    if (isFullClose) {
      newPositions.delete(key);
    } else {
      const remainingRatio = (position.quantity - quantity) / position.quantity;
      newPositions.set(key, {
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
      fee,
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

  checkAutoClose: (prices: Map<string, number>): AutoCloseResult[] => {
    const state = get();
    const results: AutoCloseResult[] = [];

    const newPositions = new Map(state.positions);
    const newTrades = [...state.trades];
    let newWalletBalance = state.walletBalance;

    for (const [key, position] of state.positions) {
      const currentPrice = prices.get(position.symbol);
      if (currentPrice === undefined) continue;

      // 1. Liquidation check (highest priority)
      if (position.marginType === 'isolated') {
        const isLiq =
          (position.side === 'long' && currentPrice <= position.liquidationPrice) ||
          (position.side === 'short' && currentPrice >= position.liquidationPrice);

        if (isLiq) {
          newWalletBalance = Math.max(0, newWalletBalance - position.margin);
          newPositions.delete(key);

          newTrades.unshift({
            id: generateTradeId(),
            symbol: position.symbol,
            side: position.side,
            action: 'close',
            price: currentPrice,
            quantity: position.quantity,
            leverage: position.leverage,
            realizedPnl: -position.margin,
            fee: 0,
            closeReason: 'liquidated',
            timestamp: Date.now(),
          });

          results.push({ symbol: position.symbol, side: position.side, reason: 'liquidated' });
          continue;
        }
      }

      // 2. Take-profit check
      if (
        position.takeProfitPrice !== null &&
        isTakeProfitHit(currentPrice, position.takeProfitPrice, position.side)
      ) {
        const rawPnl = calculateUnrealizedPnl(
          position.entryPrice,
          currentPrice,
          position.quantity,
          position.side,
        );
        const fee = calculateFee(currentPrice, position.quantity);
        const realizedPnl = rawPnl - fee;

        newWalletBalance = Math.max(0, newWalletBalance + realizedPnl);
        newPositions.delete(key);

        newTrades.unshift({
          id: generateTradeId(),
          symbol: position.symbol,
          side: position.side,
          action: 'close',
          price: currentPrice,
          quantity: position.quantity,
          leverage: position.leverage,
          realizedPnl,
          fee,
          closeReason: 'take-profit',
          timestamp: Date.now(),
        });

        results.push({ symbol: position.symbol, side: position.side, reason: 'take-profit' });
        continue;
      }

      // 3. Stop-loss check
      if (
        position.stopLossPrice !== null &&
        isStopLossHit(currentPrice, position.stopLossPrice, position.side)
      ) {
        const rawPnl = calculateUnrealizedPnl(
          position.entryPrice,
          currentPrice,
          position.quantity,
          position.side,
        );
        const fee = calculateFee(currentPrice, position.quantity);
        const realizedPnl = rawPnl - fee;

        newWalletBalance = Math.max(0, newWalletBalance + realizedPnl);
        newPositions.delete(key);

        newTrades.unshift({
          id: generateTradeId(),
          symbol: position.symbol,
          side: position.side,
          action: 'close',
          price: currentPrice,
          quantity: position.quantity,
          leverage: position.leverage,
          realizedPnl,
          fee,
          closeReason: 'stop-loss',
          timestamp: Date.now(),
        });

        results.push({ symbol: position.symbol, side: position.side, reason: 'stop-loss' });
        continue;
      }
    }

    if (results.length === 0) return results;

    const cappedTrades = newTrades.slice(0, MAX_TRADE_HISTORY);
    const newState = {
      walletBalance: newWalletBalance,
      positions: newPositions,
      trades: cappedTrades,
    };

    set(newState);
    persistPortfolio({ ...state, ...newState });

    return results;
  },

  updatePositionTpSl: (
    symbol: string,
    side: PositionSide,
    tp: number | null,
    sl: number | null,
  ): boolean => {
    const state = get();
    const key = positionKey(symbol, side);
    const position = state.positions.get(key);
    if (!position) return false;

    const newPositions = new Map(state.positions);
    newPositions.set(key, {
      ...position,
      takeProfitPrice: tp,
      stopLossPrice: sl,
    });

    const newState = { positions: newPositions };
    set(newState);
    persistPortfolio({ ...state, ...newState });
    return true;
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
