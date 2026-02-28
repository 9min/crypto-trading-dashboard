'use client';

// =============================================================================
// PortfolioWidget Component — Futures Paper Trading
// =============================================================================
// Futures paper trading portfolio widget. Shows:
// - Summary bar: Total Equity + Available Balance / Unrealized PnL
// - Canvas donut chart for margin allocation (left) + positions/history tabs
// - Inline reset confirmation dialog
// - TradePanel with Long/Short tabs for market orders
// - Auto-liquidation check via useEffect on price changes
//
// Data flow: watchlistStore.tickers + portfolioStore.positions → useMemo →
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
import { useToastStore } from '@/stores/toastStore';
import {
  calculateFuturesSummary,
  calculatePositionsWithPnl,
  calculateAllocationSlices,
  tradesToCsv,
  downloadCsv,
} from '@/utils/portfolioCalc';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { TradePanel } from '@/components/ui/TradePanel';
import { WidgetWrapper } from './WidgetWrapper';
import type { FuturesTrade, PositionWithPnl } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface SummaryBarProps {
  totalEquity: number;
  availableBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
}

const SummaryBar = memo(function SummaryBar({
  totalEquity,
  availableBalance,
  totalPnl,
  totalPnlPercent,
}: SummaryBarProps) {
  const pnlColor =
    totalPnl > 0 ? 'text-buy' : totalPnl < 0 ? 'text-sell' : 'text-foreground-secondary';
  const pnlSign = totalPnl > 0 ? '+' : '';

  return (
    <div className="border-border grid grid-cols-2 gap-x-3 gap-y-0.5 border-b px-3 py-2">
      {/* Row 1 left: Total Equity */}
      <div className="flex flex-col">
        <span className="text-foreground-secondary text-[10px]">Total Equity</span>
        <span className="font-mono-num text-foreground text-sm font-semibold">
          ${formatPrice(totalEquity)}
        </span>
      </div>
      {/* Row 1 right: Available Balance */}
      <div className="flex flex-col items-end">
        <span className="text-foreground-secondary text-[10px]">Available</span>
        <span className="font-mono-num text-foreground text-xs">
          ${formatPrice(availableBalance)}
        </span>
      </div>
      {/* Row 2: Unrealized PnL spanning full width */}
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
// Positions Tab
// -----------------------------------------------------------------------------

interface PositionsTabProps {
  positions: PositionWithPnl[];
  onClose: (symbol: string, price: number, quantity: number) => boolean;
}

const PositionsTab = memo(function PositionsTab({ positions, onClose }: PositionsTabProps) {
  if (positions.length === 0) {
    return (
      <div className="text-foreground-secondary flex h-full items-center justify-center text-xs">
        No open positions
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {positions.map((pos) => {
        const pnlColor =
          pos.unrealizedPnl > 0
            ? 'text-buy'
            : pos.unrealizedPnl < 0
              ? 'text-sell'
              : 'text-foreground-secondary';
        const sign = pos.unrealizedPnl > 0 ? '+' : '';
        const sideLabel = pos.side === 'long' ? 'LONG' : 'SHORT';
        const sideColor = pos.side === 'long' ? 'text-buy' : 'text-sell';

        return (
          <div key={pos.id} className="border-border/30 flex flex-col gap-0.5 border-b px-3 py-1.5">
            {/* Row 1: Symbol + Side badge + Close button */}
            <div className="flex items-center">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className={`text-[10px] font-bold ${sideColor}`}>{sideLabel}</span>
                <span className="text-foreground truncate text-xs font-medium">
                  {formatSymbol(pos.symbol)}
                </span>
                <span className="text-foreground-secondary text-[10px]">{pos.leverage}x</span>
              </div>
              <button
                type="button"
                onClick={() => onClose(pos.symbol, pos.currentPrice, pos.quantity)}
                className="text-foreground-tertiary hover:text-sell cursor-pointer text-[10px] transition-colors"
              >
                Close
              </button>
            </div>

            {/* Row 2: Entry price + Unrealized PnL */}
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Entry: {formatPrice(pos.entryPrice)}
              </span>
              <span className={`font-mono-num text-[10px] ${pnlColor}`}>
                {sign}${formatPrice(Math.abs(pos.unrealizedPnl))} ({sign}
                {pos.roe.toFixed(1)}%)
              </span>
            </div>

            {/* Row 3: Liquidation price + Margin */}
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Liq:{' '}
                {pos.liquidationPrice === 0 || pos.liquidationPrice === Infinity
                  ? '\u2014'
                  : formatPrice(pos.liquidationPrice)}
              </span>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                Margin: ${formatPrice(pos.margin)}
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
  trades: FuturesTrade[];
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
        const sideColor = t.side === 'long' ? 'text-buy' : 'text-sell';
        const actionLabel = t.action === 'open' ? 'OPEN' : 'CLOSE';
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

        return (
          <div key={t.id} className="border-border/30 flex items-center border-b px-3 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-medium uppercase ${sideColor}`}>
                  {t.side === 'long' ? 'L' : 'S'}
                </span>
                <span className="text-foreground-secondary text-[10px]">{actionLabel}</span>
                <span className="text-foreground text-xs">{formatSymbol(t.symbol)}</span>
                <span className="text-foreground-secondary text-[10px]">{t.leverage}x</span>
              </div>
              <span className="text-foreground-secondary font-mono-num text-[10px]">
                {parseFloat(t.quantity.toFixed(8))} @ {formatPrice(t.price)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              {showPnl ? (
                <span className={`font-mono-num text-xs ${pnlColor}`}>
                  {pnlSign}${formatPrice(Math.abs(t.realizedPnl))}
                </span>
              ) : (
                <span className="text-foreground-secondary text-xs">{'\u2014'}</span>
              )}
              <div className="flex items-center gap-1">
                {t.closeReason === 'liquidated' && (
                  <span className="text-sell text-[9px] font-bold">LIQ</span>
                )}
                <span className="text-foreground-secondary text-[10px]">{timeStr}</span>
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

  // Store selectors
  const theme = useUiStore((state) => state.theme);
  const symbol = useUiStore((state) => state.symbol);
  const walletBalance = usePortfolioStore((state) => state.walletBalance);
  const positions = usePortfolioStore((state) => state.positions);
  const trades = usePortfolioStore((state) => state.trades);
  const activeTab = usePortfolioStore((state) => state.activeTab);
  const defaultLeverage = usePortfolioStore((state) => state.defaultLeverage);
  const defaultMarginType = usePortfolioStore((state) => state.defaultMarginType);
  const setActiveTab = usePortfolioStore((state) => state.setActiveTab);
  const openPosition = usePortfolioStore((state) => state.openPosition);
  const closePosition = usePortfolioStore((state) => state.closePosition);
  const checkLiquidations = usePortfolioStore((state) => state.checkLiquidations);
  const resetPortfolio = usePortfolioStore((state) => state.resetPortfolio);
  const tickers = useWatchlistStore((state) => state.tickers);
  const addToast = useToastStore((state) => state.addToast);

  // Current symbol price for TradePanel
  const currentPrice = useMemo(() => tickers.get(symbol)?.price ?? 0, [tickers, symbol]);

  // Existing position on current symbol
  const existingPosition = useMemo(() => positions.get(symbol) ?? null, [positions, symbol]);

  // Summary calculation
  const summary = useMemo(
    () => calculateFuturesSummary(positions, tickers, walletBalance),
    [positions, tickers, walletBalance],
  );

  // Positions with PnL for PositionsTab
  const positionsWithPnl = useMemo(
    () => calculatePositionsWithPnl(positions, tickers, walletBalance),
    [positions, tickers, walletBalance],
  );

  // Allocation slices for donut chart
  const allocationSlices = useMemo(
    () => calculateAllocationSlices(positions, tickers, walletBalance),
    [positions, tickers, walletBalance],
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

  // Auto-liquidation check
  useEffect(() => {
    if (positions.size === 0) return;

    const priceMap = new Map<string, number>();
    for (const [sym, ticker] of tickers) {
      priceMap.set(sym, ticker.price);
    }

    const liquidated = checkLiquidations(priceMap);
    for (const sym of liquidated) {
      addToast(`${formatSymbol(sym)} position liquidated!`, 'error', 6000);
    }
  }, [tickers, positions, checkLiquidations, addToast]);

  // Callbacks
  const handleOpenPosition = useCallback(
    (params: Parameters<typeof openPosition>[0]) => openPosition(params),
    [openPosition],
  );

  const handleClosePosition = useCallback(
    (sym: string, price: number, qty: number) => closePosition(sym, price, qty),
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

  const handleTabPositions = useCallback(() => setActiveTab('positions'), [setActiveTab]);
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
    <WidgetWrapper title="Futures" headerActions={headerActions}>
      <div className="flex h-full flex-col">
        {/* Summary bar */}
        <SummaryBar
          totalEquity={summary.totalEquity}
          availableBalance={summary.availableBalance}
          totalPnl={summary.totalUnrealizedPnl}
          totalPnlPercent={summary.totalUnrealizedPnlPercent}
        />

        {/* Middle section: chart + tabs */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Donut chart */}
          <div ref={containerRef} className="h-32 w-full shrink-0">
            <canvas ref={canvasRef} className="block h-full w-full" />
          </div>

          {/* Tab buttons */}
          <div className="border-border flex shrink-0 border-b">
            <button
              type="button"
              onClick={handleTabPositions}
              className={`flex-1 cursor-pointer py-1.5 text-xs transition-colors ${
                activeTab === 'positions'
                  ? 'border-accent text-accent border-b-2 font-medium'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              Positions ({summary.positionCount})
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
            {activeTab === 'positions' ? (
              <PositionsTab positions={positionsWithPnl} onClose={handleClosePosition} />
            ) : (
              <HistoryTab trades={trades} />
            )}
          </div>
        </div>

        {/* Trade panel */}
        <TradePanel
          symbol={symbol}
          currentPrice={currentPrice}
          availableBalance={summary.availableBalance}
          defaultLeverage={defaultLeverage}
          defaultMarginType={defaultMarginType}
          existingPosition={existingPosition}
          onOpenPosition={handleOpenPosition}
          onClosePosition={handleClosePosition}
        />
      </div>
    </WidgetWrapper>
  );
});
