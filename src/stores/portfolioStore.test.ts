import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { usePortfolioStore } from './portfolioStore';
import {
  INITIAL_CASH_BALANCE,
  PORTFOLIO_STORAGE_KEY,
  MAX_TRADE_HISTORY,
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_TYPE,
} from '@/types/portfolio';

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  usePortfolioStore.getState().reset();
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

// =============================================================================
// Initial State
// =============================================================================

describe('initial state', () => {
  it('starts with initial wallet balance', () => {
    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('starts with empty positions', () => {
    expect(usePortfolioStore.getState().positions.size).toBe(0);
  });

  it('starts with empty trades', () => {
    expect(usePortfolioStore.getState().trades).toEqual([]);
  });

  it('starts with positions tab active', () => {
    expect(usePortfolioStore.getState().activeTab).toBe('positions');
  });

  it('starts not hydrated', () => {
    expect(usePortfolioStore.getState().isHydrated).toBe(false);
  });

  it('starts with default leverage and margin type', () => {
    expect(usePortfolioStore.getState().defaultLeverage).toBe(DEFAULT_LEVERAGE);
    expect(usePortfolioStore.getState().defaultMarginType).toBe(DEFAULT_MARGIN_TYPE);
  });
});

// =============================================================================
// openPosition
// =============================================================================

describe('openPosition', () => {
  it('opens a long position and reserves margin', () => {
    const success = usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    expect(success).toBe(true);

    const pos = usePortfolioStore.getState().positions.get('BTCUSDT');
    expect(pos).toBeDefined();
    expect(pos?.side).toBe('long');
    expect(pos?.entryPrice).toBe(50000);
    expect(pos?.quantity).toBe(1);
    expect(pos?.leverage).toBe(10);
    expect(pos?.marginType).toBe('isolated');
    expect(pos?.margin).toBe(5000); // 50000 / 10
    expect(pos?.liquidationPrice).toBe(45000); // 50000 * (1 - 1/10)

    // Wallet balance should NOT change on open (margin is reserved, not deducted)
    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('opens a short position with correct liquidation price', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'short',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const pos = usePortfolioStore.getState().positions.get('BTCUSDT');
    expect(pos?.liquidationPrice).toBeCloseTo(55000, 5); // 50000 * (1 + 1/10)
  });

  it('records an open trade in history', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 0.5,
      leverage: 10,
      marginType: 'isolated',
    });

    const trades = usePortfolioStore.getState().trades;
    expect(trades).toHaveLength(1);
    expect(trades[0].symbol).toBe('BTCUSDT');
    expect(trades[0].side).toBe('long');
    expect(trades[0].action).toBe('open');
    expect(trades[0].price).toBe(50000);
    expect(trades[0].quantity).toBe(0.5);
    expect(trades[0].leverage).toBe(10);
    expect(trades[0].realizedPnl).toBe(0);
    expect(trades[0].closeReason).toBeNull();
    expect(trades[0].id).toMatch(/^futures-/);
  });

  it('returns false when same symbol already has a position', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const success = usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'short',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    expect(success).toBe(false);
    expect(usePortfolioStore.getState().positions.size).toBe(1);
  });

  it('returns false for insufficient available balance', () => {
    // Try to open a position that requires more margin than available
    const success = usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 100,
      leverage: 1,
      marginType: 'isolated',
    });

    expect(success).toBe(false);
    expect(usePortfolioStore.getState().positions.size).toBe(0);
  });

  it('returns false for zero quantity', () => {
    const success = usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 0,
      leverage: 10,
      marginType: 'isolated',
    });
    expect(success).toBe(false);
  });

  it('returns false for negative price', () => {
    const success = usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: -50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    expect(success).toBe(false);
  });

  it('returns false for leverage less than 1', () => {
    const success = usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 0,
      marginType: 'isolated',
    });
    expect(success).toBe(false);
  });

  it('persists to localstorage after opening', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored as string);
    expect(parsed.positions).toHaveLength(1);
    expect(parsed.trades).toHaveLength(1);
  });

  it('newest trade is first in history', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().openPosition({
      symbol: 'ETHUSDT',
      side: 'short',
      price: 3000,
      quantity: 5,
      leverage: 20,
      marginType: 'isolated',
    });

    const trades = usePortfolioStore.getState().trades;
    expect(trades[0].symbol).toBe('ETHUSDT');
    expect(trades[1].symbol).toBe('BTCUSDT');
  });

  it('handles cross margin position', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'cross',
    });

    const pos = usePortfolioStore.getState().positions.get('BTCUSDT');
    expect(pos?.marginType).toBe('cross');
    expect(pos?.liquidationPrice).toBe(0); // Cross long = 0
  });

  it('considers existing position margins when checking available balance', () => {
    // Open first position using most of the balance
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 1,
      marginType: 'isolated',
    });

    // Second position should fail because available balance = 100000 - 50000 = 50000
    const success = usePortfolioStore.getState().openPosition({
      symbol: 'ETHUSDT',
      side: 'long',
      price: 60000,
      quantity: 1,
      leverage: 1,
      marginType: 'isolated',
    });

    expect(success).toBe(false);
  });
});

// =============================================================================
// closePosition
// =============================================================================

describe('closePosition', () => {
  beforeEach(() => {
    // Open a long position: 1 BTC at $50,000, 10x leverage, margin = $5,000
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 2,
      leverage: 10,
      marginType: 'isolated',
    });
  });

  it('closes fully with profit and adds only realized pnl', () => {
    const initialBalance = usePortfolioStore.getState().walletBalance;
    const success = usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 2);

    expect(success).toBe(true);
    expect(usePortfolioStore.getState().positions.has('BTCUSDT')).toBe(false);

    // pnl = (55000 - 50000) * 2 = 10000
    // Margin was never deducted from wallet, so only pnl is added
    expect(usePortfolioStore.getState().walletBalance).toBe(initialBalance + 10000);
  });

  it('closes fully with loss', () => {
    const initialBalance = usePortfolioStore.getState().walletBalance;
    usePortfolioStore.getState().closePosition('BTCUSDT', 48000, 2);

    // pnl = (48000 - 50000) * 2 = -4000
    // Margin was never deducted, so only pnl is added (negative = loss)
    expect(usePortfolioStore.getState().walletBalance).toBe(initialBalance + -4000);
  });

  it('closes partially and reduces position proportionally', () => {
    usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 1);

    const pos = usePortfolioStore.getState().positions.get('BTCUSDT');
    expect(pos).toBeDefined();
    expect(pos?.quantity).toBe(1);
    expect(pos?.margin).toBe(5000); // Half of original 10000
  });

  it('records close trade with realized pnl', () => {
    usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 2);

    const trades = usePortfolioStore.getState().trades;
    const closeTrade = trades[0];
    expect(closeTrade.action).toBe('close');
    expect(closeTrade.side).toBe('long');
    expect(closeTrade.realizedPnl).toBe(10000);
    expect(closeTrade.closeReason).toBe('manual');
  });

  it('returns false when closing symbol not held', () => {
    const success = usePortfolioStore.getState().closePosition('ETHUSDT', 3000, 1);
    expect(success).toBe(false);
  });

  it('returns false when closing more than held', () => {
    const success = usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 3);
    expect(success).toBe(false);
  });

  it('returns false for zero quantity', () => {
    const success = usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 0);
    expect(success).toBe(false);
  });

  it('returns false for zero price', () => {
    const success = usePortfolioStore.getState().closePosition('BTCUSDT', 0, 1);
    expect(success).toBe(false);
  });

  it('persists to localstorage after close', () => {
    usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 2);

    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    expect(stored).toBeTruthy();
  });

  it('closes short position with correct pnl', () => {
    // Reset and open short position
    usePortfolioStore.getState().reset();
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'short',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const initialBalance = usePortfolioStore.getState().walletBalance;
    usePortfolioStore.getState().closePosition('BTCUSDT', 45000, 1);

    // Short PnL = (50000 - 45000) * 1 = 5000 (profit)
    // Margin was never deducted, so only pnl is added
    expect(usePortfolioStore.getState().walletBalance).toBe(initialBalance + 5000);
  });
});

// =============================================================================
// checkLiquidations
// =============================================================================

describe('checkLiquidations', () => {
  it('liquidates long position when price drops to liquidation price', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const initialBalance = usePortfolioStore.getState().walletBalance;
    const prices = new Map([['BTCUSDT', 45000]]);
    const liquidated = usePortfolioStore.getState().checkLiquidations(prices);

    expect(liquidated).toEqual(['BTCUSDT']);
    expect(usePortfolioStore.getState().positions.has('BTCUSDT')).toBe(false);

    // Liquidation: lose entire margin
    expect(usePortfolioStore.getState().walletBalance).toBe(initialBalance - 5000);
  });

  it('liquidates short position when price rises above liquidation price', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'short',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    // Liq price ≈ 55000; use price clearly above it
    const prices = new Map([['BTCUSDT', 55001]]);
    const liquidated = usePortfolioStore.getState().checkLiquidations(prices);

    expect(liquidated).toEqual(['BTCUSDT']);
  });

  it('records liquidation trade with correct details', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const prices = new Map([['BTCUSDT', 44000]]);
    usePortfolioStore.getState().checkLiquidations(prices);

    const trades = usePortfolioStore.getState().trades;
    const liqTrade = trades[0];
    expect(liqTrade.action).toBe('close');
    expect(liqTrade.closeReason).toBe('liquidated');
    expect(liqTrade.realizedPnl).toBe(-5000);
    expect(liqTrade.price).toBe(44000);
  });

  it('returns empty array when no positions are liquidatable', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const prices = new Map([['BTCUSDT', 48000]]);
    const liquidated = usePortfolioStore.getState().checkLiquidations(prices);

    expect(liquidated).toEqual([]);
    expect(usePortfolioStore.getState().positions.has('BTCUSDT')).toBe(true);
  });

  it('does not liquidate cross margin positions', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'cross',
    });

    const prices = new Map([['BTCUSDT', 1000]]);
    const liquidated = usePortfolioStore.getState().checkLiquidations(prices);

    expect(liquidated).toEqual([]);
  });

  it('skips symbols without price data', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    const liquidated = usePortfolioStore.getState().checkLiquidations(new Map());
    expect(liquidated).toEqual([]);
  });

  it('liquidates multiple positions at once', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().openPosition({
      symbol: 'ETHUSDT',
      side: 'long',
      price: 3000,
      quantity: 10,
      leverage: 10,
      marginType: 'isolated',
    });

    const prices = new Map([
      ['BTCUSDT', 44000], // Below liq price 45000
      ['ETHUSDT', 2600], // Below liq price 2700
    ]);
    const liquidated = usePortfolioStore.getState().checkLiquidations(prices);

    expect(liquidated).toHaveLength(2);
    expect(usePortfolioStore.getState().positions.size).toBe(0);
  });
});

// =============================================================================
// setDefaultLeverage / setDefaultMarginType
// =============================================================================

describe('setDefaultLeverage', () => {
  it('updates default leverage', () => {
    usePortfolioStore.getState().setDefaultLeverage(25);
    expect(usePortfolioStore.getState().defaultLeverage).toBe(25);
  });

  it('rejects leverage less than 1', () => {
    usePortfolioStore.getState().setDefaultLeverage(0);
    expect(usePortfolioStore.getState().defaultLeverage).toBe(DEFAULT_LEVERAGE);
  });
});

describe('setDefaultMarginType', () => {
  it('updates default margin type', () => {
    usePortfolioStore.getState().setDefaultMarginType('cross');
    expect(usePortfolioStore.getState().defaultMarginType).toBe('cross');
  });
});

// =============================================================================
// setActiveTab
// =============================================================================

describe('setActiveTab', () => {
  it('switches active tab', () => {
    usePortfolioStore.getState().setActiveTab('history');
    expect(usePortfolioStore.getState().activeTab).toBe('history');

    usePortfolioStore.getState().setActiveTab('positions');
    expect(usePortfolioStore.getState().activeTab).toBe('positions');
  });
});

// =============================================================================
// resetPortfolio
// =============================================================================

describe('resetPortfolio', () => {
  it('resets wallet to initial balance', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('clears all positions', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().positions.size).toBe(0);
  });

  it('clears trade history', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().trades).toEqual([]);
  });

  it('removes data from localstorage', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeTruthy();

    usePortfolioStore.getState().resetPortfolio();
    expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();
  });
});

// =============================================================================
// hydratePortfolio
// =============================================================================

describe('hydratePortfolio', () => {
  it('restores portfolio from localstorage', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().openPosition({
      symbol: 'ETHUSDT',
      side: 'short',
      price: 3000,
      quantity: 5,
      leverage: 20,
      marginType: 'isolated',
    });

    // Reset store (simulates app restart)
    usePortfolioStore.getState().reset();
    expect(usePortfolioStore.getState().positions.size).toBe(0);

    // Hydrate from localStorage
    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
    expect(usePortfolioStore.getState().positions.size).toBe(2);
    expect(usePortfolioStore.getState().positions.get('BTCUSDT')?.side).toBe('long');
    expect(usePortfolioStore.getState().positions.get('ETHUSDT')?.side).toBe('short');
    expect(usePortfolioStore.getState().trades).toHaveLength(2);
  });

  it('sets isHydrated true even without saved data', () => {
    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('handles corrupted localstorage gracefully', () => {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, 'not-json');

    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('handles missing fields in persisted data', () => {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ walletBalance: 'not-a-number' }));

    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().walletBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('handles empty positions array', () => {
    localStorage.setItem(
      PORTFOLIO_STORAGE_KEY,
      JSON.stringify({
        walletBalance: 50000,
        positions: [],
        trades: [],
        defaultLeverage: 10,
        defaultMarginType: 'isolated',
      }),
    );

    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().walletBalance).toBe(50000);
    expect(usePortfolioStore.getState().positions.size).toBe(0);
  });

  it('restores default leverage and margin type', () => {
    // setDefaultLeverage/setDefaultMarginType now persist independently
    usePortfolioStore.getState().setDefaultLeverage(50);
    usePortfolioStore.getState().setDefaultMarginType('cross');

    // Also open a position so there's richer persisted data
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });

    usePortfolioStore.getState().reset();
    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().defaultLeverage).toBe(50);
    expect(usePortfolioStore.getState().defaultMarginType).toBe('cross');
  });
});

// =============================================================================
// Trade History Cap
// =============================================================================

describe('trade history cap', () => {
  it('caps trade history at max_trade_history', () => {
    for (let i = 0; i < MAX_TRADE_HISTORY + 10; i++) {
      // Open and close to generate 2 trades per iteration
      usePortfolioStore.getState().openPosition({
        symbol: `SYM${i}USDT`,
        side: 'long',
        price: 100,
        quantity: 0.001,
        leverage: 10,
        marginType: 'isolated',
      });
    }

    expect(usePortfolioStore.getState().trades.length).toBeLessThanOrEqual(MAX_TRADE_HISTORY);
  });
});

// =============================================================================
// reset
// =============================================================================

describe('reset', () => {
  it('restores all state to initial values', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().setActiveTab('history');
    usePortfolioStore.getState().setDefaultLeverage(50);

    usePortfolioStore.getState().reset();

    const state = usePortfolioStore.getState();
    expect(state.walletBalance).toBe(INITIAL_CASH_BALANCE);
    expect(state.positions.size).toBe(0);
    expect(state.trades).toEqual([]);
    expect(state.activeTab).toBe('positions');
    expect(state.isHydrated).toBe(false);
    expect(state.defaultLeverage).toBe(DEFAULT_LEVERAGE);
    expect(state.defaultMarginType).toBe(DEFAULT_MARGIN_TYPE);
  });
});

// =============================================================================
// Multiple Symbols
// =============================================================================

describe('multiple symbols', () => {
  it('manages positions for different symbols independently', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 0.5,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().openPosition({
      symbol: 'ETHUSDT',
      side: 'short',
      price: 3000,
      quantity: 5,
      leverage: 20,
      marginType: 'isolated',
    });

    expect(usePortfolioStore.getState().positions.size).toBe(2);
    expect(usePortfolioStore.getState().positions.get('BTCUSDT')?.side).toBe('long');
    expect(usePortfolioStore.getState().positions.get('ETHUSDT')?.side).toBe('short');
  });

  it('closing one position does not affect another', () => {
    usePortfolioStore.getState().openPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      price: 50000,
      quantity: 1,
      leverage: 10,
      marginType: 'isolated',
    });
    usePortfolioStore.getState().openPosition({
      symbol: 'ETHUSDT',
      side: 'short',
      price: 3000,
      quantity: 5,
      leverage: 20,
      marginType: 'isolated',
    });

    usePortfolioStore.getState().closePosition('BTCUSDT', 55000, 1);

    expect(usePortfolioStore.getState().positions.has('BTCUSDT')).toBe(false);
    expect(usePortfolioStore.getState().positions.get('ETHUSDT')?.quantity).toBe(5);
  });
});
