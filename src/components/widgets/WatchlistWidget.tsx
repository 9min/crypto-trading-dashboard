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
import { toUpbitSymbol, BINANCE_TO_UPBIT_MAP } from '@/utils/symbolMap';
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

  const displaySymbol = useMemo(
    () => (exchange === 'upbit' ? formatUpbitSymbol(toUpbitSymbol(symbol)) : formatSymbol(symbol)),
    [exchange, symbol],
  );

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
      aria-current={isActive ? 'true' : undefined}
      className={`border-border/30 flex w-full cursor-pointer items-center border-b px-3 py-2.5 text-left transition-colors ${
        isActive
          ? 'border-accent bg-background-tertiary border-l-2'
          : 'hover:border-l-foreground-tertiary hover:bg-background-tertiary/50 border-l-2 border-l-transparent'
      }`}
    >
      <span
        className={`min-w-0 flex-1 truncate text-xs font-medium ${isActive ? 'text-accent' : 'text-foreground'}`}
      >
        {displaySymbol}
      </span>
      <span className="flex w-12 shrink-0 justify-center">
        {sparklineData.length >= 2 && <Sparkline data={sparklineData} width={48} height={16} />}
      </span>
      <span className="font-mono-num text-foreground w-20 shrink-0 text-right text-xs">
        {price > 0 ? formatPrice(price) : ''}
      </span>
      <span className={`font-mono-num w-16 shrink-0 text-right text-xs ${changeColorClass}`}>
        {price > 0 ? `${changeSign}${changePercent.toFixed(2)}%` : ''}
      </span>
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
  const allSymbols = useWatchlistStore((state) => state.symbols);

  // Filter out symbols not available on the current exchange (e.g., BNB on Upbit)
  const symbols = useMemo(
    () =>
      exchange === 'upbit' ? allSymbols.filter((s) => BINANCE_TO_UPBIT_MAP.has(s)) : allSymbols,
    [exchange, allSymbols],
  );

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
