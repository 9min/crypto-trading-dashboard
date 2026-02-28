'use client';

// =============================================================================
// SpotTradePanelWidget Component — Standalone Spot Trade Panel
// =============================================================================
// Wraps the SpotTradePanel UI in an independent widget for desktop grid layout.
// No funding rate polling needed (spot trading has no funding).
// =============================================================================

import { memo, useCallback, useMemo } from 'react';
import { useSpotStore } from '@/stores/spotStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUiStore } from '@/stores/uiStore';
import { SpotTradePanel } from '@/components/ui/SpotTradePanel';
import { WidgetWrapper } from './WidgetWrapper';
import type { SpotBuyParams, SpotSellParams } from '@/types/spot';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SpotTradePanelWidget = memo(function SpotTradePanelWidget() {
  // Store selectors
  const symbol = useUiStore((state) => state.symbol);
  const walletBalance = useSpotStore((state) => state.walletBalance);
  const holdings = useSpotStore((state) => state.holdings);
  const buyAsset = useSpotStore((state) => state.buyAsset);
  const sellAsset = useSpotStore((state) => state.sellAsset);
  const tickers = useWatchlistStore((state) => state.tickers);

  // Current symbol price — uses Upbit KRW price via tickers
  const currentPrice = useMemo(() => tickers.get(symbol)?.price ?? 0, [tickers, symbol]);

  // Existing holding on current symbol
  const existingHolding = useMemo(() => holdings.get(symbol) ?? null, [holdings, symbol]);

  // Callbacks
  const handleBuy = useCallback((params: SpotBuyParams) => buyAsset(params), [buyAsset]);

  const handleSell = useCallback((params: SpotSellParams) => sellAsset(params), [sellAsset]);

  return (
    <WidgetWrapper title="Trade">
      <SpotTradePanel
        symbol={symbol}
        currentPrice={currentPrice}
        walletBalance={walletBalance}
        existingHolding={existingHolding}
        onBuy={handleBuy}
        onSell={handleSell}
      />
    </WidgetWrapper>
  );
});
