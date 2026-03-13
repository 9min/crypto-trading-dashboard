'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { toUpbitSymbol } from '@/utils/symbolMap';
import { formatSymbol, formatUpbitSymbol } from '@/utils/formatSymbol';
import { formatPrice } from '@/utils/formatPrice';

export function useBrowserTitleSync(): void {
  const symbol = useUiStore((state) => state.symbol);
  const exchange = useUiStore((state) => state.exchange);

  // Last candle close price is the most up-to-date live price for the active
  // symbol — updated on every kline WebSocket tick via updateLastCandle.
  const lastClose = useKlineStore((state) => {
    const len = state.candles.length;
    return len > 0 ? state.candles[len - 1].close : 0;
  });

  useEffect(() => {
    const displaySymbol =
      exchange === 'upbit' ? formatUpbitSymbol(toUpbitSymbol(symbol)) : formatSymbol(symbol);

    if (lastClose > 0) {
      const priceStr =
        exchange === 'upbit'
          ? Math.round(lastClose).toLocaleString('en-US')
          : formatPrice(lastClose);
      document.title = `${priceStr} ${displaySymbol}`;
    } else {
      document.title = `${displaySymbol} — Crypto Trading`;
    }
  }, [symbol, exchange, lastClose]);

  // Restore static title on unmount
  useEffect(() => {
    return () => {
      document.title = 'Crypto Trading Dashboard';
    };
  }, []);
}
