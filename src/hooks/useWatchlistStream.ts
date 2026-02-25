// =============================================================================
// useWatchlistStream Hook
// =============================================================================
// Orchestrates watchlist data flow:
//   1. Fetches initial 24hr ticker data via REST API
//   2. Connects to miniTicker WebSocket stream for real-time updates
//   3. Routes miniTicker events to the watchlist store
//
// On mount: fetches REST data, connects WebSocket, subscribes to miniTicker.
// On unmount: unsubscribes from WebSocket, disconnects stream.
// When symbols change: re-fetches REST data, reconnects WebSocket.
// =============================================================================

import { useEffect } from 'react';
import { WatchlistStreamManager } from '@/lib/websocket/WatchlistStreamManager';
import { fetch24hrTickers } from '@/lib/binance/restApi';
import { useWatchlistStore } from '@/stores/watchlistStore';
import type { BinanceMiniTickerEvent } from '@/types/binance';

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useWatchlistStream(enabled = true): void {
  const symbols = useWatchlistStore((state) => state.symbols);
  const setTickers = useWatchlistStore((state) => state.setTickers);
  const updateTicker = useWatchlistStore((state) => state.updateTicker);
  const setLoading = useWatchlistStore((state) => state.setLoading);

  useEffect(() => {
    if (!enabled) return;

    let isActive = true;

    const manager = WatchlistStreamManager.getInstance();

    // -- REST API: Initial 24hr ticker fetch ----------------------------------
    setLoading(true);
    fetch24hrTickers([...symbols])
      .then((responses) => {
        if (!isActive) return;

        const tickers = responses.map((r) => ({
          symbol: r.symbol,
          price: parseFloat(r.lastPrice),
          priceChangePercent: parseFloat(r.priceChangePercent),
          volume: parseFloat(r.quoteVolume),
          lastUpdateTime: Date.now(),
        }));

        setTickers(tickers);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        console.error('[useWatchlistStream] Failed to fetch 24hr tickers', {
          symbols,
          timestamp: Date.now(),
          error,
        });
        setLoading(false);
      });

    // -- WebSocket: miniTicker stream -----------------------------------------
    manager.connect([...symbols]);

    const handleMiniTicker = (event: BinanceMiniTickerEvent): void => {
      if (!isActive) return;

      const close = parseFloat(event.c);
      const open = parseFloat(event.o);
      const priceChangePercent = open !== 0 ? ((close - open) / open) * 100 : 0;

      updateTicker(event.s, {
        price: close,
        priceChangePercent,
        volume: parseFloat(event.q),
        lastUpdateTime: event.E,
      });
    };

    const unsubscribe = manager.subscribe(handleMiniTicker);

    // -- Cleanup --------------------------------------------------------------
    return () => {
      isActive = false;
      unsubscribe();
      manager.disconnect();
    };
  }, [enabled, symbols, setTickers, updateTicker, setLoading]);
}
