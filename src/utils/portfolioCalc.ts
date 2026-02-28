// =============================================================================
// Futures Portfolio Calculation Utilities
// =============================================================================
// Pure functions for futures PnL calculations, liquidation price, margin,
// ROE, and CSV export. No side effects — all functions take inputs and
// return results.
// =============================================================================

import type {
  FuturesPosition,
  FuturesTrade,
  PositionWithPnl,
  FuturesSummary,
  AllocationSlice,
  PositionSide,
  MarginType,
} from '@/types/portfolio';
import { TAKER_FEE_RATE } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Allocation Palette
// -----------------------------------------------------------------------------

/**
 * 10-color palette for allocation chart slices.
 * Cash always uses CASH_COLOR; position slices cycle through this palette.
 */
const ALLOCATION_PALETTE = [
  '#f7931a', // BTC orange
  '#627eea', // ETH blue
  '#f3ba2f', // BNB yellow
  '#00d4aa', // SOL teal
  '#00aaff', // XRP blue
  '#c2a633', // DOGE gold
  '#0033ad', // ADA blue
  '#e84142', // AVAX red
  '#8b5cf6', // purple
  '#ec4899', // pink
] as const;

const CASH_COLOR = '#848e9c';

// -----------------------------------------------------------------------------
// Core Calculation Functions
// -----------------------------------------------------------------------------

/**
 * Calculates the liquidation price for a futures position.
 *
 * Isolated long:  entryPrice * (1 - 1/leverage)
 * Isolated short: entryPrice * (1 + 1/leverage)
 * Cross: 0 (long) or Infinity (short) — simplified, no cross liquidation
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: PositionSide,
  marginType: MarginType,
): number {
  if (marginType === 'cross') {
    return side === 'long' ? 0 : Infinity;
  }

  if (side === 'long') {
    return entryPrice * (1 - 1 / leverage);
  }
  return entryPrice * (1 + 1 / leverage);
}

/**
 * Calculates unrealized PnL for a position.
 * Long:  (currentPrice - entryPrice) * quantity
 * Short: (entryPrice - currentPrice) * quantity
 */
export function calculateUnrealizedPnl(
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  side: PositionSide,
): number {
  const direction = side === 'long' ? 1 : -1;
  return (currentPrice - entryPrice) * quantity * direction;
}

/**
 * Calculates ROE% (Return on Equity) for a position.
 * ROE = (currentPrice - entryPrice) / entryPrice * leverage * 100 * direction
 */
export function calculateRoe(
  entryPrice: number,
  currentPrice: number,
  leverage: number,
  side: PositionSide,
): number {
  if (entryPrice === 0) return 0;
  const direction = side === 'long' ? 1 : -1;
  return ((currentPrice - entryPrice) / entryPrice) * leverage * 100 * direction;
}

/**
 * Calculates required margin (collateral) for a position.
 * margin = (entryPrice * quantity) / leverage
 */
export function calculateMargin(entryPrice: number, quantity: number, leverage: number): number {
  if (leverage === 0) return 0;
  return (entryPrice * quantity) / leverage;
}

/**
 * Calculates the taker fee for a trade.
 * fee = price * quantity * TAKER_FEE_RATE (0.04%)
 */
export function calculateFee(price: number, quantity: number): number {
  return price * quantity * TAKER_FEE_RATE;
}

/**
 * Calculates the weighted average entry price when adding to a position.
 * avgEntry = (oldEntry * oldQty + newEntry * newQty) / (oldQty + newQty)
 */
export function calculateAverageEntry(
  oldEntry: number,
  oldQty: number,
  newEntry: number,
  newQty: number,
): number {
  const totalQty = oldQty + newQty;
  if (totalQty === 0) return 0;
  return (oldEntry * oldQty + newEntry * newQty) / totalQty;
}

/**
 * Calculates the notional value of a position.
 * notional = price * quantity
 */
export function calculateNotionalValue(price: number, quantity: number): number {
  return price * quantity;
}

/**
 * Checks if the take-profit price has been hit.
 * Long: currentPrice >= tpPrice
 * Short: currentPrice <= tpPrice
 */
export function isTakeProfitHit(
  currentPrice: number,
  tpPrice: number,
  side: PositionSide,
): boolean {
  if (side === 'long') return currentPrice >= tpPrice;
  return currentPrice <= tpPrice;
}

/**
 * Checks if the stop-loss price has been hit.
 * Long: currentPrice <= slPrice
 * Short: currentPrice >= slPrice
 */
export function isStopLossHit(currentPrice: number, slPrice: number, side: PositionSide): boolean {
  if (side === 'long') return currentPrice <= slPrice;
  return currentPrice >= slPrice;
}

/**
 * Checks if a position should be liquidated at the given price.
 * Long:  currentPrice <= liquidationPrice
 * Short: currentPrice >= liquidationPrice
 *
 * Cross margin positions with liqPrice 0/Infinity are never liquidated
 * through this check.
 */
export function isLiquidatable(position: FuturesPosition, currentPrice: number): boolean {
  if (position.marginType === 'cross') return false;

  if (position.side === 'long') {
    return currentPrice <= position.liquidationPrice;
  }
  return currentPrice >= position.liquidationPrice;
}

// -----------------------------------------------------------------------------
// Position PnL Enrichment
// -----------------------------------------------------------------------------

/**
 * Enriches a single position with current PnL data.
 */
export function calculatePositionPnl(
  position: FuturesPosition,
  currentPrice: number,
  totalEquity: number,
): PositionWithPnl {
  const unrealizedPnl = calculateUnrealizedPnl(
    position.entryPrice,
    currentPrice,
    position.quantity,
    position.side,
  );
  const roe = calculateRoe(position.entryPrice, currentPrice, position.leverage, position.side);
  const pnlPercent = position.margin > 0 ? (unrealizedPnl / position.margin) * 100 : 0;
  const allocationPercent = totalEquity > 0 ? (position.margin / totalEquity) * 100 : 0;
  const notionalValue = calculateNotionalValue(currentPrice, position.quantity);
  const marginPlusPnl = position.margin + unrealizedPnl;
  const positionMarginRatio = marginPlusPnl > 0 ? (position.margin / marginPlusPnl) * 100 : 100;

  return {
    ...position,
    currentPrice,
    unrealizedPnl,
    roe,
    pnlPercent,
    allocationPercent,
    notionalValue,
    positionMarginRatio,
  };
}

/**
 * Enriches all positions with current prices and PnL data.
 * Returns positions sorted by margin (descending).
 */
export function calculatePositionsWithPnl(
  positions: Map<string, FuturesPosition>,
  tickers: Map<string, { price: number }>,
  walletBalance: number,
): PositionWithPnl[] {
  if (positions.size === 0) return [];

  // First pass: compute total unrealized PnL for equity calculation
  let totalUnrealizedPnl = 0;
  for (const pos of positions.values()) {
    const currentPrice = tickers.get(pos.symbol)?.price ?? pos.entryPrice;
    totalUnrealizedPnl += calculateUnrealizedPnl(
      pos.entryPrice,
      currentPrice,
      pos.quantity,
      pos.side,
    );
  }

  const totalEquity = walletBalance + totalUnrealizedPnl;

  // Second pass: enrich positions
  const enriched: PositionWithPnl[] = [];
  for (const pos of positions.values()) {
    const currentPrice = tickers.get(pos.symbol)?.price ?? pos.entryPrice;
    enriched.push(calculatePositionPnl(pos, currentPrice, totalEquity));
  }

  // Sort by margin descending
  enriched.sort((a, b) => b.margin - a.margin);

  return enriched;
}

// -----------------------------------------------------------------------------
// Futures Summary
// -----------------------------------------------------------------------------

/**
 * Calculates aggregate futures account summary.
 */
export function calculateFuturesSummary(
  positions: Map<string, FuturesPosition>,
  tickers: Map<string, { price: number }>,
  walletBalance: number,
): FuturesSummary {
  let totalMarginUsed = 0;
  let totalUnrealizedPnl = 0;

  for (const pos of positions.values()) {
    const currentPrice = tickers.get(pos.symbol)?.price ?? pos.entryPrice;
    totalMarginUsed += pos.margin;
    totalUnrealizedPnl += calculateUnrealizedPnl(
      pos.entryPrice,
      currentPrice,
      pos.quantity,
      pos.side,
    );
  }

  const totalEquity = walletBalance + totalUnrealizedPnl;
  const availableBalance = walletBalance - totalMarginUsed;
  const totalUnrealizedPnlPercent =
    totalMarginUsed > 0 ? (totalUnrealizedPnl / totalMarginUsed) * 100 : 0;
  const marginRatio =
    totalEquity > 0 ? (totalMarginUsed / totalEquity) * 100 : totalMarginUsed > 0 ? 100 : 0;
  const marginRatioPercent = Math.max(0, Math.min(100, marginRatio));

  return {
    totalEquity,
    walletBalance,
    availableBalance,
    totalMarginUsed,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent,
    positionCount: positions.size,
    marginRatio,
    marginRatioPercent,
  };
}

// -----------------------------------------------------------------------------
// Allocation Slices (for Donut Chart)
// -----------------------------------------------------------------------------

/**
 * Builds allocation slices for the portfolio donut chart.
 * Each position creates a slice labeled like "BTC 10x L".
 * Includes a "Cash" slice. Returns slices sorted by value (descending).
 */
export function calculateAllocationSlices(
  positions: Map<string, FuturesPosition>,
  tickers: Map<string, { price: number }>,
  walletBalance: number,
): AllocationSlice[] {
  // Use available balance (wallet - margins) for the cash slice
  let totalMarginUsed = 0;
  const assetSlices: AllocationSlice[] = [];
  let colorIndex = 0;

  for (const pos of positions.values()) {
    totalMarginUsed += pos.margin;

    // Label: "BTC 10x L" or "ETH 25x S"
    const base = pos.symbol.replace(/USDT$/, '');
    const sideChar = pos.side === 'long' ? 'L' : 'S';
    const label = `${base} ${pos.leverage}x ${sideChar}`;

    assetSlices.push({
      label,
      value: pos.margin,
      percent: 0, // Computed below
      color: ALLOCATION_PALETTE[colorIndex % ALLOCATION_PALETTE.length],
    });
    colorIndex++;
  }

  const availableBalance = Math.max(0, walletBalance - totalMarginUsed);
  const totalValue = totalMarginUsed + availableBalance;

  // Compute percentages
  for (const slice of assetSlices) {
    slice.percent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0;
  }

  // Sort by value descending
  assetSlices.sort((a, b) => b.value - a.value);

  // Add cash slice
  const cashPercent = totalValue > 0 ? (availableBalance / totalValue) * 100 : 100;
  assetSlices.push({
    label: 'Cash',
    value: availableBalance,
    percent: cashPercent,
    color: CASH_COLOR,
  });

  return assetSlices;
}

// -----------------------------------------------------------------------------
// CSV Export
// -----------------------------------------------------------------------------

/**
 * Converts an array of futures trades to CSV string.
 */
export function tradesToCsv(trades: FuturesTrade[]): string {
  const header =
    'id,symbol,side,action,price,quantity,leverage,realizedPnl,fee,closeReason,timestamp';
  const rows = trades.map(
    (t) =>
      `${t.id},${t.symbol},${t.side},${t.action},${t.price},${t.quantity},${t.leverage},${t.realizedPnl},${t.fee},${t.closeReason ?? ''},${new Date(t.timestamp).toISOString()}`,
  );
  return [header, ...rows].join('\n');
}

/**
 * Triggers a browser download of CSV content.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { ALLOCATION_PALETTE, CASH_COLOR };
