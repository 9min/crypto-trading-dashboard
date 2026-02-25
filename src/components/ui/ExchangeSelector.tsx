'use client';

// =============================================================================
// ExchangeSelector Component
// =============================================================================
// Toggle between Binance and Upbit exchanges. Updates uiStore.exchange
// and maps the active symbol to the selected exchange's format.
// =============================================================================

import { memo, useCallback } from 'react';
import { useUiStore } from '@/stores/uiStore';
import type { ExchangeId } from '@/types/exchange';
import { EXCHANGES } from '@/types/exchange';
import { toUpbitSymbol, toBinanceSymbol } from '@/utils/symbolMap';
import { saveExchange } from '@/utils/localPreferences';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ExchangeSelector = memo(function ExchangeSelector() {
  const exchange = useUiStore((state) => state.exchange);
  const setExchange = useUiStore((state) => state.setExchange);
  const setSymbol = useUiStore((state) => state.setSymbol);
  const symbol = useUiStore((state) => state.symbol);

  const handleSelect = useCallback(
    (newExchange: ExchangeId) => {
      if (newExchange === exchange) return;

      // Map symbol to the new exchange's format
      const mappedSymbol =
        newExchange === 'upbit' ? toUpbitSymbol(symbol) : toBinanceSymbol(symbol);

      setExchange(newExchange);
      setSymbol(mappedSymbol);
      saveExchange(newExchange);
    },
    [exchange, symbol, setExchange, setSymbol],
  );

  return (
    <div className="border-border flex items-center rounded-md border">
      {(['binance', 'upbit'] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => handleSelect(id)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            exchange === id
              ? 'bg-accent text-background'
              : 'text-foreground-secondary hover:text-foreground'
          } ${id === 'binance' ? 'rounded-l-[5px]' : 'rounded-r-[5px]'}`}
        >
          {EXCHANGES[id].name}
        </button>
      ))}
    </div>
  );
});
