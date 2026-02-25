'use client';

// =============================================================================
// WatchlistWidget Component
// =============================================================================
// DOM-based widget (not Canvas) displaying a list of popular trading symbols.
// Clicking a symbol updates uiStore.symbol, which triggers all other widgets
// to switch to the selected pair.
//
// Shows the current price and price direction for the active symbol.
// =============================================================================

import { memo, useCallback, useMemo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useTradeStore } from '@/stores/tradeStore';
import { formatPrice } from '@/utils/formatPrice';
import { WidgetWrapper } from './WidgetWrapper';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SymbolRowProps {
  symbol: string;
  isActive: boolean;
  lastPrice: number;
  priceDirection: 'up' | 'down' | 'neutral';
  onSelect: (symbol: string) => void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const WATCHLIST_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
] as const;

// -----------------------------------------------------------------------------
// Sub-Component
// -----------------------------------------------------------------------------

const SymbolRow = memo(function SymbolRow({
  symbol,
  isActive,
  lastPrice,
  priceDirection,
  onSelect,
}: SymbolRowProps) {
  const handleClick = useCallback(() => {
    onSelect(symbol);
  }, [symbol, onSelect]);

  const priceColorClass =
    priceDirection === 'up'
      ? 'text-buy'
      : priceDirection === 'down'
        ? 'text-sell'
        : 'text-foreground';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
        isActive ? 'bg-background-tertiary' : 'hover:bg-background-tertiary/50'
      }`}
    >
      <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-foreground'}`}>
        {symbol.replace('USDT', '/USDT')}
      </span>
      {isActive && lastPrice > 0 && (
        <span className={`font-mono-num text-xs ${priceColorClass}`}>{formatPrice(lastPrice)}</span>
      )}
    </button>
  );
});

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const WatchlistWidget = memo(function WatchlistWidget() {
  const activeSymbol = useUiStore((state) => state.symbol);
  const setSymbol = useUiStore((state) => state.setSymbol);
  const lastPrice = useTradeStore((state) => state.lastPrice);
  const lastPriceDirection = useTradeStore((state) => state.lastPriceDirection);

  const handleSelect = useCallback(
    (symbol: string) => {
      setSymbol(symbol);
    },
    [setSymbol],
  );

  const symbols = useMemo(() => [...WATCHLIST_SYMBOLS], []);

  return (
    <WidgetWrapper title="Watchlist">
      <div className="flex flex-col overflow-y-auto">
        {symbols.map((symbol) => (
          <SymbolRow
            key={symbol}
            symbol={symbol}
            isActive={symbol === activeSymbol}
            lastPrice={symbol === activeSymbol ? lastPrice : 0}
            priceDirection={symbol === activeSymbol ? lastPriceDirection : 'neutral'}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </WidgetWrapper>
  );
});
