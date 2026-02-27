import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { usePortfolioStore } from './portfolioStore';
import { INITIAL_CASH_BALANCE, PORTFOLIO_STORAGE_KEY, MAX_TRADE_HISTORY } from '@/types/portfolio';

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
  it('starts with initial cash balance', () => {
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('starts with empty holdings', () => {
    expect(usePortfolioStore.getState().holdings.size).toBe(0);
  });

  it('starts with empty trades', () => {
    expect(usePortfolioStore.getState().trades).toEqual([]);
  });

  it('starts with holdings tab active', () => {
    expect(usePortfolioStore.getState().activeTab).toBe('holdings');
  });

  it('starts not hydrated', () => {
    expect(usePortfolioStore.getState().isHydrated).toBe(false);
  });
});

// =============================================================================
// executeBuy
// =============================================================================

describe('executeBuy', () => {
  it('creates a new holding and deducts cash', () => {
    const success = usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);

    expect(success).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(50000);

    const holding = usePortfolioStore.getState().holdings.get('BTCUSDT');
    expect(holding).toBeDefined();
    expect(holding?.quantity).toBe(1);
    expect(holding?.avgEntryPrice).toBe(50000);
    expect(holding?.costBasis).toBe(50000);
  });

  it('adds to existing holding with correct weighted average', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 40000, 1);
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);

    const holding = usePortfolioStore.getState().holdings.get('BTCUSDT');
    expect(holding?.quantity).toBe(2);
    expect(holding?.avgEntryPrice).toBe(45000); // (40000 + 50000) / 2
    expect(holding?.costBasis).toBe(90000);
  });

  it('records the trade in history', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 0.5);

    const trades = usePortfolioStore.getState().trades;
    expect(trades).toHaveLength(1);
    expect(trades[0].symbol).toBe('BTCUSDT');
    expect(trades[0].side).toBe('buy');
    expect(trades[0].price).toBe(50000);
    expect(trades[0].quantity).toBe(0.5);
    expect(trades[0].notional).toBe(25000);
    expect(trades[0].id).toMatch(/^portfolio-/);
  });

  it('returns false for insufficient cash', () => {
    const success = usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 3);

    expect(success).toBe(false);
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE);
    expect(usePortfolioStore.getState().holdings.size).toBe(0);
  });

  it('returns false for zero quantity', () => {
    const success = usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 0);
    expect(success).toBe(false);
  });

  it('returns false for negative price', () => {
    const success = usePortfolioStore.getState().executeBuy('BTCUSDT', -50000, 1);
    expect(success).toBe(false);
  });

  it('handles fractional quantities', () => {
    const success = usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 0.001);

    expect(success).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE - 50);
    expect(usePortfolioStore.getState().holdings.get('BTCUSDT')?.quantity).toBe(0.001);
  });

  it('persists to localstorage after buy', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);

    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored as string);
    expect(parsed.cashBalance).toBe(50000);
    expect(parsed.holdings).toHaveLength(1);
    expect(parsed.trades).toHaveLength(1);
  });

  it('newest trade is first in history', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 0.5);
    usePortfolioStore.getState().executeBuy('ETHUSDT', 3000, 5);

    const trades = usePortfolioStore.getState().trades;
    expect(trades[0].symbol).toBe('ETHUSDT');
    expect(trades[1].symbol).toBe('BTCUSDT');
  });
});

// =============================================================================
// executeSell
// =============================================================================

describe('executeSell', () => {
  beforeEach(() => {
    // Buy 2 BTC at $50k
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 2);
  });

  it('reduces holding and adds cash on partial sell', () => {
    const success = usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 1);

    expect(success).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(60000); // 0 + 60000
    expect(usePortfolioStore.getState().holdings.get('BTCUSDT')?.quantity).toBe(1);
  });

  it('removes holding completely on full sell', () => {
    usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 2);

    expect(usePortfolioStore.getState().holdings.has('BTCUSDT')).toBe(false);
    expect(usePortfolioStore.getState().holdings.size).toBe(0);
  });

  it('records sell trade in history', () => {
    usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 1);

    const trades = usePortfolioStore.getState().trades;
    const sellTrade = trades[0];
    expect(sellTrade.side).toBe('sell');
    expect(sellTrade.notional).toBe(60000);
  });

  it('returns false when selling symbol not held', () => {
    const success = usePortfolioStore.getState().executeSell('ETHUSDT', 3000, 1);
    expect(success).toBe(false);
  });

  it('returns false when selling more than held', () => {
    const success = usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 3);
    expect(success).toBe(false);
  });

  it('returns false for zero quantity', () => {
    const success = usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 0);
    expect(success).toBe(false);
  });

  it('maintains avgentryprice after partial sell', () => {
    usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 1);

    const holding = usePortfolioStore.getState().holdings.get('BTCUSDT');
    expect(holding?.avgEntryPrice).toBe(50000);
  });

  it('reduces cost basis proportionally on partial sell', () => {
    usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 1);

    const holding = usePortfolioStore.getState().holdings.get('BTCUSDT');
    expect(holding?.costBasis).toBe(50000); // 100000 * (1/2)
  });

  it('persists to localstorage after sell', () => {
    usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 1);

    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    expect(stored).toBeTruthy();
  });
});

// =============================================================================
// setActiveTab
// =============================================================================

describe('setActiveTab', () => {
  it('switches active tab', () => {
    usePortfolioStore.getState().setActiveTab('history');
    expect(usePortfolioStore.getState().activeTab).toBe('history');

    usePortfolioStore.getState().setActiveTab('holdings');
    expect(usePortfolioStore.getState().activeTab).toBe('holdings');
  });
});

// =============================================================================
// resetPortfolio
// =============================================================================

describe('resetPortfolio', () => {
  it('resets cash to initial balance', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('clears all holdings', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().holdings.size).toBe(0);
  });

  it('clears trade history', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().trades).toEqual([]);
  });

  it('removes data from localstorage', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
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
    // Execute some trades to populate localStorage
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
    usePortfolioStore.getState().executeBuy('ETHUSDT', 3000, 5);

    // Reset store (simulates app restart)
    usePortfolioStore.getState().reset();
    expect(usePortfolioStore.getState().holdings.size).toBe(0);

    // Hydrate from localStorage
    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE - 50000 - 15000);
    expect(usePortfolioStore.getState().holdings.size).toBe(2);
    expect(usePortfolioStore.getState().holdings.get('BTCUSDT')?.quantity).toBe(1);
    expect(usePortfolioStore.getState().holdings.get('ETHUSDT')?.quantity).toBe(5);
    expect(usePortfolioStore.getState().trades).toHaveLength(2);
  });

  it('sets ishhdrated true even without saved data', () => {
    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('handles corrupted localstorage gracefully', () => {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, 'not-json');

    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('handles missing fields in persisted data', () => {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ cashBalance: 'not-a-number' }));

    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().isHydrated).toBe(true);
    expect(usePortfolioStore.getState().cashBalance).toBe(INITIAL_CASH_BALANCE);
  });

  it('handles empty holdings array', () => {
    localStorage.setItem(
      PORTFOLIO_STORAGE_KEY,
      JSON.stringify({ cashBalance: 50000, holdings: [], trades: [] }),
    );

    usePortfolioStore.getState().hydratePortfolio();

    expect(usePortfolioStore.getState().cashBalance).toBe(50000);
    expect(usePortfolioStore.getState().holdings.size).toBe(0);
  });
});

// =============================================================================
// Trade History Cap
// =============================================================================

describe('trade history cap', () => {
  it('caps trade history at max_trade_history', () => {
    // Fill up trade history beyond the cap
    for (let i = 0; i < MAX_TRADE_HISTORY + 10; i++) {
      usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 0.0001);
    }

    expect(usePortfolioStore.getState().trades.length).toBeLessThanOrEqual(MAX_TRADE_HISTORY);
  });
});

// =============================================================================
// reset
// =============================================================================

describe('reset', () => {
  it('restores all state to initial values', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
    usePortfolioStore.getState().setActiveTab('history');

    usePortfolioStore.getState().reset();

    const state = usePortfolioStore.getState();
    expect(state.cashBalance).toBe(INITIAL_CASH_BALANCE);
    expect(state.holdings.size).toBe(0);
    expect(state.trades).toEqual([]);
    expect(state.activeTab).toBe('holdings');
    expect(state.isHydrated).toBe(false);
  });
});

// =============================================================================
// Multiple Symbols
// =============================================================================

describe('multiple symbols', () => {
  it('manages holdings for different symbols independently', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 0.5);
    usePortfolioStore.getState().executeBuy('ETHUSDT', 3000, 5);

    expect(usePortfolioStore.getState().holdings.size).toBe(2);
    expect(usePortfolioStore.getState().holdings.get('BTCUSDT')?.quantity).toBe(0.5);
    expect(usePortfolioStore.getState().holdings.get('ETHUSDT')?.quantity).toBe(5);
  });

  it('selling one symbol does not affect another', () => {
    usePortfolioStore.getState().executeBuy('BTCUSDT', 50000, 1);
    usePortfolioStore.getState().executeBuy('ETHUSDT', 3000, 5);

    usePortfolioStore.getState().executeSell('BTCUSDT', 60000, 1);

    expect(usePortfolioStore.getState().holdings.has('BTCUSDT')).toBe(false);
    expect(usePortfolioStore.getState().holdings.get('ETHUSDT')?.quantity).toBe(5);
  });
});
