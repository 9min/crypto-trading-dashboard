import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PortfolioHolding, PortfolioTrade } from '@/types/portfolio';
import {
  calculateHoldingPnl,
  calculateHoldingsWithPnl,
  calculatePortfolioSummary,
  calculateAllocationSlices,
  applyBuyTrade,
  applySellTrade,
  tradesToCsv,
  downloadCsv,
  ALLOCATION_PALETTE,
  CASH_COLOR,
} from './portfolioCalc';

// =============================================================================
// Test Helpers
// =============================================================================

function makeHolding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    symbol: 'BTCUSDT',
    quantity: 1,
    avgEntryPrice: 50000,
    costBasis: 50000,
    ...overrides,
  };
}

function makeTickers(entries: Array<[string, number]>): Map<string, { price: number }> {
  return new Map(entries.map(([symbol, price]) => [symbol, { price }]));
}

function makeHoldingsMap(holdings: PortfolioHolding[]): Map<string, PortfolioHolding> {
  return new Map(holdings.map((h) => [h.symbol, h]));
}

// =============================================================================
// calculateHoldingPnl
// =============================================================================

describe('calculateHoldingPnl', () => {
  it('calculates positive pnl when price goes up', () => {
    const holding = makeHolding({ costBasis: 50000, quantity: 1 });
    const result = calculateHoldingPnl(holding, 60000);

    expect(result.marketValue).toBe(60000);
    expect(result.unrealizedPnl).toBe(10000);
    expect(result.unrealizedPnlPercent).toBe(20);
  });

  it('calculates negative pnl when price goes down', () => {
    const holding = makeHolding({ costBasis: 50000, quantity: 1 });
    const result = calculateHoldingPnl(holding, 40000);

    expect(result.marketValue).toBe(40000);
    expect(result.unrealizedPnl).toBe(-10000);
    expect(result.unrealizedPnlPercent).toBe(-20);
  });

  it('calculates zero pnl when price is unchanged', () => {
    const holding = makeHolding({ costBasis: 50000, quantity: 1 });
    const result = calculateHoldingPnl(holding, 50000);

    expect(result.marketValue).toBe(50000);
    expect(result.unrealizedPnl).toBe(0);
    expect(result.unrealizedPnlPercent).toBe(0);
  });

  it('handles zero cost basis gracefully', () => {
    const holding = makeHolding({ costBasis: 0, quantity: 0 });
    const result = calculateHoldingPnl(holding, 60000);

    expect(result.unrealizedPnlPercent).toBe(0);
  });

  it('handles fractional quantities', () => {
    const holding = makeHolding({ costBasis: 25000, quantity: 0.5 });
    const result = calculateHoldingPnl(holding, 60000);

    expect(result.marketValue).toBe(30000);
    expect(result.unrealizedPnl).toBe(5000);
  });
});

// =============================================================================
// calculateHoldingsWithPnl
// =============================================================================

describe('calculateHoldingsWithPnl', () => {
  it('returns empty array for empty holdings', () => {
    const result = calculateHoldingsWithPnl(new Map(), new Map(), 100000);
    expect(result).toEqual([]);
  });

  it('enriches holdings with pnl data', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000, avgEntryPrice: 50000 }),
    ]);
    const tickers = makeTickers([['BTCUSDT', 60000]]);

    const result = calculateHoldingsWithPnl(holdings, tickers, 40000);

    expect(result).toHaveLength(1);
    expect(result[0].currentPrice).toBe(60000);
    expect(result[0].marketValue).toBe(60000);
    expect(result[0].unrealizedPnl).toBe(10000);
    expect(result[0].allocationPercent).toBe(60); // 60000 / (60000 + 40000) = 60%
  });

  it('sorts holdings by market value descending', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'ETHUSDT', quantity: 10, costBasis: 30000, avgEntryPrice: 3000 }),
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000, avgEntryPrice: 50000 }),
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 60000],
      ['ETHUSDT', 4000],
    ]);

    const result = calculateHoldingsWithPnl(holdings, tickers, 0);

    expect(result[0].symbol).toBe('BTCUSDT'); // 60000 > 40000
    expect(result[1].symbol).toBe('ETHUSDT');
  });

  it('handles missing ticker data (price = 0)', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000 }),
    ]);
    const tickers = new Map<string, { price: number }>();

    const result = calculateHoldingsWithPnl(holdings, tickers, 100000);

    expect(result[0].currentPrice).toBe(0);
    expect(result[0].marketValue).toBe(0);
  });
});

// =============================================================================
// calculatePortfolioSummary
// =============================================================================

describe('calculatePortfolioSummary', () => {
  it('returns correct summary for empty portfolio', () => {
    const result = calculatePortfolioSummary(new Map(), new Map(), 100000);

    expect(result.totalValue).toBe(100000);
    expect(result.totalUnrealizedPnl).toBe(0);
    expect(result.totalUnrealizedPnlPercent).toBe(0);
    expect(result.holdingCount).toBe(0);
  });

  it('calculates total value including cash and holdings', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000 }),
    ]);
    const tickers = makeTickers([['BTCUSDT', 60000]]);

    const result = calculatePortfolioSummary(holdings, tickers, 50000);

    expect(result.totalValue).toBe(110000); // 60000 + 50000
    expect(result.totalUnrealizedPnl).toBe(10000);
    expect(result.totalUnrealizedPnlPercent).toBe(20); // 10000/50000 * 100
    expect(result.holdingCount).toBe(1);
  });

  it('aggregates multiple holdings', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000 }),
      makeHolding({ symbol: 'ETHUSDT', quantity: 10, costBasis: 30000, avgEntryPrice: 3000 }),
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 55000],
      ['ETHUSDT', 3500],
    ]);

    const result = calculatePortfolioSummary(holdings, tickers, 20000);

    // marketValue = 55000 + 35000 = 90000, total = 110000
    expect(result.totalValue).toBe(110000);
    expect(result.totalUnrealizedPnl).toBe(10000); // (55000-50000) + (35000-30000)
    expect(result.holdingCount).toBe(2);
  });
});

// =============================================================================
// calculateAllocationSlices
// =============================================================================

describe('calculateAllocationSlices', () => {
  it('returns only cash slice for empty portfolio', () => {
    const result = calculateAllocationSlices(new Map(), new Map(), 100000);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Cash');
    expect(result[0].value).toBe(100000);
    expect(result[0].percent).toBe(100);
    expect(result[0].color).toBe(CASH_COLOR);
  });

  it('builds slices with correct percentages', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000 }),
    ]);
    const tickers = makeTickers([['BTCUSDT', 50000]]);

    const result = calculateAllocationSlices(holdings, tickers, 50000);

    // BTC slice: 50000/100000 = 50%, Cash: 50000/100000 = 50%
    const btcSlice = result.find((s) => s.label === 'BTC');
    const cashSlice = result.find((s) => s.label === 'Cash');

    expect(btcSlice?.percent).toBe(50);
    expect(cashSlice?.percent).toBe(50);
  });

  it('uses palette colors for asset slices and CASH_COLOR for cash', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000 }),
    ]);
    const tickers = makeTickers([['BTCUSDT', 50000]]);

    const result = calculateAllocationSlices(holdings, tickers, 50000);

    const btcSlice = result.find((s) => s.label === 'BTC');
    const cashSlice = result.find((s) => s.label === 'Cash');

    expect(btcSlice?.color).toBe(ALLOCATION_PALETTE[0]);
    expect(cashSlice?.color).toBe(CASH_COLOR);
  });

  it('strips USDT suffix from labels', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'ETHUSDT', quantity: 10, costBasis: 30000 }),
    ]);
    const tickers = makeTickers([['ETHUSDT', 3000]]);

    const result = calculateAllocationSlices(holdings, tickers, 0);

    expect(result[0].label).toBe('ETH');
  });

  it('cash slice is always last', () => {
    const holdings = makeHoldingsMap([
      makeHolding({ symbol: 'BTCUSDT', quantity: 1, costBasis: 50000 }),
      makeHolding({ symbol: 'ETHUSDT', quantity: 10, costBasis: 30000, avgEntryPrice: 3000 }),
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 60000],
      ['ETHUSDT', 4000],
    ]);

    const result = calculateAllocationSlices(holdings, tickers, 10000);

    expect(result[result.length - 1].label).toBe('Cash');
  });

  it('handles zero total value', () => {
    const result = calculateAllocationSlices(new Map(), new Map(), 0);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Cash');
    expect(result[0].percent).toBe(100);
  });
});

// =============================================================================
// applyBuyTrade
// =============================================================================

describe('applyBuyTrade', () => {
  it('creates new holding when no existing position', () => {
    const result = applyBuyTrade(undefined, 'BTCUSDT', 50000, 0.5);

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.quantity).toBe(0.5);
    expect(result.avgEntryPrice).toBe(50000);
    expect(result.costBasis).toBe(25000);
  });

  it('adds to existing position with correct weighted average', () => {
    const existing = makeHolding({
      symbol: 'BTCUSDT',
      quantity: 1,
      avgEntryPrice: 50000,
      costBasis: 50000,
    });

    const result = applyBuyTrade(existing, 'BTCUSDT', 60000, 1);

    expect(result.quantity).toBe(2);
    expect(result.costBasis).toBe(110000); // 50000 + 60000
    expect(result.avgEntryPrice).toBe(55000); // 110000 / 2
  });

  it('handles multiple small buys accumulation', () => {
    let holding: PortfolioHolding | undefined;

    holding = applyBuyTrade(holding, 'ETHUSDT', 3000, 5);
    holding = applyBuyTrade(holding, 'ETHUSDT', 3500, 5);

    expect(holding.quantity).toBe(10);
    expect(holding.costBasis).toBe(32500); // 15000 + 17500
    expect(holding.avgEntryPrice).toBe(3250); // 32500 / 10
  });
});

// =============================================================================
// applySellTrade
// =============================================================================

describe('applySellTrade', () => {
  it('reduces holding quantity on partial sell', () => {
    const existing = makeHolding({
      quantity: 2,
      avgEntryPrice: 50000,
      costBasis: 100000,
    });

    const result = applySellTrade(existing, 60000, 1);

    expect(result).toBeDefined();
    expect(result?.quantity).toBe(1);
    expect(result?.avgEntryPrice).toBe(50000); // unchanged
    expect(result?.costBasis).toBe(50000); // proportionally reduced
  });

  it('returns undefined when fully sold', () => {
    const existing = makeHolding({
      quantity: 1,
      avgEntryPrice: 50000,
      costBasis: 50000,
    });

    const result = applySellTrade(existing, 60000, 1);
    expect(result).toBeUndefined();
  });

  it('returns undefined for near-zero remaining quantity', () => {
    const existing = makeHolding({
      quantity: 1,
      avgEntryPrice: 50000,
      costBasis: 50000,
    });

    // Sell all but a tiny floating point remainder
    const result = applySellTrade(existing, 60000, 0.9999999999999);
    expect(result).toBeUndefined();
  });

  it('maintains avgEntryPrice after partial sell', () => {
    const existing = makeHolding({
      quantity: 4,
      avgEntryPrice: 50000,
      costBasis: 200000,
    });

    const result = applySellTrade(existing, 60000, 3);

    expect(result?.quantity).toBe(1);
    expect(result?.avgEntryPrice).toBe(50000);
    expect(result?.costBasis).toBe(50000); // 200000 * (1/4)
  });
});

// =============================================================================
// tradesToCsv
// =============================================================================

describe('tradesToCsv', () => {
  it('produces correct csv header and rows', () => {
    const trades: PortfolioTrade[] = [
      {
        id: 'portfolio-1234-abc123',
        symbol: 'BTCUSDT',
        side: 'buy',
        price: 50000,
        quantity: 1,
        notional: 50000,
        timestamp: 1700000000000,
      },
    ];

    const csv = tradesToCsv(trades);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('id,symbol,side,price,quantity,notional,timestamp');
    expect(lines[1]).toContain('portfolio-1234-abc123');
    expect(lines[1]).toContain('BTCUSDT');
    expect(lines[1]).toContain('buy');
    expect(lines[1]).toContain('50000');
  });

  it('returns only header for empty trades', () => {
    const csv = tradesToCsv([]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('id,symbol,side,price,quantity,notional,timestamp');
  });

  it('formats timestamp as iso string', () => {
    const ts = 1700000000000;
    const trades: PortfolioTrade[] = [
      {
        id: 'test-id',
        symbol: 'ETHUSDT',
        side: 'sell',
        price: 3000,
        quantity: 5,
        notional: 15000,
        timestamp: ts,
      },
    ];

    const csv = tradesToCsv(trades);
    expect(csv).toContain(new Date(ts).toISOString());
  });
});

// =============================================================================
// downloadCsv
// =============================================================================

describe('downloadCsv', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a temporary link and triggers download', () => {
    const mockClick = vi.fn();
    const mockAppendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const mockRemoveChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();

    // @ts-expect-error -- partial URL mock for test
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      style: { display: '' },
      click: mockClick,
    } as unknown as HTMLAnchorElement);

    downloadCsv('test,csv,data', 'trades.csv');

    expect(mockCreateObjectURL).toHaveBeenCalledOnce();
    expect(mockClick).toHaveBeenCalledOnce();
    expect(mockAppendChild).toHaveBeenCalledOnce();
    expect(mockRemoveChild).toHaveBeenCalledOnce();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });
});
