// =============================================================================
// Portfolio Calculation Utilities
// =============================================================================
// Pure functions for portfolio PnL calculations, holding updates, and CSV
// export. No side effects — all functions take inputs and return results.
// =============================================================================

import type {
  PortfolioHolding,
  HoldingWithPnl,
  PortfolioSummary,
  AllocationSlice,
  PortfolioTrade,
} from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Allocation Palette
// -----------------------------------------------------------------------------

/**
 * 10-color palette for allocation chart slices.
 * Cash always uses CASH_COLOR; asset slices cycle through this palette.
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
// Holding PnL Calculation
// -----------------------------------------------------------------------------

interface HoldingPnlResult {
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

/**
 * Calculates PnL for a single holding given the current market price.
 */
export function calculateHoldingPnl(
  holding: PortfolioHolding,
  currentPrice: number,
): HoldingPnlResult {
  const marketValue = currentPrice * holding.quantity;
  const unrealizedPnl = marketValue - holding.costBasis;
  const unrealizedPnlPercent =
    holding.costBasis > 0 ? (unrealizedPnl / holding.costBasis) * 100 : 0;

  return { marketValue, unrealizedPnl, unrealizedPnlPercent };
}

// -----------------------------------------------------------------------------
// Holdings With PnL
// -----------------------------------------------------------------------------

/**
 * Enriches all holdings with current prices and PnL data.
 * Returns holdings sorted by market value (descending).
 *
 * @param holdings - Map of symbol → PortfolioHolding
 * @param tickers - Map of symbol → { price } from watchlistStore
 * @param cashBalance - Current cash balance
 */
export function calculateHoldingsWithPnl(
  holdings: Map<string, PortfolioHolding>,
  tickers: Map<string, { price: number }>,
  cashBalance: number,
): HoldingWithPnl[] {
  if (holdings.size === 0) return [];

  // Calculate total portfolio value for allocation %
  let totalValue = cashBalance;
  const enriched: HoldingWithPnl[] = [];

  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? 0;
    const { marketValue, unrealizedPnl, unrealizedPnlPercent } = calculateHoldingPnl(
      holding,
      currentPrice,
    );
    totalValue += marketValue;
    enriched.push({
      ...holding,
      currentPrice,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPercent,
      allocationPercent: 0, // Computed below
    });
  }

  // Compute allocation percentages
  for (const item of enriched) {
    item.allocationPercent = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
  }

  // Sort by market value descending
  enriched.sort((a, b) => b.marketValue - a.marketValue);

  return enriched;
}

// -----------------------------------------------------------------------------
// Portfolio Summary
// -----------------------------------------------------------------------------

/**
 * Calculates aggregate portfolio summary.
 */
export function calculatePortfolioSummary(
  holdings: Map<string, PortfolioHolding>,
  tickers: Map<string, { price: number }>,
  cashBalance: number,
): PortfolioSummary {
  let totalMarketValue = 0;
  let totalCostBasis = 0;

  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? 0;
    totalMarketValue += currentPrice * holding.quantity;
    totalCostBasis += holding.costBasis;
  }

  const totalValue = totalMarketValue + cashBalance;
  const totalUnrealizedPnl = totalMarketValue - totalCostBasis;
  const totalUnrealizedPnlPercent =
    totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;

  return {
    totalValue,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent,
    holdingCount: holdings.size,
  };
}

// -----------------------------------------------------------------------------
// Allocation Slices (for Donut Chart)
// -----------------------------------------------------------------------------

/**
 * Builds allocation slices for the portfolio donut chart.
 * Includes a "Cash" slice. Returns slices sorted by value (descending).
 */
export function calculateAllocationSlices(
  holdings: Map<string, PortfolioHolding>,
  tickers: Map<string, { price: number }>,
  cashBalance: number,
): AllocationSlice[] {
  let totalValue = cashBalance;
  const assetSlices: AllocationSlice[] = [];
  let colorIndex = 0;

  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? 0;
    const marketValue = currentPrice * holding.quantity;
    totalValue += marketValue;

    // Extract base asset name from symbol (e.g., 'BTCUSDT' → 'BTC')
    const label = holding.symbol.replace(/USDT$/, '');
    assetSlices.push({
      label,
      value: marketValue,
      percent: 0, // Computed below
      color: ALLOCATION_PALETTE[colorIndex % ALLOCATION_PALETTE.length],
    });
    colorIndex++;
  }

  // Compute percentages
  for (const slice of assetSlices) {
    slice.percent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0;
  }

  // Sort by value descending
  assetSlices.sort((a, b) => b.value - a.value);

  // Add cash slice
  const cashPercent = totalValue > 0 ? (cashBalance / totalValue) * 100 : 100;
  assetSlices.push({
    label: 'Cash',
    value: cashBalance,
    percent: cashPercent,
    color: CASH_COLOR,
  });

  return assetSlices;
}

// -----------------------------------------------------------------------------
// Trade Application (Holding Updates)
// -----------------------------------------------------------------------------

/**
 * Applies a buy trade to an existing (or new) holding.
 * Returns the updated holding.
 */
export function applyBuyTrade(
  existing: PortfolioHolding | undefined,
  symbol: string,
  price: number,
  quantity: number,
): PortfolioHolding {
  if (!existing) {
    return {
      symbol,
      quantity,
      avgEntryPrice: price,
      costBasis: price * quantity,
    };
  }

  const newQuantity = existing.quantity + quantity;
  const newCostBasis = existing.costBasis + price * quantity;
  const newAvgEntry = newCostBasis / newQuantity;

  return {
    symbol,
    quantity: newQuantity,
    avgEntryPrice: newAvgEntry,
    costBasis: newCostBasis,
  };
}

/**
 * Applies a sell trade to an existing holding.
 * Returns the updated holding, or undefined if fully sold.
 *
 * Cost basis is reduced proportionally (avgEntryPrice stays the same).
 */
export function applySellTrade(
  existing: PortfolioHolding,
  price: number,
  quantity: number,
): PortfolioHolding | undefined {
  const remainingQuantity = existing.quantity - quantity;

  // Fully sold — remove holding
  if (remainingQuantity <= 1e-10) {
    return undefined;
  }

  // Proportionally reduce cost basis (avgEntryPrice unchanged)
  const ratio = remainingQuantity / existing.quantity;
  const newCostBasis = existing.costBasis * ratio;

  return {
    symbol: existing.symbol,
    quantity: remainingQuantity,
    avgEntryPrice: existing.avgEntryPrice,
    costBasis: newCostBasis,
  };
}

// -----------------------------------------------------------------------------
// CSV Export
// -----------------------------------------------------------------------------

/**
 * Converts an array of portfolio trades to CSV string.
 */
export function tradesToCsv(trades: PortfolioTrade[]): string {
  const header = 'id,symbol,side,price,quantity,notional,timestamp';
  const rows = trades.map(
    (t) =>
      `${t.id},${t.symbol},${t.side},${t.price},${t.quantity},${t.notional},${new Date(t.timestamp).toISOString()}`,
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
// Exports (types re-exported for convenience)
// -----------------------------------------------------------------------------

export { ALLOCATION_PALETTE, CASH_COLOR };
export type { HoldingPnlResult };
