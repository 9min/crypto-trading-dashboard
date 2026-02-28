'use client';

// =============================================================================
// TradePanelWidget Component — Standalone Trade Panel
// =============================================================================
// Wraps the TradePanel UI in an independent widget for desktop grid layout.
// Manages its own store selectors, funding rate polling, and position lookup.
// =============================================================================

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUiStore } from '@/stores/uiStore';
import { calculateFuturesSummary } from '@/utils/portfolioCalc';
import { fetchFundingRate } from '@/lib/binance/restApi';
import { TradePanel } from '@/components/ui/TradePanel';
import { WidgetWrapper } from './WidgetWrapper';
import type { PositionSide, OpenPositionParams } from '@/types/portfolio';
import { positionKey } from '@/types/portfolio';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TradePanelWidget = memo(function TradePanelWidget() {
  const [fundingRate, setFundingRate] = useState<number | null>(null);
  const fundingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store selectors
  const symbol = useUiStore((state) => state.symbol);
  const walletBalance = usePortfolioStore((state) => state.walletBalance);
  const positions = usePortfolioStore((state) => state.positions);
  const defaultLeverage = usePortfolioStore((state) => state.defaultLeverage);
  const defaultMarginType = usePortfolioStore((state) => state.defaultMarginType);
  const openPosition = usePortfolioStore((state) => state.openPosition);
  const closePosition = usePortfolioStore((state) => state.closePosition);
  const tickers = useWatchlistStore((state) => state.tickers);

  // Current symbol price
  const currentPrice = useMemo(() => tickers.get(symbol)?.price ?? 0, [tickers, symbol]);

  // Existing positions on current symbol (hedge mode: independent long/short)
  const longPosition = useMemo(
    () => positions.get(positionKey(symbol, 'long')) ?? null,
    [positions, symbol],
  );
  const shortPosition = useMemo(
    () => positions.get(positionKey(symbol, 'short')) ?? null,
    [positions, symbol],
  );

  // Available balance from summary
  const availableBalance = useMemo(
    () => calculateFuturesSummary(positions, tickers, walletBalance).availableBalance,
    [positions, tickers, walletBalance],
  );

  // Funding rate polling (60s interval)
  useEffect(() => {
    let cancelled = false;

    const fetchRate = async () => {
      try {
        const data = await fetchFundingRate(symbol);
        if (!cancelled) {
          setFundingRate(parseFloat(data.lastFundingRate));
        }
      } catch (error) {
        if (!cancelled) {
          setFundingRate(null);
          console.error('[TradePanelWidget] Failed to fetch funding rate', {
            symbol,
            timestamp: Date.now(),
            error,
          });
        }
      }
    };

    fetchRate();
    fundingIntervalRef.current = setInterval(fetchRate, 60_000);

    return () => {
      cancelled = true;
      if (fundingIntervalRef.current !== null) {
        clearInterval(fundingIntervalRef.current);
        fundingIntervalRef.current = null;
      }
    };
  }, [symbol]);

  // Callbacks
  const handleOpenPosition = useCallback(
    (params: OpenPositionParams) => openPosition(params),
    [openPosition],
  );

  const handleClosePosition = useCallback(
    (sym: string, side: PositionSide, price: number, qty: number) =>
      closePosition(sym, side, price, qty),
    [closePosition],
  );

  return (
    <WidgetWrapper title="Trade">
      <TradePanel
        symbol={symbol}
        currentPrice={currentPrice}
        availableBalance={availableBalance}
        defaultLeverage={defaultLeverage}
        defaultMarginType={defaultMarginType}
        longPosition={longPosition}
        shortPosition={shortPosition}
        onOpenPosition={handleOpenPosition}
        onClosePosition={handleClosePosition}
        fundingRate={fundingRate}
      />
    </WidgetWrapper>
  );
});
