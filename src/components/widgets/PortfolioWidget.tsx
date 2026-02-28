'use client';

// =============================================================================
// PortfolioWidget Component — Futures Paper Trading
// =============================================================================
// Futures paper trading portfolio widget. Shows:
// - Summary bar: Total Equity + Available Balance / Unrealized PnL + Margin Ratio
// - Canvas donut chart for margin allocation (left) + positions/history tabs
// - Position rows with PnL color coding, TP/SL display, notional value
// - History rows with fee display and close reason badges
// - Inline reset confirmation dialog
// - Auto-close check (liquidation + TP/SL) via useEffect on price changes
// Trade panel is rendered separately in TradePanelWidget.
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
import { useToastStore } from '@/stores/toastStore';
import {
  calculateFuturesSummary,
  calculatePositionsWithPnl,
  calculateAllocationSlices,
  tradesToCsv,
  downloadCsv,
} from '@/utils/portfolioCalc';
import { renderFuturesSnapshot, getThemeColors } from '@/utils/portfolioSnapshot';
import { SnapshotPreviewModal } from '@/components/ui/SnapshotPreviewModal';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { WidgetWrapper } from './WidgetWrapper';
import type { FuturesTrade, PositionWithPnl, CloseReason, PositionSide } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Margin Ratio Bar
// -----------------------------------------------------------------------------

interface MarginRatioBarProps {
  ratio: number;
  percent: number;
}

const MarginRatioBar = memo(function MarginRatioBar({ ratio, percent }: MarginRatioBarProps) {
  const barColor = ratio < 50 ? 'bg-buy' : ratio < 80 ? 'bg-[#F0B90B]' : 'bg-sell';
  const textColor = ratio < 50 ? 'text-buy' : ratio < 80 ? 'text-[#F0B90B]' : 'text-sell';

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground-secondary text-[10px]">Margin Ratio</span>
      <div className="bg-background h-2 flex-1 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`font-mono-num text-[10px] font-semibold ${textColor}`}>
        {ratio.toFixed(1)}%
      </span>
    </div>
  );
});

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface SummaryBarProps {
  totalEquity: number;
  availableBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  marginRatio: number;
  marginRatioPercent: number;
  positionCount: number;
}

const SummaryBar = memo(function SummaryBar({
  totalEquity,
  availableBalance,
  totalPnl,
  totalPnlPercent,
  marginRatio,
  marginRatioPercent,
  positionCount,
}: SummaryBarProps) {
  const pnlColor =
    totalPnl > 0 ? 'text-buy' : totalPnl < 0 ? 'text-sell' : 'text-foreground-secondary';
  const pnlSign = totalPnl > 0 ? '+' : '';
  const pnlBg = totalPnl > 0 ? 'bg-buy/5' : totalPnl < 0 ? 'bg-sell/5' : '';

  return (
    <div className="border-border flex flex-col gap-1.5 border-b px-3 py-2.5">
      {/* Row 1: Total Equity + Available */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-foreground-secondary text-[10px]">Total Equity</span>
          <span className="font-mono-num text-foreground text-sm font-semibold">
            ${formatPrice(totalEquity)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-foreground-secondary text-[10px]">Available</span>
          <span className="font-mono-num text-foreground text-xs">
            ${formatPrice(availableBalance)}
          </span>
        </div>
      </div>
      {/* Row 2: Unrealized PnL + Position count */}
      <div className="flex items-center justify-between">
        <span
          className={`font-mono-num rounded px-1.5 py-0.5 text-xs font-medium ${pnlColor} ${pnlBg}`}
        >
          {pnlSign}${formatPrice(Math.abs(totalPnl))} ({pnlSign}
          {totalPnlPercent.toFixed(2)}%)
        </span>
        <span className="text-foreground-secondary text-[10px]">
          {positionCount} {positionCount === 1 ? 'position' : 'positions'}
        </span>
      </div>
      {/* Row 3: Margin Ratio Bar */}
      {positionCount > 0 && <MarginRatioBar ratio={marginRatio} percent={marginRatioPercent} />}
    </div>
  );
});

// -----------------------------------------------------------------------------
// Close Reason Badge
// -----------------------------------------------------------------------------

function getCloseReasonBadge(reason: CloseReason | null): {
  label: string;
  className: string;
} | null {
  switch (reason) {
    case 'liquidated':
      return { label: 'LIQ', className: 'bg-sell/15 text-sell font-bold' };
    case 'take-profit':
      return { label: 'TP', className: 'bg-buy/15 text-buy font-bold' };
    case 'stop-loss':
      return { label: 'SL', className: 'bg-[#F0B90B]/15 text-[#F0B90B] font-bold' };
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Positions Tab
// -----------------------------------------------------------------------------

interface PositionsTabProps {
  positions: PositionWithPnl[];
  onClose: (symbol: string, side: PositionSide, price: number, quantity: number) => boolean;
  onSelectSymbol: (symbol: string) => void;
}

const PositionsTab = memo(function PositionsTab({
  positions,
  onClose,
  onSelectSymbol,
}: PositionsTabProps) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-6">
        <span className="text-foreground-tertiary text-lg">&#9746;</span>
        <span className="text-foreground-secondary text-xs">No open positions</span>
        <span className="text-foreground-tertiary text-[10px]">
          Open a position using the Trade Panel
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {positions.map((pos) => {
        const pnlColor =
          pos.unrealizedPnl > 0
            ? 'text-buy'
            : pos.unrealizedPnl < 0
              ? 'text-sell'
              : 'text-foreground-secondary';
        const sign = pos.unrealizedPnl > 0 ? '+' : '';
        const sideColor = pos.side === 'long' ? 'bg-buy' : 'bg-sell';
        const bgColor =
          pos.unrealizedPnl > 0 ? 'bg-buy/5' : pos.unrealizedPnl < 0 ? 'bg-sell/5' : '';

        return (
          <div
            key={pos.id}
            className={`border-border/30 flex flex-col gap-1 border-b px-3 py-2 ${bgColor}`}
          >
            {/* Row 1: Symbol + Side badge + PnL + Close button */}
            <div className="flex items-center">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-bold text-white ${sideColor}`}
                >
                  {pos.side === 'long' ? 'L' : 'S'}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectSymbol(pos.symbol)}
                  className="text-foreground hover:text-accent cursor-pointer truncate text-xs font-medium transition-colors"
                >
                  {formatSymbol(pos.symbol)}
                </button>
                <span className="text-foreground-secondary text-[10px]">{pos.leverage}x</span>
              </div>
              <span className={`font-mono-num text-xs font-medium ${pnlColor}`}>
                {sign}${formatPrice(Math.abs(pos.unrealizedPnl))}
              </span>
              <button
                type="button"
                onClick={() => onClose(pos.symbol, pos.side, pos.currentPrice, pos.quantity)}
                className="text-foreground-tertiary hover:bg-sell/10 hover:text-sell ml-2 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-all"
              >
                Close
              </button>
            </div>

            {/* Row 1.5: ROE percentage */}
            <div className="flex items-center justify-between">
              <span className={`font-mono-num text-[10px] ${pnlColor}`}>
                ROE: {sign}
                {pos.roe.toFixed(2)}%
              </span>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Notional: ${formatPrice(pos.notionalValue)}
              </span>
            </div>

            {/* Row 2: Entry price + Margin */}
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Entry: {formatPrice(pos.entryPrice)}
              </span>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Margin: ${formatPrice(pos.margin)}
              </span>
            </div>

            {/* Row 3: Liquidation price + TP/SL */}
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Liq:{' '}
                {pos.liquidationPrice === 0 || pos.liquidationPrice === Infinity
                  ? '\u2014'
                  : formatPrice(pos.liquidationPrice)}
              </span>
              <div className="flex items-center gap-2">
                {pos.takeProfitPrice !== null && (
                  <span className="text-buy font-mono-num text-[10px]">
                    TP: {formatPrice(pos.takeProfitPrice)}
                  </span>
                )}
                {pos.stopLossPrice !== null && (
                  <span className="text-sell font-mono-num text-[10px]">
                    SL: {formatPrice(pos.stopLossPrice)}
                  </span>
                )}
              </div>
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
  trades: FuturesTrade[];
}

const HistoryTab = memo(function HistoryTab({ trades }: HistoryTabProps) {
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
        const sideColor = t.side === 'long' ? 'bg-buy' : 'bg-sell';
        const actionLabel = t.action === 'open' ? 'OPEN' : 'CLOSE';
        const actionColor = t.action === 'open' ? 'text-foreground-secondary' : 'text-foreground';
        const timeStr = new Date(t.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const showPnl = t.action === 'close';
        const pnlColor =
          t.realizedPnl > 0
            ? 'text-buy'
            : t.realizedPnl < 0
              ? 'text-sell'
              : 'text-foreground-secondary';
        const pnlSign = t.realizedPnl > 0 ? '+' : '';
        const badge = getCloseReasonBadge(t.closeReason);

        return (
          <div key={t.id} className="border-border/30 flex items-center border-b px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-bold text-white ${sideColor}`}
                >
                  {t.side === 'long' ? 'L' : 'S'}
                </span>
                <span className={`text-[10px] font-medium ${actionColor}`}>{actionLabel}</span>
                <span className="text-foreground text-xs font-medium">
                  {formatSymbol(t.symbol)}
                </span>
                <span className="text-foreground-secondary text-[10px]">{t.leverage}x</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground-secondary font-mono-num text-[10px]">
                  {parseFloat(t.quantity.toFixed(8))} @ {formatPrice(t.price)}
                </span>
                {t.fee > 0 && (
                  <span className="text-foreground-tertiary font-mono-num text-[10px]">
                    Fee: ${formatPrice(t.fee)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              {showPnl ? (
                <span className={`font-mono-num text-xs font-medium ${pnlColor}`}>
                  {pnlSign}${formatPrice(Math.abs(t.realizedPnl))}
                </span>
              ) : (
                <span className="text-foreground-tertiary text-xs">{'\u2014'}</span>
              )}
              <div className="flex items-center gap-1">
                {badge && (
                  <span className={`rounded px-1 py-0.5 text-[8px] ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                <span className="text-foreground-tertiary text-[10px]">{timeStr}</span>
              </div>
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
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null);

  // Store selectors
  const theme = useUiStore((state) => state.theme);
  const setSymbol = useUiStore((state) => state.setSymbol);
  const walletBalance = usePortfolioStore((state) => state.walletBalance);
  const positions = usePortfolioStore((state) => state.positions);
  const trades = usePortfolioStore((state) => state.trades);
  const activeTab = usePortfolioStore((state) => state.activeTab);
  const setActiveTab = usePortfolioStore((state) => state.setActiveTab);
  const closePosition = usePortfolioStore((state) => state.closePosition);
  const checkAutoClose = usePortfolioStore((state) => state.checkAutoClose);
  const resetPortfolio = usePortfolioStore((state) => state.resetPortfolio);
  const binancePrices = useWatchlistStore((state) => state.binancePrices);
  const addToast = useToastStore((state) => state.addToast);

  // Summary calculation — always uses Binance USDT prices for correct PnL
  const summary = useMemo(
    () => calculateFuturesSummary(positions, binancePrices, walletBalance),
    [positions, binancePrices, walletBalance],
  );

  // Positions with PnL for PositionsTab
  const positionsWithPnl = useMemo(
    () => calculatePositionsWithPnl(positions, binancePrices, walletBalance),
    [positions, binancePrices, walletBalance],
  );

  // Allocation slices for donut chart
  const allocationSlices = useMemo(
    () => calculateAllocationSlices(positions, binancePrices, walletBalance),
    [positions, binancePrices, walletBalance],
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

  // Auto-close check (liquidation + TP + SL) — uses Binance USDT prices
  useEffect(() => {
    if (positions.size === 0) return;

    const priceMap = new Map<string, number>();
    for (const [sym, ticker] of binancePrices) {
      priceMap.set(sym, ticker.price);
    }

    const results = checkAutoClose(priceMap);
    for (const result of results) {
      const label = formatSymbol(result.symbol);
      const sideLabel = result.side === 'long' ? 'Long' : 'Short';
      if (result.reason === 'liquidated') {
        addToast(`${label} ${sideLabel} position liquidated!`, 'error', 6000);
      } else if (result.reason === 'take-profit') {
        addToast(`${label} ${sideLabel} take profit triggered!`, 'success', 4000);
      } else if (result.reason === 'stop-loss') {
        addToast(`${label} ${sideLabel} stop loss triggered!`, 'warning', 4000);
      }
    }
  }, [binancePrices, positions, checkAutoClose, addToast]);

  // Callbacks
  const handleClosePosition = useCallback(
    (sym: string, side: PositionSide, price: number, qty: number) =>
      closePosition(sym, side, price, qty),
    [closePosition],
  );

  const handleExportCsv = useCallback(() => {
    const csv = tradesToCsv(trades);
    downloadCsv(csv, `futures-trades-${Date.now()}.csv`);
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

  const handleScreenshot = useCallback(async () => {
    const colors = getThemeColors();
    const blob = await renderFuturesSnapshot({ summary, positions: positionsWithPnl }, colors);
    setSnapshotBlob(blob);
  }, [summary, positionsWithPnl]);

  const handleCloseSnapshot = useCallback(() => {
    setSnapshotBlob(null);
  }, []);

  const handleTabPositions = useCallback(() => setActiveTab('positions'), [setActiveTab]);
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
            title="Reset to $100K"
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

  const snapshotFilename = `futures-portfolio-${new Date().toISOString().slice(0, 10)}.png`;

  return (
    <>
      <WidgetWrapper title="Futures" headerActions={headerActions}>
        <div className="flex h-full flex-col">
          {/* Summary bar */}
          <SummaryBar
            totalEquity={summary.totalEquity}
            availableBalance={summary.availableBalance}
            totalPnl={summary.totalUnrealizedPnl}
            totalPnlPercent={summary.totalUnrealizedPnlPercent}
            marginRatio={summary.marginRatio}
            marginRatioPercent={summary.marginRatioPercent}
            positionCount={summary.positionCount}
          />

          {/* Donut chart */}
          <div ref={containerRef} className="h-32 w-full shrink-0">
            <canvas ref={canvasRef} className="block h-full w-full" />
          </div>

          {/* Tab buttons — always visible above scrollable content */}
          <div className="border-border bg-background-secondary flex shrink-0 border-b">
            <button
              type="button"
              onClick={handleTabPositions}
              className={`flex-1 cursor-pointer py-2 text-xs transition-all ${
                activeTab === 'positions'
                  ? 'border-accent text-accent border-b-2 font-semibold'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50'
              }`}
            >
              Positions{summary.positionCount > 0 ? ` (${summary.positionCount})` : ''}
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

          {/* Tab content — only this area scrolls */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'positions' ? (
              <PositionsTab
                positions={positionsWithPnl}
                onClose={handleClosePosition}
                onSelectSymbol={setSymbol}
              />
            ) : (
              <HistoryTab trades={trades} />
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
