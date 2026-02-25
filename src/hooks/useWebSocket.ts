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
//
// Depth synchronization follows Binance's official protocol:
//   1. Buffer WebSocket depth events while fetching the REST snapshot.
//   2. Once the snapshot arrives, drop buffered events where u <= snapshot.lastUpdateId.
//   3. The first applied event must satisfy U <= lastUpdateId+1 && u >= lastUpdateId+1.
//   4. Subsequent events are applied normally via depthStore.applyDepthUpdate.
// =============================================================================

import { useEffect, useCallback } from 'react';
import { WebSocketManager } from '@/lib/websocket/WebSocketManager';
import { createMessageRouter } from '@/lib/websocket/messageRouter';
import { buildCombinedStreamUrl } from '@/lib/binance/streamUrls';
import { fetchKlines, fetchDepthSnapshot } from '@/lib/binance/restApi';
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
  const setDepthSnapshot = useDepthStore((state) => state.setSnapshot);
  const resetDepthStore = useDepthStore((state) => state.reset);

  const addTrade = useTradeStore((state) => state.addTrade);
  const resetTradeStore = useTradeStore((state) => state.reset);

  // Resolve effective symbol and interval (params override store defaults)
  const symbol = params?.symbol ?? storeSymbol;
  const interval = params?.interval ?? storeInterval;

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
    // Local flag scoped to THIS effect execution. When cleanup runs,
    // `isActive` becomes false — preventing stale async REST responses
    // from overwriting the store after a symbol/interval change.
    let isActive = true;

    // -- Depth buffering state ------------------------------------------------
    // Buffer depth WS events until the REST snapshot arrives, then replay.
    let snapshotReady = false;
    let snapshotLastUpdateId = 0;
    const depthBuffer: BinanceDepthEvent[] = [];

    const manager = WebSocketManager.getInstance();
    const url = buildCombinedStreamUrl(symbol, interval);

    // Reset all data stores when symbol/interval changes
    resetKlineStore();
    resetDepthStore();
    resetTradeStore();

    // -- Depth handler with buffering -----------------------------------------
    const handleDepth = (event: BinanceDepthEvent): void => {
      if (!isActive) return;

      if (!snapshotReady) {
        // Snapshot hasn't arrived yet — buffer the event
        depthBuffer.push(event);
        return;
      }

      // Normal path: apply the update
      const bidUpdates: PriceLevel[] = event.b.map(parseDepthLevel);
      const askUpdates: PriceLevel[] = event.a.map(parseDepthLevel);
      applyDepthUpdate(bidUpdates, askUpdates, event.u);
    };

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
      if (isActive) {
        setConnectionState(state);
      }
    });

    // Connect WebSocket
    manager.connect(url);

    // Fetch initial kline data via REST API
    setKlineLoading(true);
    fetchKlines(symbol, interval)
      .then((candles) => {
        if (isActive) {
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
        if (isActive) {
          setKlineLoading(false);
        }
      });

    // Fetch initial depth snapshot via REST API, then replay buffered events
    fetchDepthSnapshot(symbol)
      .then((snapshot) => {
        if (!isActive) return;

        const bids: PriceLevel[] = snapshot.bids.map(parseDepthLevel);
        const asks: PriceLevel[] = snapshot.asks.map(parseDepthLevel);
        setDepthSnapshot(bids, asks, snapshot.lastUpdateId);

        snapshotLastUpdateId = snapshot.lastUpdateId;
        snapshotReady = true;

        // Replay buffered depth events per Binance protocol:
        // - Drop events where u <= snapshot.lastUpdateId (stale)
        // - First valid event must satisfy U <= lastUpdateId+1 && u >= lastUpdateId+1
        let firstValid = false;
        for (const buffered of depthBuffer) {
          // Drop events that are entirely before the snapshot
          if (buffered.u <= snapshotLastUpdateId) continue;

          if (!firstValid) {
            // First event must bridge the snapshot boundary
            if (buffered.U <= snapshotLastUpdateId + 1 && buffered.u >= snapshotLastUpdateId + 1) {
              firstValid = true;
            } else {
              // Gap detected — skip (store guard will also reject via lastUpdateId)
              continue;
            }
          }

          const bidUpdates: PriceLevel[] = buffered.b.map(parseDepthLevel);
          const askUpdates: PriceLevel[] = buffered.a.map(parseDepthLevel);
          applyDepthUpdate(bidUpdates, askUpdates, buffered.u);
        }

        // Clear the buffer — no longer needed
        depthBuffer.length = 0;
      })
      .catch((error: unknown) => {
        console.error('[useWebSocket] Failed to fetch depth snapshot', {
          symbol,
          timestamp: Date.now(),
          error,
        });
      });

    // -- Cleanup on unmount or dependency change ------------------------------
    return () => {
      isActive = false;
      depthBuffer.length = 0;
      unsubscribeMessages();
      unsubscribeState();
      manager.disconnect();
    };
  }, [
    symbol,
    interval,
    handleKline,
    handleTrade,
    setConnectionState,
    setCandles,
    setKlineLoading,
    setDepthSnapshot,
    applyDepthUpdate,
    resetKlineStore,
    resetDepthStore,
    resetTradeStore,
  ]);

  return { connectionState };
}
