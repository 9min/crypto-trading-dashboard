// =============================================================================
// Spot Portfolio Calculation Utilities
// =============================================================================
// Pure functions for KRW spot trading: fee, average entry, unrealized PnL,
// holding enrichment, summary, allocation slices, and CSV export.
// No side effects — all functions take inputs and return results.
// =============================================================================

import type { SpotHolding, SpotTrade, HoldingWithPnl, SpotSummary } from '@/types/spot';
import type { AllocationSlice } from '@/types/portfolio';
import { SPOT_FEE_RATE } from '@/types/spot';
import { ALLOCATION_PALETTE, CASH_COLOR } from '@/utils/portfolioCalc';

// -----------------------------------------------------------------------------
// Core Calculation Functions
// -----------------------------------------------------------------------------

/**
 * Calculates the spot trading fee.
 * fee = price * quantity * SPOT_FEE_RATE (0.05%)
 */
export function calculateSpotFee(price: number, quantity: number): number {
  return price * quantity * SPOT_FEE_RATE;
}

/**
 * Calculates the weighted average entry price when buying more of an asset.
 * avgEntry = (oldEntry * oldQty + newEntry * newQty) / (oldQty + newQty)
 */
export function calculateSpotAverageEntry(
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
 * Calculates unrealized PnL for a spot holding.
 * PnL = (currentPrice - avgEntryPrice) * quantity
 */
export function calculateSpotUnrealizedPnl(
  avgEntryPrice: number,
  currentPrice: number,
  quantity: number,
): number {
  return (currentPrice - avgEntryPrice) * quantity;
}

// -----------------------------------------------------------------------------
// Holding PnL Enrichment
// -----------------------------------------------------------------------------

/**
 * Enriches a single holding with current PnL data.
 */
export function calculateHoldingPnl(
  holding: SpotHolding,
  currentPrice: number,
  totalValue: number,
): HoldingWithPnl {
  const unrealizedPnl = calculateSpotUnrealizedPnl(
    holding.avgEntryPrice,
    currentPrice,
    holding.quantity,
  );
  const marketValue = currentPrice * holding.quantity;
  const pnlPercent = holding.costBasis > 0 ? (unrealizedPnl / holding.costBasis) * 100 : 0;
  const allocationPercent = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;

  return {
    ...holding,
    currentPrice,
    unrealizedPnl,
    pnlPercent,
    marketValue,
    allocationPercent,
  };
}

/**
 * Enriches all holdings with current prices and PnL data.
 * Returns holdings sorted by market value (descending).
 */
export function calculateHoldingsWithPnl(
  holdings: Map<string, SpotHolding>,
  tickers: Map<string, { price: number }>,
  walletBalance: number,
): HoldingWithPnl[] {
  if (holdings.size === 0) return [];

  // First pass: compute total market value for allocation calculation
  let totalMarketValue = 0;
  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? holding.avgEntryPrice;
    totalMarketValue += currentPrice * holding.quantity;
  }

  const totalValue = walletBalance + totalMarketValue;

  // Second pass: enrich holdings
  const enriched: HoldingWithPnl[] = [];
  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? holding.avgEntryPrice;
    enriched.push(calculateHoldingPnl(holding, currentPrice, totalValue));
  }

  // Sort by market value descending
  enriched.sort((a, b) => b.marketValue - a.marketValue);

  return enriched;
}

// -----------------------------------------------------------------------------
// Spot Summary
// -----------------------------------------------------------------------------

/**
 * Calculates aggregate spot portfolio summary.
 */
export function calculateSpotSummary(
  holdings: Map<string, SpotHolding>,
  tickers: Map<string, { price: number }>,
  walletBalance: number,
): SpotSummary {
  let totalMarketValue = 0;
  let totalUnrealizedPnl = 0;
  let totalCostBasis = 0;

  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? holding.avgEntryPrice;
    totalMarketValue += currentPrice * holding.quantity;
    totalUnrealizedPnl += calculateSpotUnrealizedPnl(
      holding.avgEntryPrice,
      currentPrice,
      holding.quantity,
    );
    totalCostBasis += holding.costBasis;
  }

  const totalValue = walletBalance + totalMarketValue;
  const totalUnrealizedPnlPercent =
    totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;

  return {
    totalValue,
    walletBalance,
    totalMarketValue,
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
 * Each holding creates a slice labeled with the base asset (e.g., "BTC").
 * Includes a "Cash" slice. Returns slices sorted by value (descending).
 */
export function calculateSpotAllocationSlices(
  holdings: Map<string, SpotHolding>,
  tickers: Map<string, { price: number }>,
  walletBalance: number,
): AllocationSlice[] {
  const assetSlices: AllocationSlice[] = [];
  let totalMarketValue = 0;
  let colorIndex = 0;

  for (const holding of holdings.values()) {
    const currentPrice = tickers.get(holding.symbol)?.price ?? holding.avgEntryPrice;
    const marketValue = currentPrice * holding.quantity;
    totalMarketValue += marketValue;

    // Label: base asset only (e.g., "BTC", "ETH")
    const base = holding.symbol.replace(/USDT$/, '');

    assetSlices.push({
      label: base,
      value: marketValue,
      percent: 0, // Computed below
      color: ALLOCATION_PALETTE[colorIndex % ALLOCATION_PALETTE.length],
    });
    colorIndex++;
  }

  const totalValue = totalMarketValue + walletBalance;

  // Compute percentages
  for (const slice of assetSlices) {
    slice.percent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0;
  }

  // Sort by value descending
  assetSlices.sort((a, b) => b.value - a.value);

  // Add cash slice
  const cashPercent = totalValue > 0 ? (walletBalance / totalValue) * 100 : 100;
  assetSlices.push({
    label: 'Cash',
    value: walletBalance,
    percent: cashPercent,
    color: CASH_COLOR,
  });

  return assetSlices;
}

// -----------------------------------------------------------------------------
// CSV Export
// -----------------------------------------------------------------------------

/**
 * Converts an array of spot trades to CSV string.
 */
export function spotTradesToCsv(trades: SpotTrade[]): string {
  const header = 'id,symbol,action,price,quantity,fee,realizedPnl,timestamp';
  const rows = trades.map(
    (t) =>
      `${t.id},${t.symbol},${t.action},${t.price},${t.quantity},${t.fee},${t.realizedPnl},${new Date(t.timestamp).toISOString()}`,
  );
  return [header, ...rows].join('\n');
}
