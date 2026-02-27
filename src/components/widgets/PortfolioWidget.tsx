'use client';

// =============================================================================
// PortfolioWidget Component
// =============================================================================
// Paper trading portfolio widget. Shows:
// - Summary bar: 2-row grid (Total Value + Cash / PnL highlight)
// - Canvas donut chart for allocation (left) + holdings/history tabs (right)
// - Inline reset confirmation dialog
// - TradePanel with Buy/Sell tabs for market orders
//
// Data flow: watchlistStore.tickers + portfolioStore.holdings → useMemo →
// renderer.updateSlices()
// =============================================================================

import { memo, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import {
  PortfolioChartRenderer,
  getPortfolioChartColors,
} from '@/lib/canvas/PortfolioChartRenderer';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUiStore } from '@/stores/uiStore';
import {
  calculatePortfolioSummary,
  calculateHoldingsWithPnl,
  calculateAllocationSlices,
  tradesToCsv,
  downloadCsv,
} from '@/utils/portfolioCalc';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { TradePanel } from '@/components/ui/TradePanel';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface SummaryBarProps {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  cashBalance: number;
}

const SummaryBar = memo(function SummaryBar({
  totalValue,
  totalPnl,
  totalPnlPercent,
  cashBalance,
}: SummaryBarProps) {
  const pnlColor =
    totalPnl > 0 ? 'text-buy' : totalPnl < 0 ? 'text-sell' : 'text-foreground-secondary';
  const pnlSign = totalPnl > 0 ? '+' : '';

  return (
    <div className="border-border grid grid-cols-2 gap-x-3 gap-y-0.5 border-b px-3 py-2">
      {/* Row 1 left: Total Value */}
      <div className="flex flex-col">
        <span className="text-foreground-secondary text-[10px]">Total Value</span>
        <span className="font-mono-num text-foreground text-sm font-semibold">
          ${formatPrice(totalValue)}
        </span>
      </div>
      {/* Row 1 right: Cash */}
      <div className="flex flex-col items-end">
        <span className="text-foreground-secondary text-[10px]">Cash</span>
        <span className="font-mono-num text-foreground text-xs">${formatPrice(cashBalance)}</span>
      </div>
      {/* Row 2: PnL spanning full width */}
      <div className="col-span-2">
        <span className={`font-mono-num text-xs font-medium ${pnlColor}`}>
          {pnlSign}${formatPrice(Math.abs(totalPnl))} ({pnlSign}
          {totalPnlPercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
});

// -----------------------------------------------------------------------------
// Holdings Tab
// -----------------------------------------------------------------------------

interface HoldingsTabProps {
  holdings: Map<
    string,
    { symbol: string; quantity: number; avgEntryPrice: number; costBasis: number }
  >;
  tickers: Map<string, { price: number }>;
  cashBalance: number;
}

const HoldingsTab = memo(function HoldingsTab({
  holdings,
  tickers,
  cashBalance,
}: HoldingsTabProps) {
  const enriched = useMemo(
    () => calculateHoldingsWithPnl(holdings, tickers, cashBalance),
    [holdings, tickers, cashBalance],
  );

  if (enriched.length === 0) {
    return (
      <div className="text-foreground-secondary flex h-full items-center justify-center text-xs">
        No holdings yet
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {enriched.map((h) => {
        const pnlColor =
          h.unrealizedPnl > 0
            ? 'text-buy'
            : h.unrealizedPnl < 0
              ? 'text-sell'
              : 'text-foreground-secondary';
        const sign = h.unrealizedPnl > 0 ? '+' : '';
        const alloc = h.allocationPercent;
        return (
          <div key={h.symbol} className="border-border/30 flex flex-col border-b px-3 py-1.5">
            <div className="flex items-center">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground truncate text-xs font-medium">
                  {formatSymbol(h.symbol)}
                </span>
                <span className="text-foreground-secondary font-mono-num text-[10px]">
                  {parseFloat(h.quantity.toFixed(8))} @ {formatPrice(h.avgEntryPrice)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono-num text-foreground text-xs">
                  ${formatPrice(h.marketValue)}
                </span>
                <span className={`font-mono-num text-[10px] ${pnlColor}`}>
                  {sign}${formatPrice(Math.abs(h.unrealizedPnl))} ({sign}
                  {h.unrealizedPnlPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
            {/* Allocation progress bar */}
            <div className="mt-0.5 flex items-center gap-1.5">
              <div className="bg-background-tertiary h-1 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full rounded-full transition-all"
                  style={{ width: `${Math.min(alloc, 100)}%` }}
                />
              </div>
              <span className="text-foreground-secondary font-mono-num w-8 text-right text-[9px]">
                {alloc.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// -----------------------------------------------------------------------------
// History Tab
// -----------------------------------------------------------------------------

interface HistoryTabProps {
  trades: Array<{
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    notional: number;
    timestamp: number;
  }>;
}

const HistoryTab = memo(function HistoryTab({ trades }: HistoryTabProps) {
  if (trades.length === 0) {
    return (
      <div className="text-foreground-secondary flex h-full items-center justify-center text-xs">
        No trades yet
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {trades.map((t) => {
        const sideColor = t.side === 'buy' ? 'text-buy' : 'text-sell';
        const timeStr = new Date(t.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div key={t.id} className="border-border/30 flex items-center border-b px-3 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-medium uppercase ${sideColor}`}>{t.side}</span>
                <span className="text-foreground text-xs">{formatSymbol(t.symbol)}</span>
              </div>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                {parseFloat(t.quantity.toFixed(8))} @ {formatPrice(t.price)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono-num text-foreground text-xs">
                ${formatPrice(t.notional)}
              </span>
              <span className="text-foreground-secondary text-[10px]">{timeStr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const PortfolioWidget = memo(function PortfolioWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  // Store selectors
  const theme = useUiStore((state) => state.theme);
  const symbol = useUiStore((state) => state.symbol);
  const cashBalance = usePortfolioStore((state) => state.cashBalance);
  const holdings = usePortfolioStore((state) => state.holdings);
  const trades = usePortfolioStore((state) => state.trades);
  const activeTab = usePortfolioStore((state) => state.activeTab);
  const setActiveTab = usePortfolioStore((state) => state.setActiveTab);
  const executeBuy = usePortfolioStore((state) => state.executeBuy);
  const executeSell = usePortfolioStore((state) => state.executeSell);
  const resetPortfolio = usePortfolioStore((state) => state.resetPortfolio);
  const tickers = useWatchlistStore((state) => state.tickers);

  // Current symbol price for TradePanel
  const currentPrice = useMemo(() => tickers.get(symbol)?.price ?? 0, [tickers, symbol]);

  // Current holding quantity for TradePanel
  const holdingQuantity = useMemo(() => holdings.get(symbol)?.quantity ?? 0, [holdings, symbol]);

  // Summary calculation
  const summary = useMemo(
    () => calculatePortfolioSummary(holdings, tickers, cashBalance),
    [holdings, tickers, cashBalance],
  );

  // Allocation slices for donut chart
  const allocationSlices = useMemo(
    () => calculateAllocationSlices(holdings, tickers, cashBalance),
    [holdings, tickers, cashBalance],
  );

  // Canvas renderer
  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    return new PortfolioChartRenderer(ctx);
  }, []);

  const rendererRef = useCanvasRenderer({
    canvasRef,
    containerRef,
    createRenderer,
  });

  // Push slices to renderer when data changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.updateSlices(allocationSlices);
  }, [allocationSlices, rendererRef]);

  // Theme sync
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setColors(getPortfolioChartColors(theme));
    renderer.markDirty();
  }, [theme, rendererRef]);

  // Callbacks
  const handleBuy = useCallback(
    (sym: string, price: number, qty: number) => executeBuy(sym, price, qty),
    [executeBuy],
  );

  const handleSell = useCallback(
    (sym: string, price: number, qty: number) => executeSell(sym, price, qty),
    [executeSell],
  );

  const handleExportCsv = useCallback(() => {
    const csv = tradesToCsv(trades);
    downloadCsv(csv, `portfolio-trades-${Date.now()}.csv`);
  }, [trades]);

  const handleResetClick = useCallback(() => {
    setIsResetConfirming(true);
  }, []);

  const handleResetConfirm = useCallback(() => {
    resetPortfolio();
    setIsResetConfirming(false);
  }, [resetPortfolio]);

  const handleResetCancel = useCallback(() => {
    setIsResetConfirming(false);
  }, []);

  const handleTabHoldings = useCallback(() => setActiveTab('holdings'), [setActiveTab]);
  const handleTabHistory = useCallback(() => setActiveTab('history'), [setActiveTab]);

  // Header actions
  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {trades.length > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="text-foreground-tertiary hover:text-foreground cursor-pointer rounded px-1 text-[10px] transition-colors"
            aria-label="Export trades CSV"
            title="Export CSV"
          >
            CSV
          </button>
        )}
        {isResetConfirming ? (
          <span className="flex items-center gap-1 text-[10px]">
            <span className="text-foreground-secondary">Reset?</span>
            <button
              type="button"
              onClick={handleResetConfirm}
              className="text-sell hover:text-sell/80 cursor-pointer font-medium transition-colors"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleResetCancel}
              className="text-foreground-secondary hover:text-foreground cursor-pointer transition-colors"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResetClick}
            className="text-foreground-tertiary hover:text-sell cursor-pointer rounded px-1 text-[10px] transition-colors"
            aria-label="Reset portfolio"
            title="Reset to $100K"
          >
            Reset
          </button>
        )}
      </div>
    ),
    [
      trades.length,
      handleExportCsv,
      isResetConfirming,
      handleResetClick,
      handleResetConfirm,
      handleResetCancel,
    ],
  );

  return (
    <WidgetWrapper title="Portfolio" headerActions={headerActions}>
      <div className="flex h-full flex-col">
        {/* Summary bar — 2-row grid */}
        <SummaryBar
          totalValue={summary.totalValue}
          totalPnl={summary.totalUnrealizedPnl}
          totalPnlPercent={summary.totalUnrealizedPnlPercent}
          cashBalance={cashBalance}
        />

        {/* Middle section: chart + tabs */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Donut chart — compact height */}
          <div ref={containerRef} className="h-32 w-full shrink-0">
            <canvas ref={canvasRef} className="block h-full w-full" />
          </div>

          {/* Tab buttons */}
          <div className="border-border flex shrink-0 border-b">
            <button
              type="button"
              onClick={handleTabHoldings}
              className={`flex-1 cursor-pointer py-1.5 text-xs transition-colors ${
                activeTab === 'holdings'
                  ? 'border-accent text-accent border-b-2 font-medium'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              Holdings ({summary.holdingCount})
            </button>
            <button
              type="button"
              onClick={handleTabHistory}
              className={`flex-1 cursor-pointer py-1.5 text-xs transition-colors ${
                activeTab === 'history'
                  ? 'border-accent text-accent border-b-2 font-medium'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              History ({trades.length})
            </button>
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === 'holdings' ? (
              <HoldingsTab holdings={holdings} tickers={tickers} cashBalance={cashBalance} />
            ) : (
              <HistoryTab trades={trades} />
            )}
          </div>
        </div>

        {/* Trade panel */}
        <TradePanel
          symbol={symbol}
          currentPrice={currentPrice}
          cashBalance={cashBalance}
          holdingQuantity={holdingQuantity}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      </div>
    </WidgetWrapper>
  );
});
