// =============================================================================
// useFuturesBinanceStream Hook
// =============================================================================
// Maintains a lightweight Binance WebSocket connection for futures-relevant
// symbols when the active exchange is NOT Binance. This ensures that
// `binancePrices` in watchlistStore always contains Binance USDT prices,
// regardless of the selected exchange, so that Futures PnL calculations
// are never contaminated by KRW or other fiat-denominated prices.
//
// When enabled=false (exchange is Binance), this hook is a no-op because
// useWatchlistStream already populates binancePrices.
//
// Page Visibility: pauses WebSocket + updates when tab is hidden, resumes
// with a fresh REST fetch + new WS connection on reactivation.
// =============================================================================

import { useEffect, useMemo } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUiStore } from '@/stores/uiStore';
import { fetch24hrTickers } from '@/lib/binance/restApi';
import { buildStreamUrl, getMiniTickerStream } from '@/lib/binance/streamUrls';
import { parseCombinedStreamMessage } from '@/lib/websocket/messageRouter';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseFuturesBinanceStreamOptions {
  /** When true, opens a Binance WebSocket for futures symbols */
  enabled: boolean;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFuturesBinanceStream({ enabled }: UseFuturesBinanceStreamOptions): void {
  const positions = usePortfolioStore((state) => state.positions);
  const symbol = useUiStore((state) => state.symbol);
  const watchlistSymbols = useWatchlistStore((state) => state.symbols);
  const setBinanceTickers = useWatchlistStore((state) => state.setBinanceTickers);
  const updateBinanceTicker = useWatchlistStore((state) => state.updateBinanceTicker);

  // Stable symbol key: only changes when the actual set of symbols changes
  const symbolsKey = useMemo(() => {
    if (!enabled) return '';
    const symbolSet = new Set<string>();
    symbolSet.add(symbol);
    for (const pos of positions.values()) {
      symbolSet.add(pos.symbol);
    }
    for (const s of watchlistSymbols) {
      symbolSet.add(s);
    }
    return [...symbolSet].sort().join(',');
  }, [enabled, positions, symbol, watchlistSymbols]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (!symbolsKey) return;

    const symbols = symbolsKey.split(',');
    let isActive = true;
    let ws: WebSocket | null = null;

    // -------------------------------------------------------------------------
    // Connect: REST fetch + WebSocket
    // -------------------------------------------------------------------------
    function connect(): void {
      // REST: Initial price fetch
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
          setBinanceTickers(tickers);
        })
        .catch((error: unknown) => {
          if (!isActive) return;
          console.error('[useFuturesBinanceStream] Failed to fetch Binance tickers', {
            symbols,
            timestamp: Date.now(),
            error,
          });
        });

      // WebSocket: miniTicker stream for real-time updates
      const streams = symbols.map(getMiniTickerStream);
      const url = buildStreamUrl(streams);

      try {
        ws = new WebSocket(url);

        ws.addEventListener('message', (event: MessageEvent) => {
          if (!isActive) return;
          const rawData = event.data;
          if (typeof rawData !== 'string') return;

          const message = parseCombinedStreamMessage(rawData);
          if (!message || message.e !== '24hrMiniTicker') return;

          const close = parseFloat(message.c);
          const open = parseFloat(message.o);
          const priceChangePercent = open !== 0 ? ((close - open) / open) * 100 : 0;

          updateBinanceTicker(message.s, {
            price: close,
            priceChangePercent,
            volume: parseFloat(message.q),
            lastUpdateTime: message.E,
          });
        });

        ws.addEventListener('error', (event: Event) => {
          console.error('[useFuturesBinanceStream] WebSocket error', {
            timestamp: Date.now(),
            event,
          });
        });
      } catch (error) {
        console.error('[useFuturesBinanceStream] Failed to create WebSocket', {
          url,
          timestamp: Date.now(),
          error,
        });
      }
    }

    function closeWs(): void {
      if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        ws = null;
      }
    }

    // -------------------------------------------------------------------------
    // Page Visibility: pause on hidden, resume on visible
    // -------------------------------------------------------------------------
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'hidden') {
        isActive = false;
        closeWs();
      } else {
        isActive = true;
        connect();
      }
    }

    // Initial connect
    connect();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      closeWs();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, symbolsKey, setBinanceTickers, updateBinanceTicker]);
}
