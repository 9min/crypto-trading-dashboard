'use client';

// =============================================================================
// WatchlistWidget Component
// =============================================================================
// DOM-based widget displaying a list of watchlist symbols with real-time
// prices and 24-hour price change percentages. Data is sourced from the
// watchlistStore, populated via REST API and updated by WebSocket miniTicker.
//
// Clicking a symbol updates uiStore.symbol, triggering all other widgets
// to switch to the selected pair.
// =============================================================================

import { memo, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useWatchlistStream } from '@/hooks/useWatchlistStream';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol } from '@/utils/formatSymbol';
import { WidgetWrapper } from './WidgetWrapper';
import type { WatchlistTicker } from '@/types/chart';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SymbolRowProps {
  symbol: string;
  isActive: boolean;
  ticker: WatchlistTicker | undefined;
  onSelect: (symbol: string) => void;
}

// -----------------------------------------------------------------------------
// Sub-Component
// -----------------------------------------------------------------------------

const SymbolRow = memo(function SymbolRow({ symbol, isActive, ticker, onSelect }: SymbolRowProps) {
  const handleClick = useCallback(() => {
    onSelect(symbol);
  }, [symbol, onSelect]);

  const price = ticker?.price ?? 0;
  const changePercent = ticker?.priceChangePercent ?? 0;

  const changeColorClass =
    changePercent > 0 ? 'text-buy' : changePercent < 0 ? 'text-sell' : 'text-foreground-secondary';
  const changeSign = changePercent > 0 ? '+' : '';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
        isActive ? 'bg-background-tertiary' : 'hover:bg-background-tertiary/50'
      }`}
    >
      <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-foreground'}`}>
        {formatSymbol(symbol)}
      </span>
      <div className="flex items-center gap-2">
        {price > 0 && (
          <span className="font-mono-num text-foreground text-xs">{formatPrice(price)}</span>
        )}
        {price > 0 && (
          <span className={`font-mono-num text-xs ${changeColorClass}`}>
            {changeSign}
            {changePercent.toFixed(2)}%
          </span>
        )}
      </div>
    </button>
  );
});

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const WatchlistWidget = memo(function WatchlistWidget() {
  const activeSymbol = useUiStore((state) => state.symbol);
  const setSymbol = useUiStore((state) => state.setSymbol);
  const symbols = useWatchlistStore((state) => state.symbols);
  const tickers = useWatchlistStore((state) => state.tickers);

  useWatchlistStream();

  const handleSelect = useCallback(
    (symbol: string) => {
      setSymbol(symbol);
    },
    [setSymbol],
  );

  return (
    <WidgetWrapper title="Watchlist">
      <div className="flex flex-col overflow-y-auto">
        {symbols.map((symbol) => (
          <SymbolRow
            key={symbol}
            symbol={symbol}
            isActive={symbol === activeSymbol}
            ticker={tickers.get(symbol)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </WidgetWrapper>
  );
});
