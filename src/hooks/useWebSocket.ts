// =============================================================================
// useWebSocket Hook
// =============================================================================
// Custom React hook that orchestrates the WebSocket lifecycle for a given
// symbol and interval. Connects to the Binance Combined Stream, fetches
// initial kline data, and routes incoming messages to the appropriate
// Zustand stores.
//
// On mount: connects WebSocket, fetches initial klines, subscribes to messages.
// On unmount: unsubscribes from messages, unsubscribes from state changes.
// When symbol/interval changes: disconnects old stream, resets stores, reconnects.
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { createMessageRouter } from '@/lib/websocket/messageRouter';
import { buildCombinedStreamUrl } from '@/lib/binance/streamUrls';
import { fetchKlines } from '@/lib/binance/restApi';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useDepthStore } from '@/stores/depthStore';
import { useTradeStore } from '@/stores/tradeStore';
import type { ConnectionState, PriceLevel, KlineInterval } from '@/types/chart';
import type { BinanceKlineEvent, BinanceDepthEvent, BinanceTradeEvent } from '@/types/binance';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseWebSocketParams {
  /** Trading pair symbol (e.g., "BTCUSDT"). Falls back to uiStore value. */
  symbol?: string;
  /** Kline interval (e.g., "1m"). Falls back to klineStore value. */
  interval?: KlineInterval;
}

interface UseWebSocketReturn {
  /** Current WebSocket connection state */
  connectionState: ConnectionState;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parses a Binance depth level [price, quantity] string tuple into a PriceLevel.
 */
function parseDepthLevel(level: [string, string]): PriceLevel {
  return {
    price: parseFloat(level[0]),
    quantity: parseFloat(level[1]),
  };
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useWebSocket(params?: UseWebSocketParams): UseWebSocketReturn {
  // -- Granular Zustand selectors (MUST NOT subscribe to the whole store) -----
  const storeSymbol = useUiStore((state) => state.symbol);
  const setConnectionState = useUiStore((state) => state.setConnectionState);
  const connectionState = useUiStore((state) => state.connectionState);

  const storeInterval = useKlineStore((state) => state.interval);
  const setCandles = useKlineStore((state) => state.setCandles);
  const addCandle = useKlineStore((state) => state.addCandle);
  const updateLastCandle = useKlineStore((state) => state.updateLastCandle);
  const setKlineLoading = useKlineStore((state) => state.setLoading);
  const resetKlineStore = useKlineStore((state) => state.reset);

  const applyDepthUpdate = useDepthStore((state) => state.applyDepthUpdate);
  const resetDepthStore = useDepthStore((state) => state.reset);

  const addTrade = useTradeStore((state) => state.addTrade);
  const resetTradeStore = useTradeStore((state) => state.reset);

  // Resolve effective symbol and interval (params override store defaults)
  const symbol = params?.symbol ?? storeSymbol;
  const interval = params?.interval ?? storeInterval;

  // Ref to track whether the effect is still active (prevents stale closures)
  const isActiveRef = useRef(true);

  // -- Message Handlers (stable references via useCallback) -------------------

  const handleKline = useCallback(
    (event: BinanceKlineEvent): void => {
      const k = event.k;
      const candle = {
        time: k.t / 1000, // Convert ms to seconds for TradingView
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };

      if (k.x) {
        // Kline is closed — add as a new completed candle
        addCandle(candle);
      } else {
        // Kline is still open — update the last (in-progress) candle
        updateLastCandle(candle);
      }
    },
    [addCandle, updateLastCandle],
  );

  const handleDepth = useCallback(
    (event: BinanceDepthEvent): void => {
      const bidUpdates: PriceLevel[] = event.b.map(parseDepthLevel);
      const askUpdates: PriceLevel[] = event.a.map(parseDepthLevel);
      applyDepthUpdate(bidUpdates, askUpdates, event.u);
    },
    [applyDepthUpdate],
  );

  const handleTrade = useCallback(
    (event: BinanceTradeEvent): void => {
      addTrade({
        id: event.t,
        price: parseFloat(event.p),
        quantity: parseFloat(event.q),
        time: event.T,
        isBuyerMaker: event.m,
      });
    },
    [addTrade],
  );

  // -- Main Effect: WebSocket lifecycle tied to symbol/interval ---------------

  useEffect(() => {
    isActiveRef.current = true;

    const manager = WebSocketManager.getInstance();
    const url = buildCombinedStreamUrl(symbol, interval);

    // Reset all data stores when symbol/interval changes
    resetKlineStore();
    resetDepthStore();
    resetTradeStore();

    // Create the message router with typed handlers
    const router = createMessageRouter({
      onKline: handleKline,
      onDepth: handleDepth,
      onTrade: handleTrade,
    });

    // Subscribe to incoming WebSocket messages
    const unsubscribeMessages = manager.subscribe(router);

    // Subscribe to connection state changes and sync to uiStore
    const unsubscribeState = manager.onStateChange((state: ConnectionState): void => {
      if (isActiveRef.current) {
        setConnectionState(state);
      }
    });

    // Connect WebSocket
    manager.connect(url);

    // Fetch initial kline data via REST API
    setKlineLoading(true);
    fetchKlines(symbol, interval)
      .then((candles) => {
        if (isActiveRef.current) {
          setCandles(candles);
        }
      })
      .catch((error: unknown) => {
        console.error('[useWebSocket] Failed to fetch initial kline data', {
          symbol,
          interval,
          timestamp: Date.now(),
          error,
        });
      })
      .finally(() => {
        if (isActiveRef.current) {
          setKlineLoading(false);
        }
      });

    // -- Cleanup on unmount or dependency change ------------------------------
    return () => {
      isActiveRef.current = false;
      unsubscribeMessages();
      unsubscribeState();
      manager.disconnect();
    };
  }, [
    symbol,
    interval,
    handleKline,
    handleDepth,
    handleTrade,
    setConnectionState,
    setCandles,
    setKlineLoading,
    resetKlineStore,
    resetDepthStore,
    resetTradeStore,
  ]);

  return { connectionState };
}
