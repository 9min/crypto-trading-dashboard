import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FuturesPosition, FuturesTrade } from '@/types/portfolio';
import {
  calculateLiquidationPrice,
  calculateUnrealizedPnl,
  calculateRoe,
  calculateMargin,
  isLiquidatable,
  calculatePositionPnl,
  calculatePositionsWithPnl,
  calculateFuturesSummary,
  calculateAllocationSlices,
  tradesToCsv,
  downloadCsv,
  ALLOCATION_PALETTE,
  CASH_COLOR,
} from './portfolioCalc';

// =============================================================================
// Test Helpers
// =============================================================================

function makePosition(overrides: Partial<FuturesPosition> = {}): FuturesPosition {
  return {
    id: 'futures-test-abc123',
    symbol: 'BTCUSDT',
    side: 'long',
    entryPrice: 50000,
    quantity: 1,
    leverage: 10,
    marginType: 'isolated',
    margin: 5000,
    liquidationPrice: 45000,
    openedAt: 1700000000000,
    ...overrides,
  };
}

function makeTickers(entries: Array<[string, number]>): Map<string, { price: number }> {
  return new Map(entries.map(([symbol, price]) => [symbol, { price }]));
}

function makePositionsMap(positions: FuturesPosition[]): Map<string, FuturesPosition> {
  return new Map(positions.map((p) => [p.symbol, p]));
}

// =============================================================================
// calculateLiquidationPrice
// =============================================================================

describe('calculateLiquidationPrice', () => {
  it('calculates isolated long liquidation price', () => {
    // entry * (1 - 1/leverage) = 50000 * (1 - 1/10) = 50000 * 0.9 = 45000
    const result = calculateLiquidationPrice(50000, 10, 'long', 'isolated');
    expect(result).toBe(45000);
  });

  it('calculates isolated short liquidation price', () => {
    // entry * (1 + 1/leverage) = 50000 * (1 + 1/10) = 50000 * 1.1 ≈ 55000
    const result = calculateLiquidationPrice(50000, 10, 'short', 'isolated');
    expect(result).toBeCloseTo(55000, 5);
  });

  it('returns 0 for cross long (no liquidation)', () => {
    const result = calculateLiquidationPrice(50000, 10, 'long', 'cross');
    expect(result).toBe(0);
  });

  it('returns infinity for cross short (no liquidation)', () => {
    const result = calculateLiquidationPrice(50000, 10, 'short', 'cross');
    expect(result).toBe(Infinity);
  });

  it('handles 1x leverage (liquidation at 0 for long)', () => {
    const result = calculateLiquidationPrice(50000, 1, 'long', 'isolated');
    expect(result).toBe(0);
  });

  it('handles 1x leverage for short (liquidation at 2x entry)', () => {
    const result = calculateLiquidationPrice(50000, 1, 'short', 'isolated');
    expect(result).toBe(100000);
  });

  it('handles 100x leverage for long', () => {
    // 50000 * (1 - 1/100) = 50000 * 0.99 = 49500
    const result = calculateLiquidationPrice(50000, 100, 'long', 'isolated');
    expect(result).toBe(49500);
  });
});

// =============================================================================
// calculateUnrealizedPnl
// =============================================================================

describe('calculateUnrealizedPnl', () => {
  it('calculates positive pnl for long when price goes up', () => {
    const result = calculateUnrealizedPnl(50000, 55000, 1, 'long');
    expect(result).toBe(5000);
  });

  it('calculates negative pnl for long when price goes down', () => {
    const result = calculateUnrealizedPnl(50000, 45000, 1, 'long');
    expect(result).toBe(-5000);
  });

  it('calculates positive pnl for short when price goes down', () => {
    const result = calculateUnrealizedPnl(50000, 45000, 1, 'short');
    expect(result).toBe(5000);
  });

  it('calculates negative pnl for short when price goes up', () => {
    const result = calculateUnrealizedPnl(50000, 55000, 1, 'short');
    expect(result).toBe(-5000);
  });

  it('returns zero when price is unchanged', () => {
    const result = calculateUnrealizedPnl(50000, 50000, 1, 'long');
    expect(result).toBe(0);
  });

  it('scales with quantity', () => {
    const result = calculateUnrealizedPnl(50000, 55000, 2, 'long');
    expect(result).toBe(10000);
  });

  it('handles fractional quantity', () => {
    const result = calculateUnrealizedPnl(50000, 55000, 0.5, 'long');
    expect(result).toBe(2500);
  });
});

// =============================================================================
// calculateRoe
// =============================================================================

describe('calculateRoe', () => {
  it('calculates roe for long position with profit', () => {
    // (55000 - 50000) / 50000 * 10 * 100 = 100%
    const result = calculateRoe(50000, 55000, 10, 'long');
    expect(result).toBe(100);
  });

  it('calculates roe for long position with loss', () => {
    // (48000 - 50000) / 50000 * 10 * 100 = -40%
    const result = calculateRoe(50000, 48000, 10, 'long');
    expect(result).toBe(-40);
  });

  it('calculates roe for short position with profit', () => {
    // (45000 - 50000) / 50000 * 10 * 100 * (-1) = 100%
    const result = calculateRoe(50000, 45000, 10, 'short');
    expect(result).toBe(100);
  });

  it('calculates roe for short position with loss', () => {
    // (52000 - 50000) / 50000 * 10 * 100 * (-1) = -40%
    const result = calculateRoe(50000, 52000, 10, 'short');
    expect(result).toBe(-40);
  });

  it('returns 0 when entry price is 0', () => {
    const result = calculateRoe(0, 50000, 10, 'long');
    expect(result).toBe(0);
  });

  it('returns 0 when price is unchanged', () => {
    const result = calculateRoe(50000, 50000, 10, 'long');
    expect(result).toBe(0);
  });
});

// =============================================================================
// calculateMargin
// =============================================================================

describe('calculateMargin', () => {
  it('calculates margin correctly', () => {
    // (50000 * 1) / 10 = 5000
    const result = calculateMargin(50000, 1, 10);
    expect(result).toBe(5000);
  });

  it('handles fractional quantity', () => {
    // (50000 * 0.5) / 10 = 2500
    const result = calculateMargin(50000, 0.5, 10);
    expect(result).toBe(2500);
  });

  it('handles 1x leverage', () => {
    const result = calculateMargin(50000, 1, 1);
    expect(result).toBe(50000);
  });

  it('handles 100x leverage', () => {
    const result = calculateMargin(50000, 1, 100);
    expect(result).toBe(500);
  });

  it('returns 0 for 0 leverage', () => {
    const result = calculateMargin(50000, 1, 0);
    expect(result).toBe(0);
  });
});

// =============================================================================
// isLiquidatable
// =============================================================================

describe('isLiquidatable', () => {
  it('returns true when long position price reaches liquidation', () => {
    const pos = makePosition({ side: 'long', liquidationPrice: 45000, marginType: 'isolated' });
    expect(isLiquidatable(pos, 45000)).toBe(true);
  });

  it('returns true when long position price below liquidation', () => {
    const pos = makePosition({ side: 'long', liquidationPrice: 45000, marginType: 'isolated' });
    expect(isLiquidatable(pos, 44000)).toBe(true);
  });

  it('returns false when long position price above liquidation', () => {
    const pos = makePosition({ side: 'long', liquidationPrice: 45000, marginType: 'isolated' });
    expect(isLiquidatable(pos, 46000)).toBe(false);
  });

  it('returns true when short position price reaches liquidation', () => {
    const pos = makePosition({ side: 'short', liquidationPrice: 55000, marginType: 'isolated' });
    expect(isLiquidatable(pos, 55000)).toBe(true);
  });

  it('returns true when short position price above liquidation', () => {
    const pos = makePosition({ side: 'short', liquidationPrice: 55000, marginType: 'isolated' });
    expect(isLiquidatable(pos, 56000)).toBe(true);
  });

  it('returns false when short position price below liquidation', () => {
    const pos = makePosition({ side: 'short', liquidationPrice: 55000, marginType: 'isolated' });
    expect(isLiquidatable(pos, 54000)).toBe(false);
  });

  it('returns false for cross margin positions', () => {
    const pos = makePosition({ marginType: 'cross', liquidationPrice: 0 });
    expect(isLiquidatable(pos, 0)).toBe(false);
  });
});

// =============================================================================
// calculatePositionPnl
// =============================================================================

describe('calculatePositionPnl', () => {
  it('enriches long position with profit', () => {
    const pos = makePosition({ entryPrice: 50000, quantity: 1, leverage: 10, margin: 5000 });
    const result = calculatePositionPnl(pos, 55000, 105000);

    expect(result.currentPrice).toBe(55000);
    expect(result.unrealizedPnl).toBe(5000);
    expect(result.roe).toBe(100); // 10% price change * 10x leverage = 100%
    expect(result.pnlPercent).toBe(100); // 5000 / 5000 * 100
    expect(result.allocationPercent).toBeCloseTo(4.76, 1); // 5000 / 105000 * 100
  });

  it('enriches short position with profit', () => {
    const pos = makePosition({
      side: 'short',
      entryPrice: 50000,
      quantity: 1,
      leverage: 10,
      margin: 5000,
    });
    const result = calculatePositionPnl(pos, 45000, 105000);

    expect(result.unrealizedPnl).toBe(5000);
    expect(result.roe).toBe(100);
  });

  it('handles zero equity', () => {
    const pos = makePosition({ margin: 5000 });
    const result = calculatePositionPnl(pos, 50000, 0);

    expect(result.allocationPercent).toBe(0);
  });

  it('handles zero margin', () => {
    const pos = makePosition({ margin: 0 });
    const result = calculatePositionPnl(pos, 50000, 100000);

    expect(result.pnlPercent).toBe(0);
  });
});

// =============================================================================
// calculatePositionsWithPnl
// =============================================================================

describe('calculatePositionsWithPnl', () => {
  it('returns empty array for empty positions', () => {
    const result = calculatePositionsWithPnl(new Map(), new Map(), 100000);
    expect(result).toEqual([]);
  });

  it('enriches positions with pnl data', () => {
    const positions = makePositionsMap([
      makePosition({ symbol: 'BTCUSDT', entryPrice: 50000, quantity: 1, margin: 5000 }),
    ]);
    const tickers = makeTickers([['BTCUSDT', 55000]]);

    const result = calculatePositionsWithPnl(positions, tickers, 100000);

    expect(result).toHaveLength(1);
    expect(result[0].currentPrice).toBe(55000);
    expect(result[0].unrealizedPnl).toBe(5000);
  });

  it('sorts positions by margin descending', () => {
    const positions = makePositionsMap([
      makePosition({ symbol: 'ETHUSDT', margin: 2000, entryPrice: 3000, quantity: 1 }),
      makePosition({ symbol: 'BTCUSDT', margin: 5000, entryPrice: 50000, quantity: 1 }),
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 50000],
      ['ETHUSDT', 3000],
    ]);

    const result = calculatePositionsWithPnl(positions, tickers, 100000);

    expect(result[0].symbol).toBe('BTCUSDT');
    expect(result[1].symbol).toBe('ETHUSDT');
  });

  it('uses entry price when ticker is missing', () => {
    const positions = makePositionsMap([makePosition({ symbol: 'BTCUSDT', entryPrice: 50000 })]);

    const result = calculatePositionsWithPnl(positions, new Map(), 100000);

    expect(result[0].currentPrice).toBe(50000);
    expect(result[0].unrealizedPnl).toBe(0);
  });
});

// =============================================================================
// calculateFuturesSummary
// =============================================================================

describe('calculateFuturesSummary', () => {
  it('returns correct summary for empty portfolio', () => {
    const result = calculateFuturesSummary(new Map(), new Map(), 100000);

    expect(result.totalEquity).toBe(100000);
    expect(result.walletBalance).toBe(100000);
    expect(result.availableBalance).toBe(100000);
    expect(result.totalMarginUsed).toBe(0);
    expect(result.totalUnrealizedPnl).toBe(0);
    expect(result.totalUnrealizedPnlPercent).toBe(0);
    expect(result.positionCount).toBe(0);
  });

  it('calculates summary with open positions', () => {
    const positions = makePositionsMap([
      makePosition({
        symbol: 'BTCUSDT',
        side: 'long',
        entryPrice: 50000,
        quantity: 1,
        margin: 5000,
      }),
    ]);
    const tickers = makeTickers([['BTCUSDT', 55000]]);

    const result = calculateFuturesSummary(positions, tickers, 100000);

    expect(result.walletBalance).toBe(100000);
    expect(result.totalMarginUsed).toBe(5000);
    expect(result.availableBalance).toBe(95000);
    expect(result.totalUnrealizedPnl).toBe(5000);
    expect(result.totalEquity).toBe(105000);
    expect(result.totalUnrealizedPnlPercent).toBe(100); // 5000/5000 * 100
    expect(result.positionCount).toBe(1);
  });

  it('aggregates multiple positions', () => {
    const positions = makePositionsMap([
      makePosition({
        symbol: 'BTCUSDT',
        side: 'long',
        entryPrice: 50000,
        quantity: 1,
        margin: 5000,
      }),
      makePosition({
        symbol: 'ETHUSDT',
        side: 'short',
        entryPrice: 3000,
        quantity: 10,
        margin: 3000,
      }),
    ]);
    const tickers = makeTickers([
      ['BTCUSDT', 55000], // +5000 PnL
      ['ETHUSDT', 2800], // +2000 PnL (short)
    ]);

    const result = calculateFuturesSummary(positions, tickers, 100000);

    expect(result.totalMarginUsed).toBe(8000);
    expect(result.totalUnrealizedPnl).toBe(7000);
    expect(result.totalEquity).toBe(107000);
    expect(result.positionCount).toBe(2);
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

  it('builds slices with correct labels and percentages', () => {
    const positions = makePositionsMap([
      makePosition({
        symbol: 'BTCUSDT',
        side: 'long',
        leverage: 10,
        margin: 5000,
      }),
    ]);

    const result = calculateAllocationSlices(positions, new Map(), 100000);

    const btcSlice = result.find((s) => s.label === 'BTC 10x L');
    const cashSlice = result.find((s) => s.label === 'Cash');

    expect(btcSlice).toBeDefined();
    expect(btcSlice?.value).toBe(5000);
    expect(btcSlice?.percent).toBe(5); // 5000 / 100000
    expect(cashSlice?.value).toBe(95000); // 100000 - 5000
  });

  it('labels short positions with S suffix', () => {
    const positions = makePositionsMap([
      makePosition({ symbol: 'ETHUSDT', side: 'short', leverage: 25, margin: 3000 }),
    ]);

    const result = calculateAllocationSlices(positions, new Map(), 100000);

    const ethSlice = result.find((s) => s.label === 'ETH 25x S');
    expect(ethSlice).toBeDefined();
  });

  it('uses palette colors for position slices', () => {
    const positions = makePositionsMap([makePosition({ symbol: 'BTCUSDT', margin: 5000 })]);

    const result = calculateAllocationSlices(positions, new Map(), 100000);

    const btcSlice = result.find((s) => s.label !== 'Cash');
    expect(btcSlice?.color).toBe(ALLOCATION_PALETTE[0]);
  });

  it('cash slice is always last', () => {
    const positions = makePositionsMap([
      makePosition({ symbol: 'BTCUSDT', margin: 5000 }),
      makePosition({ symbol: 'ETHUSDT', margin: 3000 }),
    ]);

    const result = calculateAllocationSlices(positions, new Map(), 100000);

    expect(result[result.length - 1].label).toBe('Cash');
  });

  it('handles zero wallet balance', () => {
    const result = calculateAllocationSlices(new Map(), new Map(), 0);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Cash');
    expect(result[0].percent).toBe(100);
  });
});

// =============================================================================
// tradesToCsv
// =============================================================================

describe('tradesToCsv', () => {
  it('produces correct csv header and rows', () => {
    const trades: FuturesTrade[] = [
      {
        id: 'futures-1234-abc123',
        symbol: 'BTCUSDT',
        side: 'long',
        action: 'open',
        price: 50000,
        quantity: 1,
        leverage: 10,
        realizedPnl: 0,
        closeReason: null,
        timestamp: 1700000000000,
      },
    ];

    const csv = tradesToCsv(trades);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'id,symbol,side,action,price,quantity,leverage,realizedPnl,closeReason,timestamp',
    );
    expect(lines[1]).toContain('futures-1234-abc123');
    expect(lines[1]).toContain('BTCUSDT');
    expect(lines[1]).toContain('long');
    expect(lines[1]).toContain('open');
  });

  it('returns only header for empty trades', () => {
    const csv = tradesToCsv([]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      'id,symbol,side,action,price,quantity,leverage,realizedPnl,closeReason,timestamp',
    );
  });

  it('formats close reason correctly', () => {
    const trades: FuturesTrade[] = [
      {
        id: 'test-id',
        symbol: 'BTCUSDT',
        side: 'long',
        action: 'close',
        price: 55000,
        quantity: 1,
        leverage: 10,
        realizedPnl: 5000,
        closeReason: 'manual',
        timestamp: 1700000000000,
      },
    ];

    const csv = tradesToCsv(trades);
    expect(csv).toContain('manual');
  });

  it('formats null close reason as empty string', () => {
    const trades: FuturesTrade[] = [
      {
        id: 'test-id',
        symbol: 'BTCUSDT',
        side: 'long',
        action: 'open',
        price: 50000,
        quantity: 1,
        leverage: 10,
        realizedPnl: 0,
        closeReason: null,
        timestamp: 1700000000000,
      },
    ];

    const csv = tradesToCsv(trades);
    const lines = csv.split('\n');
    // closeReason should be empty between the two commas
    expect(lines[1]).toContain(',0,,');
  });

  it('formats timestamp as iso string', () => {
    const ts = 1700000000000;
    const trades: FuturesTrade[] = [
      {
        id: 'test-id',
        symbol: 'ETHUSDT',
        side: 'short',
        action: 'close',
        price: 3000,
        quantity: 5,
        leverage: 20,
        realizedPnl: 1000,
        closeReason: 'liquidated',
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
