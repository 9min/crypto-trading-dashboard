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
import { useSparklineData } from '@/hooks/useSparklineData';
import { formatPrice } from '@/utils/formatPrice';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { toUpbitSymbol, BINANCE_TO_UPBIT_MAP } from '@/utils/symbolMap';
import { Sparkline } from '@/components/ui/Sparkline';
import { WatchlistManagePopover } from '@/components/ui/WatchlistManagePopover';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SymbolRowProps {
  symbol: string;
  isActive: boolean;
  onSelect: (symbol: string) => void;
  canRemove: boolean;
  onRemove: (symbol: string) => void;
}

// -----------------------------------------------------------------------------
// Sub-Component
// -----------------------------------------------------------------------------

interface SymbolRowInternalProps extends SymbolRowProps {
  exchange: 'binance' | 'upbit';
}

// -----------------------------------------------------------------------------
// Remove Button Sub-Component
// -----------------------------------------------------------------------------

interface RemoveButtonProps {
  symbol: string;
  onRemove: (symbol: string) => void;
}

const RemoveButton = memo(function RemoveButton({ symbol, onRemove }: RemoveButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(symbol);
    },
    [symbol, onRemove],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-foreground-tertiary hover:text-sell ml-1 shrink-0 cursor-pointer rounded p-1 opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
      aria-label={`Remove ${symbol}`}
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
});

const SymbolRow = memo(function SymbolRow({
  symbol,
  isActive,
  onSelect,
  canRemove,
  onRemove,
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
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      aria-current={isActive ? 'true' : undefined}
      className={`group border-border/30 flex w-full cursor-pointer items-center border-b px-3 py-2.5 text-left transition-colors ${
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
      {canRemove && <RemoveButton symbol={symbol} onRemove={onRemove} />}
    </div>
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
  const removeSymbol = useWatchlistStore((state) => state.removeSymbol);

  // Filter out symbols not available on the current exchange (e.g., BNB on Upbit)
  const symbols = useMemo(
    () =>
      exchange === 'upbit' ? allSymbols.filter((s) => BINANCE_TO_UPBIT_MAP.has(s)) : allSymbols,
    [exchange, allSymbols],
  );

  const handleSelect = useCallback(
    (symbol: string) => {
      setSymbol(symbol);
    },
    [setSymbol],
  );

  const handleRemove = useCallback(
    (symbol: string) => {
      // If removing the active symbol, switch to the first remaining symbol
      if (symbol === activeSymbol) {
        const remaining = symbols.filter((s) => s !== symbol);
        if (remaining.length > 0) {
          setSymbol(remaining[0]);
        }
      }
      removeSymbol(symbol);
    },
    [activeSymbol, symbols, setSymbol, removeSymbol],
  );

  // Can only remove if more than 1 symbol remains
  const canRemove = symbols.length > 1;

  const headerActions = useMemo(() => <WatchlistManagePopover />, []);

  return (
    <WidgetWrapper title="Watchlist" headerActions={headerActions}>
      <div className="flex h-full flex-col overflow-y-auto">
        {symbols.map((symbol) => (
          <SymbolRow
            key={symbol}
            symbol={symbol}
            isActive={symbol === activeSymbol}
            onSelect={handleSelect}
            canRemove={canRemove}
            onRemove={handleRemove}
            exchange={exchange}
          />
        ))}
      </div>
    </WidgetWrapper>
  );
});
