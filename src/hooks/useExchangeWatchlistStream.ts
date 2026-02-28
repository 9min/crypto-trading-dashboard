// =============================================================================
// useExchangeWatchlistStream Hook
// =============================================================================
// Exchange-aware watchlist stream hook that delegates to the appropriate
// exchange-specific watchlist hook based on the current exchange selection.
//
// IMPORTANT: Both hooks are ALWAYS called (Rules of Hooks). The inactive
// exchange receives empty symbol arrays to disable its connection.
// =============================================================================

import { useMemo } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useWatchlistStream } from '@/hooks/useWatchlistStream';
import { useUpbitWatchlistStream } from '@/hooks/useUpbitWatchlistStream';
import { useFuturesBinanceStream } from '@/hooks/useFuturesBinanceStream';
import { toUpbitSymbol } from '@/utils/symbolMap';

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useExchangeWatchlistStream(): void {
  const exchange = useUiStore((state) => state.exchange);
  const symbols = useWatchlistStore((state) => state.symbols);

  // Compute Upbit-mapped symbols for the watchlist.
  // Filter out symbols without a valid Upbit mapping (e.g., BNB is not listed on Upbit).
  const upbitSymbols = useMemo(() => {
    if (exchange !== 'upbit') return [];
    return symbols.map(toUpbitSymbol).filter((s) => s.startsWith('KRW-'));
  }, [exchange, symbols]);

  // ALWAYS call both hooks (Rules of Hooks compliance).

  // Binance watchlist: only active when exchange === 'binance'
  // useWatchlistStream reads symbols from the store internally,
  // so we only need to conditionally manage the upbit side
  useWatchlistStream(exchange === 'binance');

  // Upbit watchlist: active when exchange === 'upbit'
  useUpbitWatchlistStream({ symbols: upbitSymbols });

  // Futures Binance stream: maintains Binance USDT prices for futures PnL
  // when the active exchange is not Binance
  useFuturesBinanceStream({ enabled: exchange === 'upbit' });
}
