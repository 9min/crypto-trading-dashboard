'use client';

// =============================================================================
// SpotPortfolioWidget Component — KRW Spot Paper Trading
// =============================================================================
// KRW spot paper trading portfolio widget. Shows:
// - Summary bar: Total Value + KRW Balance / Unrealized PnL
// - Canvas donut chart for allocation (PortfolioChartRenderer with KRW prefix)
// - Holdings/History tabs with KRW formatting
// - Inline reset confirmation dialog
// Trade panel is rendered separately in SpotTradePanelWidget.
// =============================================================================

import { memo, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import {
  PortfolioChartRenderer,
  getPortfolioChartColors,
} from '@/lib/canvas/PortfolioChartRenderer';
import { useSpotStore } from '@/stores/spotStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUiStore } from '@/stores/uiStore';
import {
  calculateSpotSummary,
  calculateHoldingsWithPnl,
  calculateSpotAllocationSlices,
  spotTradesToCsv,
} from '@/utils/spotCalc';
import { downloadCsv } from '@/utils/portfolioCalc';
import { renderSpotSnapshot, getThemeColors } from '@/utils/portfolioSnapshot';
import { SnapshotPreviewModal } from '@/components/ui/SnapshotPreviewModal';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { WidgetWrapper } from './WidgetWrapper';
import type { SpotTrade, HoldingWithPnl } from '@/types/spot';

// -----------------------------------------------------------------------------
// KRW Formatting Helper
// -----------------------------------------------------------------------------

function formatKrw(price: number, decimals = 0): string {
  return '\u20A9' + formatPrice(price, decimals);
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface SpotSummaryBarProps {
  totalValue: number;
  walletBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  holdingCount: number;
}

const SpotSummaryBar = memo(function SpotSummaryBar({
  totalValue,
  walletBalance,
  totalPnl,
  totalPnlPercent,
  holdingCount,
}: SpotSummaryBarProps) {
  const pnlColor =
    totalPnl > 0 ? 'text-buy' : totalPnl < 0 ? 'text-sell' : 'text-foreground-secondary';
  const pnlSign = totalPnl > 0 ? '+' : '';
  const pnlBg = totalPnl > 0 ? 'bg-buy/5' : totalPnl < 0 ? 'bg-sell/5' : '';

  return (
    <div className="border-border flex flex-col gap-1.5 border-b px-3 py-2.5">
      {/* Row 1: Total Value + KRW Balance */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-foreground-secondary text-[10px]">Total Value</span>
          <span className="font-mono-num text-foreground text-sm font-semibold">
            {formatKrw(totalValue)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-foreground-secondary text-[10px]">KRW Balance</span>
          <span className="font-mono-num text-foreground text-xs">{formatKrw(walletBalance)}</span>
        </div>
      </div>
      {/* Row 2: Unrealized PnL + Holdings count */}
      <div className="flex items-center justify-between">
        <span
          className={`font-mono-num rounded px-1.5 py-0.5 text-xs font-medium ${pnlColor} ${pnlBg}`}
        >
          {pnlSign}
          {formatKrw(Math.abs(totalPnl))} ({pnlSign}
          {totalPnlPercent.toFixed(2)}%)
        </span>
        <span className="text-foreground-secondary text-[10px]">
          {holdingCount} {holdingCount === 1 ? 'holding' : 'holdings'}
        </span>
      </div>
    </div>
  );
});

// -----------------------------------------------------------------------------
// Holdings Tab
// -----------------------------------------------------------------------------

interface SpotHoldingsTabProps {
  holdings: HoldingWithPnl[];
  onSell: (symbol: string, price: number, quantity: number) => boolean;
  onSelectSymbol: (symbol: string) => void;
}

const SpotHoldingsTab = memo(function SpotHoldingsTab({
  holdings,
  onSell,
  onSelectSymbol,
}: SpotHoldingsTabProps) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-6">
        <span className="text-foreground-tertiary text-lg">&#9746;</span>
        <span className="text-foreground-secondary text-xs">No holdings</span>
        <span className="text-foreground-tertiary text-[10px]">
          Buy assets using the Trade Panel
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {holdings.map((h) => {
        const pnlColor =
          h.unrealizedPnl > 0
            ? 'text-buy'
            : h.unrealizedPnl < 0
              ? 'text-sell'
              : 'text-foreground-secondary';
        const sign = h.unrealizedPnl > 0 ? '+' : '';
        const bgColor = h.unrealizedPnl > 0 ? 'bg-buy/5' : h.unrealizedPnl < 0 ? 'bg-sell/5' : '';

        return (
          <div
            key={h.symbol}
            className={`border-border/30 flex flex-col gap-1 border-b px-3 py-2 ${bgColor}`}
          >
            {/* Row 1: Symbol + PnL + Sell button */}
            <div className="flex items-center">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectSymbol(h.symbol)}
                  className="text-foreground hover:text-accent cursor-pointer truncate text-xs font-medium transition-colors"
                >
                  {formatSymbol(h.symbol)}
                </button>
              </div>
              <span className={`font-mono-num text-xs font-medium ${pnlColor}`}>
                {sign}
                {formatKrw(Math.abs(h.unrealizedPnl))}
              </span>
              <button
                type="button"
                onClick={() => onSell(h.symbol, h.currentPrice, h.quantity)}
                className="text-foreground-tertiary hover:bg-sell/10 hover:text-sell ml-2 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-all"
              >
                Sell
              </button>
            </div>

            {/* Row 2: PnL percent + Market value */}
            <div className="flex items-center justify-between">
              <span className={`font-mono-num text-[10px] ${pnlColor}`}>
                {sign}
                {h.pnlPercent.toFixed(2)}%
              </span>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Value: {formatKrw(h.marketValue)}
              </span>
            </div>

            {/* Row 3: Entry price + Quantity */}
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Avg: {formatKrw(h.avgEntryPrice)}
              </span>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Qty: {parseFloat(h.quantity.toFixed(8))}
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

interface SpotHistoryTabProps {
  trades: SpotTrade[];
}

const SpotHistoryTab = memo(function SpotHistoryTab({ trades }: SpotHistoryTabProps) {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-6">
        <span className="text-foreground-tertiary text-lg">&#9783;</span>
        <span className="text-foreground-secondary text-xs">No trades yet</span>
        <span className="text-foreground-tertiary text-[10px]">
          Your trade history will appear here
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {trades.map((t) => {
        const actionColor = t.action === 'buy' ? 'bg-buy' : 'bg-sell';
        const actionLabel = t.action === 'buy' ? 'BUY' : 'SELL';
        const timeStr = new Date(t.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const showPnl = t.action === 'sell';
        const pnlColor =
          t.realizedPnl > 0
            ? 'text-buy'
            : t.realizedPnl < 0
              ? 'text-sell'
              : 'text-foreground-secondary';
        const pnlSign = t.realizedPnl > 0 ? '+' : '';

        return (
          <div key={t.id} className="border-border/30 flex items-center border-b px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-bold text-white ${actionColor}`}
                >
                  {actionLabel}
                </span>
                <span className="text-foreground text-xs font-medium">
                  {formatSymbol(t.symbol)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground-secondary font-mono-num text-[10px]">
                  {parseFloat(t.quantity.toFixed(8))} @ {formatKrw(t.price)}
                </span>
                {t.fee > 0 && (
                  <span className="text-foreground-tertiary font-mono-num text-[10px]">
                    Fee: {formatKrw(t.fee)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              {showPnl ? (
                <span className={`font-mono-num text-xs font-medium ${pnlColor}`}>
                  {pnlSign}
                  {formatKrw(Math.abs(t.realizedPnl))}
                </span>
              ) : (
                <span className="text-foreground-tertiary text-xs">{'\u2014'}</span>
              )}
              <span className="text-foreground-tertiary text-[10px]">{timeStr}</span>
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

export const SpotPortfolioWidget = memo(function SpotPortfolioWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null);

  // Store selectors
  const theme = useUiStore((state) => state.theme);
  const setSymbol = useUiStore((state) => state.setSymbol);
  const walletBalance = useSpotStore((state) => state.walletBalance);
  const holdings = useSpotStore((state) => state.holdings);
  const trades = useSpotStore((state) => state.trades);
  const activeTab = useSpotStore((state) => state.activeTab);
  const setActiveTab = useSpotStore((state) => state.setActiveTab);
  const sellAsset = useSpotStore((state) => state.sellAsset);
  const resetSpot = useSpotStore((state) => state.resetSpot);
  const tickers = useWatchlistStore((state) => state.tickers);

  // Summary calculation — uses Upbit KRW prices via tickers
  const summary = useMemo(
    () => calculateSpotSummary(holdings, tickers, walletBalance),
    [holdings, tickers, walletBalance],
  );

  // Holdings with PnL for HoldingsTab
  const holdingsWithPnl = useMemo(
    () => calculateHoldingsWithPnl(holdings, tickers, walletBalance),
    [holdings, tickers, walletBalance],
  );

  // Allocation slices for donut chart
  const allocationSlices = useMemo(
    () => calculateSpotAllocationSlices(holdings, tickers, walletBalance),
    [holdings, tickers, walletBalance],
  );

  // Canvas renderer
  const createRenderer = useCallback((ctx: CanvasRenderingContext2D) => {
    const renderer = new PortfolioChartRenderer(ctx);
    renderer.setCurrencyPrefix('\u20A9', 0);
    return renderer;
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
  const handleSellHolding = useCallback(
    (sym: string, price: number, qty: number) => sellAsset({ symbol: sym, price, quantity: qty }),
    [sellAsset],
  );

  const handleExportCsv = useCallback(() => {
    const csv = spotTradesToCsv(trades);
    downloadCsv(csv, `spot-trades-${Date.now()}.csv`);
  }, [trades]);

  const handleResetClick = useCallback(() => {
    setIsResetConfirming(true);
  }, []);

  const handleResetConfirm = useCallback(() => {
    resetSpot();
    setIsResetConfirming(false);
  }, [resetSpot]);

  const handleResetCancel = useCallback(() => {
    setIsResetConfirming(false);
  }, []);

  const handleScreenshot = useCallback(async () => {
    const colors = getThemeColors();
    const blob = await renderSpotSnapshot({ summary, holdings: holdingsWithPnl }, colors);
    setSnapshotBlob(blob);
  }, [summary, holdingsWithPnl]);

  const handleCloseSnapshot = useCallback(() => {
    setSnapshotBlob(null);
  }, []);

  const handleTabHoldings = useCallback(() => setActiveTab('holdings'), [setActiveTab]);
  const handleTabHistory = useCallback(() => setActiveTab('history'), [setActiveTab]);

  // Header actions
  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleScreenshot}
          className="text-foreground-tertiary hover:text-foreground cursor-pointer rounded px-1 transition-colors"
          aria-label="Take portfolio screenshot"
          title="Screenshot"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
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
            title="Reset to \u20A9100,000,000"
          >
            Reset
          </button>
        )}
      </div>
    ),
    [
      handleScreenshot,
      trades.length,
      handleExportCsv,
      isResetConfirming,
      handleResetClick,
      handleResetConfirm,
      handleResetCancel,
    ],
  );

  const snapshotFilename = `spot-portfolio-${new Date().toISOString().slice(0, 10)}.png`;

  return (
    <>
      <WidgetWrapper title="Spot" headerActions={headerActions}>
        <div className="flex h-full flex-col">
          {/* Summary bar */}
          <SpotSummaryBar
            totalValue={summary.totalValue}
            walletBalance={summary.walletBalance}
            totalPnl={summary.totalUnrealizedPnl}
            totalPnlPercent={summary.totalUnrealizedPnlPercent}
            holdingCount={summary.holdingCount}
          />

          {/* Donut chart */}
          <div ref={containerRef} className="h-32 w-full shrink-0">
            <canvas ref={canvasRef} className="block h-full w-full" />
          </div>

          {/* Tab buttons */}
          <div className="border-border bg-background-secondary flex shrink-0 border-b">
            <button
              type="button"
              onClick={handleTabHoldings}
              className={`flex-1 cursor-pointer py-2 text-xs transition-all ${
                activeTab === 'holdings'
                  ? 'border-accent text-accent border-b-2 font-semibold'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50'
              }`}
            >
              Holdings{summary.holdingCount > 0 ? ` (${summary.holdingCount})` : ''}
            </button>
            <button
              type="button"
              onClick={handleTabHistory}
              className={`flex-1 cursor-pointer py-2 text-xs transition-all ${
                activeTab === 'history'
                  ? 'border-accent text-accent border-b-2 font-semibold'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50'
              }`}
            >
              History{trades.length > 0 ? ` (${trades.length})` : ''}
            </button>
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'holdings' ? (
              <SpotHoldingsTab
                holdings={holdingsWithPnl}
                onSell={handleSellHolding}
                onSelectSymbol={setSymbol}
              />
            ) : (
              <SpotHistoryTab trades={trades} />
            )}
          </div>
        </div>
      </WidgetWrapper>
      <SnapshotPreviewModal
        isOpen={snapshotBlob !== null}
        onClose={handleCloseSnapshot}
        blob={snapshotBlob}
        filename={snapshotFilename}
      />
    </>
  );
});
