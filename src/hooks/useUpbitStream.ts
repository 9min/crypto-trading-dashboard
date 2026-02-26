// =============================================================================
// useUpbitStream Hook
// =============================================================================
// Orchestrates the Upbit WebSocket lifecycle for a given symbol and interval.
// Connects to Upbit WS, fetches initial candle data via REST, and routes
// incoming messages to the existing Zustand stores (klineStore, depthStore,
// tradeStore). Translates Upbit-specific event formats into domain types.
//
// When WebSocket is unavailable (e.g., on Vercel), automatically falls back
// to REST API polling for candles, orderbook, and recent trades.
//
// NOTE: Upbit does not provide a kline WebSocket stream. Live candles are
// constructed from individual trade events using interval-aligned timestamps.
// =============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { UpbitWebSocketManager } from '@/lib/upbit/UpbitWebSocketManager';
import { createUpbitMessageRouter } from '@/lib/upbit/messageRouter';
import { fetchUpbitCandles, fetchUpbitOrderBook, fetchUpbitTrades } from '@/lib/upbit/restClient';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useDepthStore } from '@/stores/depthStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useToastStore } from '@/stores/toastStore';
import { alignToIntervalSec } from '@/utils/intervalAlign';
import { REST_POLL_INTERVAL_MS } from '@/utils/constants';
import type { ConnectionState, PriceLevel, KlineInterval } from '@/types/chart';
import type { UpbitTradeEvent, UpbitOrderBookEvent } from '@/types/upbit';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseUpbitStreamParams {
  /** Upbit market code (e.g., "KRW-BTC"). Null disables the hook. */
  symbol: string | null;
  /** Kline interval (e.g., "1m"). Falls back to klineStore value. */
  interval?: KlineInterval;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useUpbitStream(params: UseUpbitStreamParams): void {
  const { symbol, interval: paramInterval } = params;

  const setConnectionState = useUiStore((state) => state.setConnectionState);
  const storeInterval = useKlineStore((state) => state.interval);
  const setCandles = useKlineStore((state) => state.setCandles);
  const addCandle = useKlineStore((state) => state.addCandle);
  const updateLastCandle = useKlineStore((state) => state.updateLastCandle);
  const setKlineLoading = useKlineStore((state) => state.setLoading);
  const resetKlineData = useKlineStore((state) => state.resetData);

  const setDepthSnapshot = useDepthStore((state) => state.setSnapshot);
  const resetDepthStore = useDepthStore((state) => state.reset);

  const addTrade = useTradeStore((state) => state.addTrade);
  const resetTradeStore = useTradeStore((state) => state.reset);

  const interval = paramInterval ?? storeInterval;

  // Track the latest trade sequential_id to deduplicate REST-polled trades
  const lastTradeSeqIdRef = useRef<number>(0);

  // -- Trade handler: updates trade feed + builds live candles --
  const handleTrade = useCallback(
    (event: UpbitTradeEvent): void => {
      // 1. Update trades feed (existing behavior)
      addTrade({
        id: event.sequential_id,
        price: event.trade_price,
        quantity: event.trade_volume,
        time: event.trade_timestamp,
        isBuyerMaker: event.ask_bid === 'ASK',
      });

      // Track latest trade ID for deduplication in polling mode
      if (event.sequential_id > lastTradeSeqIdRef.current) {
        lastTradeSeqIdRef.current = event.sequential_id;
      }

      // 2. Build live candle from trade event
      const candleOpenTimeSec = alignToIntervalSec(event.trade_timestamp, interval);
      const { candles } = useKlineStore.getState();
      const lastCandle = candles.length > 0 ? candles[candles.length - 1] : undefined;

      if (!lastCandle || candleOpenTimeSec > lastCandle.time) {
        // New candle period started — create a fresh candle
        addCandle({
          time: candleOpenTimeSec,
          open: event.trade_price,
          high: event.trade_price,
          low: event.trade_price,
          close: event.trade_price,
          volume: event.trade_volume,
        });
      } else if (candleOpenTimeSec === lastCandle.time) {
        // Same candle period — merge OHLCV
        updateLastCandle({
          time: lastCandle.time,
          open: lastCandle.open,
          high: Math.max(lastCandle.high, event.trade_price),
          low: Math.min(lastCandle.low, event.trade_price),
          close: event.trade_price,
          volume: lastCandle.volume + event.trade_volume,
        });
      }
      // candleOpenTimeSec < lastCandle.time → stale/out-of-order trade, ignore
    },
    [addTrade, addCandle, updateLastCandle, interval],
  );

  // -- OrderBook handler: full snapshot each time (Upbit sends complete book) --
  const handleOrderBook = useCallback(
    (event: UpbitOrderBookEvent): void => {
      const units = event.orderbook_units;
      const bids: PriceLevel[] = [];
      const asks: PriceLevel[] = [];
      for (const unit of units) {
        bids.push({ price: unit.bid_price, quantity: unit.bid_size });
        asks.push({ price: unit.ask_price, quantity: unit.ask_size });
      }

      setDepthSnapshot(bids, asks, event.timestamp);
    },
    [setDepthSnapshot],
  );

  // -- Main Effect --
  useEffect(() => {
    // Null symbol means this hook is disabled (other exchange is active)
    if (!symbol) return;

    let isActive = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    const manager = UpbitWebSocketManager.getInstance();

    // Reset stores
    resetKlineData();
    resetDepthStore();
    resetTradeStore();
    lastTradeSeqIdRef.current = 0;

    // Create message router (no ticker handler — candles built from trades)
    const router = createUpbitMessageRouter({
      onTrade: handleTrade,
      onOrderBook: handleOrderBook,
    });

    const unsubscribeMessages = manager.subscribe(router);

    // -----------------------------------------------------------------------
    // REST Polling Fallback
    // -----------------------------------------------------------------------

    const startPolling = (): void => {
      if (pollIntervalId !== null) return; // Already polling

      setConnectionState({ status: 'polling', startedAt: Date.now() });

      pollIntervalId = setInterval(() => {
        if (!isActive) return;

        // Poll latest candle (count=1) to update the chart
        fetchUpbitCandles(symbol, interval, 1)
          .then((candles) => {
            if (!isActive || candles.length === 0) return;
            const latestCandle = candles[candles.length - 1];
            const { candles: currentCandles } = useKlineStore.getState();
            const lastCandle =
              currentCandles.length > 0 ? currentCandles[currentCandles.length - 1] : undefined;

            if (!lastCandle || latestCandle.time > lastCandle.time) {
              addCandle(latestCandle);
            } else if (latestCandle.time === lastCandle.time) {
              updateLastCandle(latestCandle);
            }
          })
          .catch(() => {
            // Silently ignore polling errors to avoid toast spam
          });

        // Poll orderbook
        fetchUpbitOrderBook(symbol)
          .then((snapshot) => {
            if (!isActive) return;
            const units = snapshot.orderbook_units;
            const bids: PriceLevel[] = [];
            const asks: PriceLevel[] = [];
            for (const unit of units) {
              bids.push({ price: unit.bid_price, quantity: unit.bid_size });
              asks.push({ price: unit.ask_price, quantity: unit.ask_size });
            }
            setDepthSnapshot(bids, asks, snapshot.timestamp);
          })
          .catch(() => {
            // Silently ignore polling errors
          });

        // Poll recent trades (newest first from API)
        fetchUpbitTrades(symbol, 20)
          .then((trades) => {
            if (!isActive) return;
            // Filter out already-seen trades and process newest-first → oldest-first
            const newTrades = trades
              .filter((t) => t.sequential_id > lastTradeSeqIdRef.current)
              .reverse();

            for (const trade of newTrades) {
              addTrade({
                id: trade.sequential_id,
                price: trade.trade_price,
                quantity: trade.trade_volume,
                time: trade.timestamp,
                isBuyerMaker: trade.ask_bid === 'ASK',
              });
              if (trade.sequential_id > lastTradeSeqIdRef.current) {
                lastTradeSeqIdRef.current = trade.sequential_id;
              }
            }
          })
          .catch(() => {
            // Silently ignore polling errors
          });
      }, REST_POLL_INTERVAL_MS);
    };

    const stopPolling = (): void => {
      if (pollIntervalId !== null) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    };

    // -----------------------------------------------------------------------
    // Connection State Tracking
    // -----------------------------------------------------------------------

    const unsubscribeState = manager.onStateChange((state: ConnectionState): void => {
      if (!isActive) return;

      if (state.status === 'failed') {
        // WebSocket permanently failed — switch to REST polling fallback
        useToastStore
          .getState()
          .addToast('WebSocket unavailable. Switched to REST polling.', 'warning');
        startPolling();
        return; // Don't set 'failed' state — startPolling sets 'polling'
      }

      if (state.status === 'connected') {
        // WS recovered (e.g., manual reconnect) — stop polling
        stopPolling();
      }

      setConnectionState(state);
    });

    // -----------------------------------------------------------------------
    // Initial Data Fetch + WS Connection
    // -----------------------------------------------------------------------

    // Fetch initial candle data via REST, then connect WS after data is loaded
    // to prevent live trades from being overwritten by the REST response.
    setKlineLoading(true);
    fetchUpbitCandles(symbol, interval)
      .then((candles) => {
        if (isActive) {
          setCandles(candles);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        console.error('[useUpbitStream] Failed to fetch candle data', {
          symbol,
          interval,
          timestamp: Date.now(),
          error,
        });
        useToastStore.getState().addToast(`Failed to load chart data for ${symbol}`, 'error');
      })
      .finally(() => {
        if (!isActive) return;
        setKlineLoading(false);
        // Connect WS after initial candle data is loaded to maintain data consistency
        manager.connect([
          { type: 'trade', codes: [symbol], isOnlyRealtime: true },
          { type: 'orderbook', codes: [symbol], isOnlyRealtime: true },
        ]);
      });

    // Fetch initial orderbook via REST
    fetchUpbitOrderBook(symbol)
      .then((snapshot) => {
        if (!isActive) return;
        const units = snapshot.orderbook_units;
        const bids: PriceLevel[] = [];
        const asks: PriceLevel[] = [];
        for (const unit of units) {
          bids.push({ price: unit.bid_price, quantity: unit.bid_size });
          asks.push({ price: unit.ask_price, quantity: unit.ask_size });
        }
        setDepthSnapshot(bids, asks, snapshot.timestamp);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[useUpbitStream] Failed to fetch orderbook', {
          symbol,
          timestamp: Date.now(),
          errorMessage,
        });
      });

    // Fetch initial trades via REST (populate trade feed before WS connects)
    fetchUpbitTrades(symbol, 50)
      .then((trades) => {
        if (!isActive) return;
        // Process oldest-first for correct feed ordering
        const sorted = [...trades].reverse();
        for (const trade of sorted) {
          addTrade({
            id: trade.sequential_id,
            price: trade.trade_price,
            quantity: trade.trade_volume,
            time: trade.timestamp,
            isBuyerMaker: trade.ask_bid === 'ASK',
          });
          if (trade.sequential_id > lastTradeSeqIdRef.current) {
            lastTradeSeqIdRef.current = trade.sequential_id;
          }
        }
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[useUpbitStream] Failed to fetch initial trades', {
          symbol,
          timestamp: Date.now(),
          errorMessage,
        });
      });

    // Cleanup
    return () => {
      isActive = false;
      stopPolling();
      unsubscribeMessages();
      unsubscribeState();
      manager.disconnect();
    };
  }, [
    symbol,
    interval,
    handleTrade,
    handleOrderBook,
    setConnectionState,
    setCandles,
    addCandle,
    updateLastCandle,
    setKlineLoading,
    setDepthSnapshot,
    addTrade,
    resetKlineData,
    resetDepthStore,
    resetTradeStore,
  ]);
}
