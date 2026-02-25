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
//   4. Subsequent events validate U/u continuity (gap → re-sync).
//   5. Buffer is capped at MAX_DEPTH_BUFFER to prevent OOM on snapshot failure.
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
import { useToastStore } from '@/stores/toastStore';
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
// Constants
// -----------------------------------------------------------------------------

/** Max buffered depth events before snapshot arrives. Prevents OOM. */
const MAX_DEPTH_BUFFER = 5000;

/** Max snapshot retry attempts with exponential backoff. */
const MAX_SNAPSHOT_RETRIES = 3;

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
  const resetKlineData = useKlineStore((state) => state.resetData);

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

    // -- Depth buffering & sequencing state ----------------------------------
    let snapshotReady = false;
    let expectedNextUpdateId = 0;
    const depthBuffer: BinanceDepthEvent[] = [];
    let snapshotRetryTimeout: ReturnType<typeof setTimeout> | null = null;

    const manager = WebSocketManager.getInstance();
    const url = buildCombinedStreamUrl(symbol, interval);

    // Reset data stores when symbol/interval changes (preserve interval selection)
    resetKlineData();
    resetDepthStore();
    resetTradeStore();

    // -- Depth snapshot fetch with retry + replay ----------------------------
    const fetchAndApplySnapshot = (retryCount: number): void => {
      fetchDepthSnapshot(symbol)
        .then((snapshot) => {
          if (!isActive) return;

          const bids: PriceLevel[] = snapshot.bids.map(parseDepthLevel);
          const asks: PriceLevel[] = snapshot.asks.map(parseDepthLevel);
          setDepthSnapshot(bids, asks, snapshot.lastUpdateId);

          const snapshotLastUpdateId = snapshot.lastUpdateId;
          expectedNextUpdateId = snapshotLastUpdateId + 1;
          snapshotReady = true;

          // Replay buffered depth events per Binance protocol:
          // - Drop events where u <= snapshot.lastUpdateId (stale)
          // - First valid event must satisfy U <= lastUpdateId+1 && u >= lastUpdateId+1
          // - Subsequent events validate U/u continuity
          let firstValid = false;
          for (const buffered of depthBuffer) {
            // Drop events that are entirely before the snapshot
            if (buffered.u <= snapshotLastUpdateId) continue;

            if (!firstValid) {
              // First event must bridge the snapshot boundary
              if (
                buffered.U <= snapshotLastUpdateId + 1 &&
                buffered.u >= snapshotLastUpdateId + 1
              ) {
                firstValid = true;
              } else {
                // Gap detected — skip
                continue;
              }
            }

            // Validate sequence continuity for buffered events
            if (buffered.U > expectedNextUpdateId) {
              // Gap in buffer — expected during React Strict Mode double-mount
              // or when snapshot fetch is slow. Live events will re-sync.
              console.warn('[useWebSocket] Depth sequence gap in buffer replay, will re-sync', {
                symbol,
                expected: expectedNextUpdateId,
                eventU: buffered.U,
              });
              break;
            }

            const bidUpdates: PriceLevel[] = buffered.b.map(parseDepthLevel);
            const askUpdates: PriceLevel[] = buffered.a.map(parseDepthLevel);
            applyDepthUpdate(bidUpdates, askUpdates, buffered.u);
            expectedNextUpdateId = buffered.u + 1;
          }

          // Clear the buffer — no longer needed
          depthBuffer.length = 0;
        })
        .catch((error: unknown) => {
          if (!isActive) return;

          console.error('[useWebSocket] Failed to fetch depth snapshot', {
            symbol,
            timestamp: Date.now(),
            attempt: retryCount + 1,
            error,
          });

          // Clear the buffer to prevent unbounded growth
          depthBuffer.length = 0;

          // Retry with exponential backoff
          if (retryCount < MAX_SNAPSHOT_RETRIES) {
            const delay = 1000 * Math.pow(2, retryCount);
            snapshotRetryTimeout = setTimeout(() => {
              if (isActive) {
                fetchAndApplySnapshot(retryCount + 1);
              }
            }, delay);
          } else {
            // All fast retries exhausted — schedule a slow recovery retry (30s)
            // so the order book can self-heal without requiring user intervention
            console.error('[useWebSocket] Depth snapshot retries exhausted, scheduling recovery', {
              symbol,
              timestamp: Date.now(),
            });
            useToastStore
              .getState()
              .addToast(`Order book sync failed for ${symbol}. Retrying in 30s...`, 'warning');
            snapshotRetryTimeout = setTimeout(() => {
              if (isActive) {
                fetchAndApplySnapshot(0);
              }
            }, 30_000);
          }
        });
    };

    // -- Depth handler with buffering + sequencing ----------------------------
    const handleDepth = (event: BinanceDepthEvent): void => {
      if (!isActive) return;

      if (!snapshotReady) {
        // Snapshot hasn't arrived yet — buffer with cap to prevent OOM
        if (depthBuffer.length < MAX_DEPTH_BUFFER) {
          depthBuffer.push(event);
        }
        return;
      }

      // Validate U/u sequence continuity
      if (event.u < expectedNextUpdateId) {
        // Stale/duplicate event — ignore
        return;
      }

      if (event.U > expectedNextUpdateId) {
        // Gap detected — re-sync by fetching a new snapshot.
        // Expected during React Strict Mode double-mount or after tab switch.
        console.warn('[useWebSocket] Depth sequence gap detected, re-syncing', {
          symbol,
          expected: expectedNextUpdateId,
          eventU: event.U,
        });
        snapshotReady = false;
        depthBuffer.length = 0;
        // Cancel any pending retry timer to prevent concurrent fetch races
        if (snapshotRetryTimeout !== null) {
          clearTimeout(snapshotRetryTimeout);
          snapshotRetryTimeout = null;
        }
        fetchAndApplySnapshot(0);
        return;
      }

      // Normal path: apply the update
      const bidUpdates: PriceLevel[] = event.b.map(parseDepthLevel);
      const askUpdates: PriceLevel[] = event.a.map(parseDepthLevel);
      applyDepthUpdate(bidUpdates, askUpdates, event.u);
      expectedNextUpdateId = event.u + 1;
    };

    // Create the message router with typed handlers
    const router = createMessageRouter({
      onKline: handleKline,
      onDepth: handleDepth,
      onTrade: handleTrade,
    });

    // Subscribe to incoming WebSocket messages
    const unsubscribeMessages = manager.subscribe(router);

    // Track whether the initial connection has been established, so we can
    // distinguish the very first `connected` event (handled by the explicit
    // fetchAndApplySnapshot call below) from subsequent reconnections.
    let hasEverConnected = false;
    let prevStatus: ConnectionState['status'] = 'idle';

    // Subscribe to connection state changes and sync to uiStore
    const unsubscribeState = manager.onStateChange((state: ConnectionState): void => {
      if (!isActive) return;

      setConnectionState(state);

      // Toast on connection failure
      if (state.status === 'failed') {
        useToastStore
          .getState()
          .addToast('WebSocket connection lost. Click Reconnect to retry.', 'error');
      }

      // Re-fetch depth snapshot whenever the connection is (re-)established
      // after the initial connect. Covers all reconnection paths including:
      //   reconnecting → connected
      //   failed → connecting → connected
      //   reconnecting → connecting → connected (tab visibility restore)
      if (state.status === 'connected' && hasEverConnected && prevStatus !== 'connected') {
        snapshotReady = false;
        depthBuffer.length = 0;
        if (snapshotRetryTimeout !== null) {
          clearTimeout(snapshotRetryTimeout);
          snapshotRetryTimeout = null;
        }
        fetchAndApplySnapshot(0);
      }

      if (state.status === 'connected') {
        hasEverConnected = true;
      }

      prevStatus = state.status;
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
        if (!isActive) return;
        console.error('[useWebSocket] Failed to fetch initial kline data', {
          symbol,
          interval,
          timestamp: Date.now(),
          error,
        });
        useToastStore.getState().addToast(`Failed to load chart data for ${symbol}`, 'error');
      })
      .finally(() => {
        if (isActive) {
          setKlineLoading(false);
        }
      });

    // Fetch initial depth snapshot via REST API
    fetchAndApplySnapshot(0);

    // -- Cleanup on unmount or dependency change ------------------------------
    return () => {
      isActive = false;
      depthBuffer.length = 0;
      if (snapshotRetryTimeout !== null) {
        clearTimeout(snapshotRetryTimeout);
      }
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
    resetKlineData,
    resetDepthStore,
    resetTradeStore,
  ]);

  return { connectionState };
}
