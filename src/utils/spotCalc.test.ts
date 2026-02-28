// =============================================================================
// Spot Portfolio Calculation Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateSpotFee,
  calculateSpotAverageEntry,
  calculateSpotUnrealizedPnl,
  calculateHoldingPnl,
  calculateHoldingsWithPnl,
  calculateSpotSummary,
  calculateSpotAllocationSlices,
  spotTradesToCsv,
} from './spotCalc';
import type { SpotHolding, SpotTrade } from '@/types/spot';
import { SPOT_FEE_RATE } from '@/types/spot';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeHolding(overrides: Partial<SpotHolding> = {}): SpotHolding {
  return {
    symbol: 'BTCUSDT',
    avgEntryPrice: 90_000_000,
    quantity: 0.1,
    costBasis: 9_000_000,
    firstBoughtAt: Date.now(),
    ...overrides,
  };
}

function makeTickers(entries: Array<[string, number]>): Map<string, { price: number }> {
  return new Map(entries.map(([symbol, price]) => [symbol, { price }]));
}

// -----------------------------------------------------------------------------
// calculateSpotFee
// -----------------------------------------------------------------------------

describe('calculateSpotFee', () => {
  it('calculates fee at 0.05% rate', () => {
    // 90M KRW * 0.1 BTC * 0.0005 = 4,500 KRW
    expect(calculateSpotFee(90_000_000, 0.1)).toBeCloseTo(4_500);
  });

  it('returns 0 for zero price', () => {
    expect(calculateSpotFee(0, 1)).toBe(0);
  });

  it('returns 0 for zero quantity', () => {
    expect(calculateSpotFee(90_000_000, 0)).toBe(0);
  });

  it('handles small quantities', () => {
    // 90M * 0.001 * 0.0005 = 45
    expect(calculateSpotFee(90_000_000, 0.001)).toBeCloseTo(45);
  });

  it('uses SPOT_FEE_RATE constant (0.0005)', () => {
    expect(SPOT_FEE_RATE).toBe(0.0005);
  });
});

// -----------------------------------------------------------------------------
// calculateSpotAverageEntry
// -----------------------------------------------------------------------------

describe('calculateSpotAverageEntry', () => {
  it('calculates weighted average entry', () => {
    // (90M * 0.1 + 100M * 0.1) / 0.2 = 95M
    expect(calculateSpotAverageEntry(90_000_000, 0.1, 100_000_000, 0.1)).toBeCloseTo(95_000_000);
  });

  it('returns new price when old quantity is 0', () => {
    expect(calculateSpotAverageEntry(0, 0, 90_000_000, 0.1)).toBe(90_000_000);
  });

  it('returns old price when new quantity is 0', () => {
    expect(calculateSpotAverageEntry(90_000_000, 0.1, 0, 0)).toBe(90_000_000);
  });

  it('returns 0 when both quantities are 0', () => {
    expect(calculateSpotAverageEntry(90_000_000, 0, 100_000_000, 0)).toBe(0);
  });

  it('weighs larger quantity more', () => {
    // (90M * 0.9 + 100M * 0.1) / 1.0 = 91M
    const avg = calculateSpotAverageEntry(90_000_000, 0.9, 100_000_000, 0.1);
    expect(avg).toBeCloseTo(91_000_000);
  });
});

// -----------------------------------------------------------------------------
// calculateSpotUnrealizedPnl
// -----------------------------------------------------------------------------

describe('calculateSpotUnrealizedPnl', () => {
  it('returns positive PnL when price goes up', () => {
    // (100M - 90M) * 0.1 = 1M
    expect(calculateSpotUnrealizedPnl(90_000_000, 100_000_000, 0.1)).toBeCloseTo(1_000_000);
  });

  it('returns negative PnL when price goes down', () => {
    // (80M - 90M) * 0.1 = -1M
    expect(calculateSpotUnrealizedPnl(90_000_000, 80_000_000, 0.1)).toBeCloseTo(-1_000_000);
  });

  it('returns 0 when price unchanged', () => {
    expect(calculateSpotUnrealizedPnl(90_000_000, 90_000_000, 0.1)).toBe(0);
  });

  it('returns 0 for zero quantity', () => {
    expect(calculateSpotUnrealizedPnl(90_000_000, 100_000_000, 0)).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// calculateHoldingPnl
// -----------------------------------------------------------------------------

describe('calculateHoldingPnl', () => {
  it('enriches holding with positive PnL', () => {
    const holding = makeHolding();
    const result = calculateHoldingPnl(holding, 100_000_000, 200_000_000);

    expect(result.currentPrice).toBe(100_000_000);
    expect(result.unrealizedPnl).toBeCloseTo(1_000_000);
    expect(result.marketValue).toBeCloseTo(10_000_000);
    expect(result.pnlPercent).toBeCloseTo(11.111, 2); // 1M / 9M * 100
    expect(result.allocationPercent).toBeCloseTo(5); // 10M / 200M * 100
  });

  it('enriches holding with negative PnL', () => {
    const holding = makeHolding();
    const result = calculateHoldingPnl(holding, 80_000_000, 200_000_000);

    expect(result.unrealizedPnl).toBeCloseTo(-1_000_000);
    expect(result.pnlPercent).toBeCloseTo(-11.111, 2);
  });

  it('handles zero cost basis', () => {
    const holding = makeHolding({ costBasis: 0, avgEntryPrice: 0 });
    const result = calculateHoldingPnl(holding, 100_000_000, 200_000_000);
    expect(result.pnlPercent).toBe(0);
  });

  it('handles zero total value', () => {
    const holding = makeHolding();
    const result = calculateHoldingPnl(holding, 90_000_000, 0);
    expect(result.allocationPercent).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// calculateHoldingsWithPnl
// -----------------------------------------------------------------------------

describe('calculateHoldingsWithPnl', () => {
  it('returns empty array for no holdings', () => {
    const result = calculateHoldingsWithPnl(new Map(), new Map(), 100_000_000);
    expect(result).toEqual([]);
  });

  it('enriches holdings and sorts by market value', () => {
    const holdings = new Map<string, SpotHolding>([
      [
        'ETHUSDT',
        makeHolding({
          symbol: 'ETHUSDT',
          avgEntryPrice: 3_000_000,
          quantity: 1,
          costBasis: 3_000_000,
        }),
      ],
      [
        'BTCUSDT',
        makeHolding({
          symbol: 'BTCUSDT',
          avgEntryPrice: 90_000_000,
          quantity: 0.1,
          costBasis: 9_000_000,
        }),
      ],
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 100_000_000],
      ['ETHUSDT', 4_000_000],
    ]);

    const result = calculateHoldingsWithPnl(holdings, tickers, 50_000_000);

    // BTC market value: 10M, ETH market value: 4M → BTC first
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('BTCUSDT');
    expect(result[1].symbol).toBe('ETHUSDT');
  });

  it('falls back to avgEntryPrice when no ticker', () => {
    const holdings = new Map([['BTCUSDT', makeHolding()]]);
    const result = calculateHoldingsWithPnl(holdings, new Map(), 50_000_000);

    expect(result[0].currentPrice).toBe(90_000_000);
    expect(result[0].unrealizedPnl).toBe(0);
  });

  it('calculates correct allocation percentages', () => {
    const holdings = new Map([
      ['BTCUSDT', makeHolding({ quantity: 1, avgEntryPrice: 50_000_000, costBasis: 50_000_000 })],
    ]);
    const tickers = makeTickers([['BTCUSDT', 50_000_000]]);
    // Total: 50M wallet + 50M market = 100M
    const result = calculateHoldingsWithPnl(holdings, tickers, 50_000_000);
    expect(result[0].allocationPercent).toBeCloseTo(50);
  });
});

// -----------------------------------------------------------------------------
// calculateSpotSummary
// -----------------------------------------------------------------------------

describe('calculateSpotSummary', () => {
  it('returns summary for empty holdings', () => {
    const result = calculateSpotSummary(new Map(), new Map(), 100_000_000);

    expect(result.totalValue).toBe(100_000_000);
    expect(result.walletBalance).toBe(100_000_000);
    expect(result.totalMarketValue).toBe(0);
    expect(result.totalUnrealizedPnl).toBe(0);
    expect(result.totalUnrealizedPnlPercent).toBe(0);
    expect(result.holdingCount).toBe(0);
  });

  it('calculates summary with holdings', () => {
    const holdings = new Map([['BTCUSDT', makeHolding()]]);
    const tickers = makeTickers([['BTCUSDT', 100_000_000]]);

    const result = calculateSpotSummary(holdings, tickers, 50_000_000);

    // Market value: 100M * 0.1 = 10M
    expect(result.totalMarketValue).toBeCloseTo(10_000_000);
    // Total: 50M + 10M = 60M
    expect(result.totalValue).toBeCloseTo(60_000_000);
    // PnL: (100M - 90M) * 0.1 = 1M
    expect(result.totalUnrealizedPnl).toBeCloseTo(1_000_000);
    // PnL%: 1M / 9M * 100 = 11.11%
    expect(result.totalUnrealizedPnlPercent).toBeCloseTo(11.111, 2);
    expect(result.holdingCount).toBe(1);
  });

  it('calculates PnL percent based on cost basis', () => {
    const holdings = new Map([
      [
        'BTCUSDT',
        makeHolding({ costBasis: 10_000_000, avgEntryPrice: 100_000_000, quantity: 0.1 }),
      ],
    ]);
    // Price dropped to 80M → PnL = (80M - 100M) * 0.1 = -2M
    const tickers = makeTickers([['BTCUSDT', 80_000_000]]);

    const result = calculateSpotSummary(holdings, tickers, 50_000_000);

    expect(result.totalUnrealizedPnl).toBeCloseTo(-2_000_000);
    // -2M / 10M * 100 = -20%
    expect(result.totalUnrealizedPnlPercent).toBeCloseTo(-20);
  });

  it('handles zero cost basis', () => {
    const holdings = new Map([
      ['BTCUSDT', makeHolding({ costBasis: 0, avgEntryPrice: 0, quantity: 0 })],
    ]);
    const tickers = makeTickers([['BTCUSDT', 100_000_000]]);
    const result = calculateSpotSummary(holdings, tickers, 50_000_000);
    expect(result.totalUnrealizedPnlPercent).toBe(0);
  });

  it('aggregates multiple holdings', () => {
    const holdings = new Map([
      [
        'BTCUSDT',
        makeHolding({
          symbol: 'BTCUSDT',
          avgEntryPrice: 90_000_000,
          quantity: 0.1,
          costBasis: 9_000_000,
        }),
      ],
      [
        'ETHUSDT',
        makeHolding({
          symbol: 'ETHUSDT',
          avgEntryPrice: 3_000_000,
          quantity: 1,
          costBasis: 3_000_000,
        }),
      ],
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 100_000_000],
      ['ETHUSDT', 4_000_000],
    ]);

    const result = calculateSpotSummary(holdings, tickers, 50_000_000);

    // BTC MV: 10M, ETH MV: 4M → total 14M
    expect(result.totalMarketValue).toBeCloseTo(14_000_000);
    // BTC PnL: 1M, ETH PnL: 1M → total 2M
    expect(result.totalUnrealizedPnl).toBeCloseTo(2_000_000);
    expect(result.holdingCount).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// calculateSpotAllocationSlices
// -----------------------------------------------------------------------------

describe('calculateSpotAllocationSlices', () => {
  it('returns cash-only slice for empty holdings', () => {
    const result = calculateSpotAllocationSlices(new Map(), new Map(), 100_000_000);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Cash');
    expect(result[0].percent).toBe(100);
    expect(result[0].value).toBe(100_000_000);
  });

  it('creates labeled slices for holdings', () => {
    const holdings = new Map([
      [
        'BTCUSDT',
        makeHolding({
          symbol: 'BTCUSDT',
          avgEntryPrice: 90_000_000,
          quantity: 0.1,
          costBasis: 9_000_000,
        }),
      ],
    ]);
    const tickers = makeTickers([['BTCUSDT', 100_000_000]]);

    const result = calculateSpotAllocationSlices(holdings, tickers, 90_000_000);

    // BTC slice + Cash slice
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('BTC');
    expect(result[0].value).toBeCloseTo(10_000_000);
    expect(result[1].label).toBe('Cash');
    expect(result[1].value).toBe(90_000_000);
  });

  it('sorts slices by value descending (before cash)', () => {
    const holdings = new Map([
      [
        'ETHUSDT',
        makeHolding({
          symbol: 'ETHUSDT',
          avgEntryPrice: 3_000_000,
          quantity: 1,
          costBasis: 3_000_000,
        }),
      ],
      [
        'BTCUSDT',
        makeHolding({
          symbol: 'BTCUSDT',
          avgEntryPrice: 90_000_000,
          quantity: 0.1,
          costBasis: 9_000_000,
        }),
      ],
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 100_000_000],
      ['ETHUSDT', 4_000_000],
    ]);

    const result = calculateSpotAllocationSlices(holdings, tickers, 50_000_000);

    // BTC (10M) > ETH (4M) > Cash (50M) — but cash is always last
    expect(result[0].label).toBe('BTC');
    expect(result[1].label).toBe('ETH');
    expect(result[2].label).toBe('Cash');
  });

  it('calculates correct percentages', () => {
    const holdings = new Map([
      [
        'BTCUSDT',
        makeHolding({
          symbol: 'BTCUSDT',
          avgEntryPrice: 50_000_000,
          quantity: 1,
          costBasis: 50_000_000,
        }),
      ],
    ]);
    const tickers = makeTickers([['BTCUSDT', 50_000_000]]);

    // Total: 50M market + 50M cash = 100M
    const result = calculateSpotAllocationSlices(holdings, tickers, 50_000_000);

    expect(result[0].percent).toBeCloseTo(50); // BTC
    expect(result[1].percent).toBeCloseTo(50); // Cash
  });

  it('handles zero total value', () => {
    const result = calculateSpotAllocationSlices(new Map(), new Map(), 0);
    expect(result[0].label).toBe('Cash');
    expect(result[0].percent).toBe(100);
    expect(result[0].value).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// spotTradesToCsv
// -----------------------------------------------------------------------------

describe('spotTradesToCsv', () => {
  it('returns header only for empty trades', () => {
    const csv = spotTradesToCsv([]);
    expect(csv).toBe('id,symbol,action,price,quantity,fee,realizedPnl,timestamp');
  });

  it('includes trade data rows', () => {
    const trades: SpotTrade[] = [
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
    ];

    const csv = spotTradesToCsv(trades);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('spot-123-abc');
    expect(lines[1]).toContain('BTCUSDT');
    expect(lines[1]).toContain('buy');
  });

  it('handles multiple trades', () => {
    const trades: SpotTrade[] = [
      {
        id: 'spot-1',
        symbol: 'BTCUSDT',
        action: 'buy',
        price: 90_000_000,
        quantity: 0.1,
        fee: 4500,
        realizedPnl: 0,
        timestamp: 1700000000000,
      },
      {
        id: 'spot-2',
        symbol: 'BTCUSDT',
        action: 'sell',
        price: 100_000_000,
        quantity: 0.1,
        fee: 5000,
        realizedPnl: 995000,
        timestamp: 1700000060000,
      },
    ];

    const csv = spotTradesToCsv(trades);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('sell');
    expect(lines[2]).toContain('995000');
  });
});
