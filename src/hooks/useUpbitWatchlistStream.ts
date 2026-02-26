// =============================================================================
// useUpbitWatchlistStream Hook
// =============================================================================
// Orchestrates Upbit watchlist data flow:
//   1. Fetches initial ticker data via REST API
//   2. Connects to Upbit WebSocket for real-time ticker updates
//   3. Routes ticker events to the watchlist store
//
// When WebSocket is unavailable (e.g., on Vercel), automatically falls back
// to REST API polling for ticker updates.
// =============================================================================

import { useEffect } from 'react';
import { UpbitWebSocketManager } from '@/lib/upbit/UpbitWebSocketManager';
import { createUpbitMessageRouter } from '@/lib/upbit/messageRouter';
import { fetchUpbitTickers } from '@/lib/upbit/restClient';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { toBinanceSymbol } from '@/utils/symbolMap';
import { REST_POLL_TICKER_INTERVAL_MS } from '@/utils/constants';
import type { ConnectionState } from '@/types/chart';
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
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let pollingInFlight = false;

    const manager = UpbitWebSocketManager.getInstance();

    // -- REST API: Initial ticker fetch --
    setLoading(true);
    fetchUpbitTickers(symbols)
      .then((responses) => {
        if (!isActive) return;

        const tickers = responses.map((r) => ({
          symbol: toBinanceSymbol(r.market),
          price: r.trade_price,
          priceChangePercent: r.signed_change_rate * 100,
          volume: r.acc_trade_price_24h,
          lastUpdateTime: r.trade_timestamp,
        }));

        setTickers(tickers);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[useUpbitWatchlistStream] Failed to fetch tickers', {
          symbols,
          timestamp: Date.now(),
          errorMessage,
        });
        setLoading(false);
      });

    // -----------------------------------------------------------------------
    // REST Polling Fallback
    // -----------------------------------------------------------------------

    const startPolling = (): void => {
      if (pollIntervalId !== null) return; // Already polling

      pollIntervalId = setInterval(() => {
        if (!isActive || pollingInFlight) return;
        pollingInFlight = true;

        fetchUpbitTickers(symbols)
          .then((responses) => {
            if (!isActive) return;

            for (const r of responses) {
              updateTicker(toBinanceSymbol(r.market), {
                price: r.trade_price,
                priceChangePercent: r.signed_change_rate * 100,
                volume: r.acc_trade_price_24h,
                lastUpdateTime: r.trade_timestamp,
              });
            }
          })
          .catch((error: unknown) => {
            if (!isActive) return;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[useUpbitWatchlistStream] Polling tickers failed', {
              action: 'poll_tickers',
              symbols,
              timestamp: Date.now(),
              errorMessage,
            });
          })
          .finally(() => {
            pollingInFlight = false;
          });
      }, REST_POLL_TICKER_INTERVAL_MS);
    };

    const stopPolling = (): void => {
      if (pollIntervalId !== null) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      pollingInFlight = false;
    };

    // -----------------------------------------------------------------------
    // WebSocket: ticker stream for real-time updates
    // -----------------------------------------------------------------------

    const handleTicker = (event: UpbitTickerEvent): void => {
      if (!isActive) return;

      updateTicker(toBinanceSymbol(event.code), {
        price: event.trade_price,
        priceChangePercent: event.signed_change_rate * 100,
        volume: event.acc_trade_price_24h,
        lastUpdateTime: event.trade_timestamp,
      });
    };

    const router = createUpbitMessageRouter({
      onTicker: handleTicker,
    });

    // Track WS state to detect failures and start polling
    const unsubscribeState = manager.onStateChange((state: ConnectionState): void => {
      if (!isActive) return;

      if (state.status === 'failed') {
        startPolling();
      } else if (state.status === 'connected') {
        stopPolling();
      }
    });

    // Connect with ticker subscription for all watchlist symbols
    manager.connect([{ type: 'ticker', codes: symbols, isOnlyRealtime: true }]);

    const unsubscribe = manager.subscribe(router);

    return () => {
      isActive = false;
      stopPolling();
      unsubscribe();
      unsubscribeState();
      manager.disconnect();
    };
  }, [symbols, setTickers, updateTicker, setLoading]);
}
