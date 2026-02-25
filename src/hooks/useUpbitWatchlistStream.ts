// =============================================================================
// useUpbitWatchlistStream Hook
// =============================================================================
// Orchestrates Upbit watchlist data flow:
//   1. Fetches initial ticker data via REST API
//   2. Connects to Upbit WebSocket for real-time ticker updates
//   3. Routes ticker events to the watchlist store
// =============================================================================

import { useEffect } from 'react';
import { UpbitWebSocketManager } from '@/lib/upbit/UpbitWebSocketManager';
import { createUpbitMessageRouter } from '@/lib/upbit/messageRouter';
import { fetchUpbitTickers } from '@/lib/upbit/restClient';
import { useWatchlistStore } from '@/stores/watchlistStore';
import type { UpbitTickerEvent } from '@/types/upbit';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseUpbitWatchlistStreamParams {
  /** Upbit market codes (e.g., ["KRW-BTC", "KRW-ETH"]). Empty array disables. */
  symbols: string[];
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useUpbitWatchlistStream(params: UseUpbitWatchlistStreamParams): void {
  const { symbols } = params;

  const setTickers = useWatchlistStore((state) => state.setTickers);
  const updateTicker = useWatchlistStore((state) => state.updateTicker);
  const setLoading = useWatchlistStore((state) => state.setLoading);

  useEffect(() => {
    if (symbols.length === 0) return;

    let isActive = true;

    // We use a separate UpbitWebSocketManager instance for watchlist
    // to avoid interfering with the main stream. However, since
    // UpbitWebSocketManager is a singleton, we create a dedicated
    // manager for watchlist by using a different approach — we subscribe
    // to ticker events on the same WS connection when available, or
    // use REST polling as the primary source.

    // -- REST API: Initial ticker fetch --
    setLoading(true);
    fetchUpbitTickers(symbols)
      .then((responses) => {
        if (!isActive) return;

        const tickers = responses.map((r) => ({
          symbol: r.market,
          price: r.trade_price,
          priceChangePercent: r.signed_change_rate * 100,
          volume: r.acc_trade_price_24h,
          lastUpdateTime: r.trade_timestamp,
        }));

        setTickers(tickers);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        console.error('[useUpbitWatchlistStream] Failed to fetch tickers', {
          symbols,
          timestamp: Date.now(),
          error,
        });
        setLoading(false);
      });

    // -- WebSocket: ticker stream for real-time updates --
    // Use the singleton manager, subscribe to ticker only for watchlist symbols
    const manager = UpbitWebSocketManager.getInstance();

    const handleTicker = (event: UpbitTickerEvent): void => {
      if (!isActive) return;

      updateTicker(event.code, {
        price: event.trade_price,
        priceChangePercent: event.signed_change_rate * 100,
        volume: event.acc_trade_price_24h,
        lastUpdateTime: event.trade_timestamp,
      });
    };

    const router = createUpbitMessageRouter({
      onTicker: handleTicker,
    });

    // Connect with ticker subscription for all watchlist symbols
    manager.connect([{ type: 'ticker', codes: symbols, isOnlyRealtime: true }]);

    const unsubscribe = manager.subscribe(router);

    return () => {
      isActive = false;
      unsubscribe();
      manager.disconnect();
    };
  }, [symbols, setTickers, updateTicker, setLoading]);
}
