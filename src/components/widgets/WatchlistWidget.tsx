'use client';

// =============================================================================
// WatchlistWidget Component
// =============================================================================
// DOM-based widget displaying a list of watchlist symbols with real-time
// prices and 24-hour price change percentages. Data is sourced from the
// watchlistStore, populated via REST API and updated by WebSocket miniTicker.
//
// Each SymbolRow subscribes to its own ticker slice via a Zustand selector,
// so only the row whose data changed re-renders — not the entire widget.
//
// Clicking a symbol updates uiStore.symbol, triggering all other widgets
// to switch to the selected pair.
// =============================================================================

import { memo, useCallback, useMemo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useExchangeWatchlistStream } from '@/hooks/useExchangeWatchlistStream';
import { useSparklineData } from '@/hooks/useSparklineData';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { Sparkline } from '@/components/ui/Sparkline';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SymbolRowProps {
  symbol: string;
  isActive: boolean;
  onSelect: (symbol: string) => void;
}

// -----------------------------------------------------------------------------
// Sub-Component
// -----------------------------------------------------------------------------

interface SymbolRowInternalProps extends SymbolRowProps {
  exchange: 'binance' | 'upbit';
}

const SymbolRow = memo(function SymbolRow({
  symbol,
  isActive,
  onSelect,
  exchange,
}: SymbolRowInternalProps) {
  const ticker = useWatchlistStore((state) => state.tickers.get(symbol));
  const sparklineData = useSparklineData(symbol, exchange);

  const handleClick = useCallback(() => {
    onSelect(symbol);
  }, [symbol, onSelect]);

  const displaySymbol = exchange === 'upbit' ? formatUpbitSymbol(symbol) : formatSymbol(symbol);

  const { price, changePercent, changeColorClass, changeSign } = useMemo(() => {
    const p = ticker?.price ?? 0;
    const cp = ticker?.priceChangePercent ?? 0;
    return {
      price: p,
      changePercent: cp,
      changeColorClass: cp > 0 ? 'text-buy' : cp < 0 ? 'text-sell' : 'text-foreground-secondary',
      changeSign: cp > 0 ? '+' : '',
    };
  }, [ticker?.price, ticker?.priceChangePercent]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
        isActive ? 'bg-background-tertiary' : 'hover:bg-background-tertiary/50'
      }`}
    >
      <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-foreground'}`}>
        {displaySymbol}
      </span>
      <div className="flex items-center gap-2">
        {sparklineData.length >= 2 && <Sparkline data={sparklineData} width={48} height={16} />}
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
  const exchange = useUiStore((state) => state.exchange);
  const symbols = useWatchlistStore((state) => state.symbols);

  useExchangeWatchlistStream();

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
            onSelect={handleSelect}
            exchange={exchange}
          />
        ))}
      </div>
    </WidgetWrapper>
  );
});
