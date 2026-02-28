// =============================================================================
// Spot Portfolio Store Tests
// =============================================================================

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { useSpotStore } from './spotStore';
import {
  SPOT_INITIAL_BALANCE,
  SPOT_FEE_RATE,
  SPOT_STORAGE_KEY,
  SPOT_MAX_HOLDINGS,
} from '@/types/spot';

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
  removeItem: vi.fn((key: string) => mockStorage.delete(key)),
});

beforeEach(() => {
  useSpotStore.getState().reset();
  mockStorage.clear();
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

describe('initial state', () => {
  it('starts with correct initial balance', () => {
    expect(useSpotStore.getState().walletBalance).toBe(SPOT_INITIAL_BALANCE);
  });

  it('starts with empty holdings', () => {
    expect(useSpotStore.getState().holdings.size).toBe(0);
  });

  it('starts with empty trades', () => {
    expect(useSpotStore.getState().trades).toHaveLength(0);
  });

  it('starts with holdings tab active', () => {
    expect(useSpotStore.getState().activeTab).toBe('holdings');
  });

  it('starts unhydrated', () => {
    expect(useSpotStore.getState().isHydrated).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// buyAsset
// -----------------------------------------------------------------------------

describe('buyAsset', () => {
  it('buys a new asset successfully', () => {
    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });

    expect(result).toBe(true);

    const state = useSpotStore.getState();
    const holding = state.holdings.get('BTCUSDT');
    expect(holding).toBeDefined();
    expect(holding?.avgEntryPrice).toBe(90_000_000);
    expect(holding?.quantity).toBe(0.1);
    expect(holding?.costBasis).toBe(9_000_000);

    // Fee: 9M * 0.0005 = 4,500
    const expectedFee = 9_000_000 * SPOT_FEE_RATE;
    expect(state.walletBalance).toBeCloseTo(SPOT_INITIAL_BALANCE - 9_000_000 - expectedFee);
  });

  it('records a buy trade', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });

    const trades = useSpotStore.getState().trades;
    expect(trades).toHaveLength(1);
    expect(trades[0].action).toBe('buy');
    expect(trades[0].symbol).toBe('BTCUSDT');
    expect(trades[0].realizedPnl).toBe(0);
    expect(trades[0].fee).toBeCloseTo(4_500);
  });

  it('averages entry price when buying more of same asset', () => {
    const store = useSpotStore.getState();

    // Buy at 90M
    store.buyAsset({ symbol: 'BTCUSDT', price: 90_000_000, quantity: 0.1 });
    // Buy at 100M
    useSpotStore.getState().buyAsset({ symbol: 'BTCUSDT', price: 100_000_000, quantity: 0.1 });

    const holding = useSpotStore.getState().holdings.get('BTCUSDT');
    expect(holding?.quantity).toBeCloseTo(0.2);
    // avg = (90M * 0.1 + 100M * 0.1) / 0.2 = 95M
    expect(holding?.avgEntryPrice).toBeCloseTo(95_000_000);
    expect(holding?.costBasis).toBeCloseTo(19_000_000);
  });

  it('rejects buy with insufficient balance', () => {
    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 2, // 180M + fee > 100M balance
    });

    expect(result).toBe(false);
    expect(useSpotStore.getState().holdings.size).toBe(0);
    expect(useSpotStore.getState().walletBalance).toBe(SPOT_INITIAL_BALANCE);
  });

  it('rejects buy with zero price', () => {
    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 0,
      quantity: 0.1,
    });
    expect(result).toBe(false);
  });

  it('rejects buy with zero quantity', () => {
    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0,
    });
    expect(result).toBe(false);
  });

  it('rejects buy with negative price', () => {
    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: -1,
      quantity: 0.1,
    });
    expect(result).toBe(false);
  });

  it('rejects buy with negative quantity', () => {
    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: -0.1,
    });
    expect(result).toBe(false);
  });

  it('rejects buy when max holdings reached for new symbol', () => {
    // Fill up to SPOT_MAX_HOLDINGS
    for (let i = 0; i < SPOT_MAX_HOLDINGS; i++) {
      useSpotStore.getState().buyAsset({
        symbol: `SYM${i}USDT`,
        price: 1_000,
        quantity: 1,
      });
    }

    // Try to add one more new symbol
    const result = useSpotStore.getState().buyAsset({
      symbol: 'NEWUSDT',
      price: 1_000,
      quantity: 1,
    });
    expect(result).toBe(false);
  });

  it('allows buying more of existing symbol at max holdings', () => {
    for (let i = 0; i < SPOT_MAX_HOLDINGS; i++) {
      useSpotStore.getState().buyAsset({
        symbol: `SYM${i}USDT`,
        price: 1_000,
        quantity: 1,
      });
    }

    // Buy more of existing symbol — should succeed
    const result = useSpotStore.getState().buyAsset({
      symbol: 'SYM0USDT',
      price: 1_000,
      quantity: 1,
    });
    expect(result).toBe(true);
  });

  it('persists to localStorage after buy', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(SPOT_STORAGE_KEY, expect.any(String));
  });

  it('deducts exact totalCost + fee from wallet', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 10_000_000,
      quantity: 0.5,
    });

    // totalCost = 10M * 0.5 = 5M
    // fee = 5M * 0.0005 = 2,500
    // wallet = 100M - 5M - 2,500 = 94,997,500
    expect(useSpotStore.getState().walletBalance).toBeCloseTo(94_997_500);
  });
});

// -----------------------------------------------------------------------------
// sellAsset
// -----------------------------------------------------------------------------

describe('sellAsset', () => {
  beforeEach(() => {
    // Buy some BTC first
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
  });

  it('sells an asset with profit', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.1,
    });

    expect(result).toBe(true);
    expect(useSpotStore.getState().holdings.has('BTCUSDT')).toBe(false);
  });

  it('records correct realized PnL on sell', () => {
    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.1,
    });

    const trades = useSpotStore.getState().trades;
    const sellTrade = trades.find((t) => t.action === 'sell');
    expect(sellTrade).toBeDefined();

    // rawPnl = (100M - 90M) * 0.1 = 1M
    // fee = 100M * 0.1 * 0.0005 = 5,000
    // realizedPnl = 1M - 5,000 = 995,000
    expect(sellTrade?.realizedPnl).toBeCloseTo(995_000);
  });

  it('adds proceeds minus fee to wallet', () => {
    const balanceBeforeSell = useSpotStore.getState().walletBalance;

    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.1,
    });

    // proceeds = 100M * 0.1 = 10M
    // fee = 10M * 0.0005 = 5,000
    // wallet += 10M - 5,000 = 9,995,000
    expect(useSpotStore.getState().walletBalance).toBeCloseTo(balanceBeforeSell + 9_995_000);
  });

  it('sells with a loss', () => {
    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 80_000_000,
      quantity: 0.1,
    });

    const sellTrade = useSpotStore.getState().trades.find((t) => t.action === 'sell');
    // rawPnl = (80M - 90M) * 0.1 = -1M
    // fee = 80M * 0.1 * 0.0005 = 4,000
    // realizedPnl = -1M - 4,000 = -1,004,000
    expect(sellTrade?.realizedPnl).toBeCloseTo(-1_004_000);
  });

  it('partially sells a holding', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.05,
    });

    expect(result).toBe(true);
    const holding = useSpotStore.getState().holdings.get('BTCUSDT');
    expect(holding).toBeDefined();
    expect(holding?.quantity).toBeCloseTo(0.05);
    // avgEntryPrice stays the same
    expect(holding?.avgEntryPrice).toBe(90_000_000);
    // costBasis = 90M * 0.05
    expect(holding?.costBasis).toBeCloseTo(4_500_000);
  });

  it('rejects sell of non-existent holding', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'ETHUSDT',
      price: 4_000_000,
      quantity: 1,
    });
    expect(result).toBe(false);
  });

  it('rejects sell with quantity exceeding holding', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.2, // only have 0.1
    });
    expect(result).toBe(false);
  });

  it('rejects sell with zero price', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 0,
      quantity: 0.1,
    });
    expect(result).toBe(false);
  });

  it('rejects sell with zero quantity', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0,
    });
    expect(result).toBe(false);
  });

  it('rejects sell with negative price', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: -1,
      quantity: 0.1,
    });
    expect(result).toBe(false);
  });

  it('rejects sell with negative quantity', () => {
    const result = useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: -0.1,
    });
    expect(result).toBe(false);
  });

  it('removes holding completely on full sell', () => {
    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.1,
    });

    expect(useSpotStore.getState().holdings.has('BTCUSDT')).toBe(false);
    expect(useSpotStore.getState().holdings.size).toBe(0);
  });

  it('persists to localStorage after sell', () => {
    vi.clearAllMocks();
    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.1,
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(SPOT_STORAGE_KEY, expect.any(String));
  });
});

// -----------------------------------------------------------------------------
// setActiveTab
// -----------------------------------------------------------------------------

describe('setActiveTab', () => {
  it('switches to history tab', () => {
    useSpotStore.getState().setActiveTab('history');
    expect(useSpotStore.getState().activeTab).toBe('history');
  });

  it('switches back to holdings tab', () => {
    useSpotStore.getState().setActiveTab('history');
    useSpotStore.getState().setActiveTab('holdings');
    expect(useSpotStore.getState().activeTab).toBe('holdings');
  });
});

// -----------------------------------------------------------------------------
// resetSpot
// -----------------------------------------------------------------------------

describe('resetSpot', () => {
  it('resets wallet balance to initial', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
    useSpotStore.getState().resetSpot();

    expect(useSpotStore.getState().walletBalance).toBe(SPOT_INITIAL_BALANCE);
  });

  it('clears holdings', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
    useSpotStore.getState().resetSpot();

    expect(useSpotStore.getState().holdings.size).toBe(0);
  });

  it('clears trades', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
    useSpotStore.getState().resetSpot();

    expect(useSpotStore.getState().trades).toHaveLength(0);
  });

  it('removes from localStorage', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
    vi.clearAllMocks();
    useSpotStore.getState().resetSpot();

    expect(localStorage.removeItem).toHaveBeenCalledWith(SPOT_STORAGE_KEY);
  });
});

// -----------------------------------------------------------------------------
// hydrateSpot
// -----------------------------------------------------------------------------

describe('hydrateSpot', () => {
  it('sets isHydrated to true', () => {
    useSpotStore.getState().hydrateSpot();
    expect(useSpotStore.getState().isHydrated).toBe(true);
  });

  it('loads persisted data from localStorage', () => {
    const persisted = {
      walletBalance: 80_000_000,
      holdings: [
        [
          'BTCUSDT',
          {
            symbol: 'BTCUSDT',
            avgEntryPrice: 90_000_000,
            quantity: 0.1,
            costBasis: 9_000_000,
            firstBoughtAt: 1700000000000,
          },
        ],
      ],
      trades: [
        {
          id: 'spot-123-abc',
          symbol: 'BTCUSDT',
          action: 'buy',
          price: 90_000_000,
          quantity: 0.1,
          fee: 4500,
          realizedPnl: 0,
          timestamp: 1700000000000,
        },
      ],
    };

    mockStorage.set(SPOT_STORAGE_KEY, JSON.stringify(persisted));
    useSpotStore.getState().hydrateSpot();

    const state = useSpotStore.getState();
    expect(state.walletBalance).toBe(80_000_000);
    expect(state.holdings.size).toBe(1);
    expect(state.holdings.get('BTCUSDT')?.quantity).toBe(0.1);
    expect(state.trades).toHaveLength(1);
    expect(state.isHydrated).toBe(true);
  });

  it('handles missing localStorage gracefully', () => {
    useSpotStore.getState().hydrateSpot();

    expect(useSpotStore.getState().walletBalance).toBe(SPOT_INITIAL_BALANCE);
    expect(useSpotStore.getState().isHydrated).toBe(true);
  });

  it('handles corrupted localStorage', () => {
    mockStorage.set(SPOT_STORAGE_KEY, 'not-valid-json{{{');
    useSpotStore.getState().hydrateSpot();

    expect(useSpotStore.getState().walletBalance).toBe(SPOT_INITIAL_BALANCE);
    expect(useSpotStore.getState().isHydrated).toBe(true);
  });

  it('handles invalid data structure in localStorage', () => {
    mockStorage.set(SPOT_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    useSpotStore.getState().hydrateSpot();

    expect(useSpotStore.getState().walletBalance).toBe(SPOT_INITIAL_BALANCE);
    expect(useSpotStore.getState().isHydrated).toBe(true);
  });

  it('skips invalid holdings entries', () => {
    const persisted = {
      walletBalance: 80_000_000,
      holdings: [
        ['BTCUSDT', { symbol: 'BTCUSDT' }], // Missing fields
        [
          'ETHUSDT',
          {
            symbol: 'ETHUSDT',
            avgEntryPrice: 3_000_000,
            quantity: 1,
            costBasis: 3_000_000,
            firstBoughtAt: 1700000000000,
          },
        ],
      ],
      trades: [],
    };

    mockStorage.set(SPOT_STORAGE_KEY, JSON.stringify(persisted));
    useSpotStore.getState().hydrateSpot();

    expect(useSpotStore.getState().holdings.size).toBe(1);
    expect(useSpotStore.getState().holdings.has('ETHUSDT')).toBe(true);
  });

  it('skips invalid trade entries', () => {
    const persisted = {
      walletBalance: 80_000_000,
      holdings: [],
      trades: [
        { id: 'bad-trade' }, // Missing fields
        {
          id: 'spot-123-abc',
          symbol: 'BTCUSDT',
          action: 'buy',
          price: 90_000_000,
          quantity: 0.1,
          fee: 4500,
          realizedPnl: 0,
          timestamp: 1700000000000,
        },
      ],
    };

    mockStorage.set(SPOT_STORAGE_KEY, JSON.stringify(persisted));
    useSpotStore.getState().hydrateSpot();

    expect(useSpotStore.getState().trades).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// reset (test utility)
// -----------------------------------------------------------------------------

describe('reset', () => {
  it('restores all state to initial values', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
    useSpotStore.getState().setActiveTab('history');

    useSpotStore.getState().reset();

    const state = useSpotStore.getState();
    expect(state.walletBalance).toBe(SPOT_INITIAL_BALANCE);
    expect(state.holdings.size).toBe(0);
    expect(state.trades).toHaveLength(0);
    expect(state.activeTab).toBe('holdings');
    expect(state.isHydrated).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Trade history capping
// -----------------------------------------------------------------------------

describe('trade history capping', () => {
  it('caps trades at SPOT_MAX_TRADE_HISTORY', () => {
    // Buy many times (exceeds 200 cap)
    for (let i = 0; i < 210; i++) {
      useSpotStore.getState().buyAsset({
        symbol: 'BTCUSDT',
        price: 1_000,
        quantity: 0.001,
      });
    }

    expect(useSpotStore.getState().trades.length).toBeLessThanOrEqual(200);
  });

  it('newest trades are first', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.01,
    });
    useSpotStore.getState().buyAsset({
      symbol: 'ETHUSDT',
      price: 3_000_000,
      quantity: 0.1,
    });

    const trades = useSpotStore.getState().trades;
    expect(trades[0].symbol).toBe('ETHUSDT');
    expect(trades[1].symbol).toBe('BTCUSDT');
  });
});

// -----------------------------------------------------------------------------
// Edge cases
// -----------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles buying nearly all wallet balance', () => {
    // Buy an amount that uses most of the wallet (leaving small remainder)
    const price = 10_000;
    // Use 99% of max affordable quantity to avoid floating-point edge
    const maxCost = SPOT_INITIAL_BALANCE / (1 + SPOT_FEE_RATE);
    const qty = (maxCost / price) * 0.99;

    const result = useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price,
      quantity: qty,
    });

    expect(result).toBe(true);
    expect(useSpotStore.getState().walletBalance).toBeGreaterThanOrEqual(0);
    expect(useSpotStore.getState().walletBalance).toBeLessThan(SPOT_INITIAL_BALANCE * 0.02);
  });

  it('buy and sell roundtrip preserves approximate value', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });
    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });

    // Should lose approximately 2 * fee (buy fee + sell fee)
    // Buy fee: 9M * 0.0005 = 4,500
    // Sell fee: 9M * 0.0005 = 4,500
    // Total fees: 9,000
    const expectedBalance = SPOT_INITIAL_BALANCE - 9_000;
    expect(useSpotStore.getState().walletBalance).toBeCloseTo(expectedBalance);
  });

  it('multiple partial sells decrease holding correctly', () => {
    useSpotStore.getState().buyAsset({
      symbol: 'BTCUSDT',
      price: 90_000_000,
      quantity: 0.1,
    });

    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.03,
    });
    useSpotStore.getState().sellAsset({
      symbol: 'BTCUSDT',
      price: 100_000_000,
      quantity: 0.03,
    });

    const holding = useSpotStore.getState().holdings.get('BTCUSDT');
    expect(holding?.quantity).toBeCloseTo(0.04);
  });
});
