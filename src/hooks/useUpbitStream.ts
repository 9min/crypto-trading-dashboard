// =============================================================================
// useUpbitStream Hook
// =============================================================================
// Orchestrates the Upbit WebSocket lifecycle for a given symbol and interval.
// Connects to Upbit WS, fetches initial candle data via REST, and routes
// incoming messages to the existing Zustand stores (klineStore, depthStore,
// tradeStore). Translates Upbit-specific event formats into domain types.
//
// NOTE: Upbit does not provide a kline WebSocket stream. Live candles are
// constructed from individual trade events using interval-aligned timestamps.
// =============================================================================

import { useEffect, useCallback } from 'react';
import { UpbitWebSocketManager } from '@/lib/upbit/UpbitWebSocketManager';
import { createUpbitMessageRouter } from '@/lib/upbit/messageRouter';
import { fetchUpbitCandles, fetchUpbitOrderBook } from '@/lib/upbit/restClient';
import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useDepthStore } from '@/stores/depthStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useToastStore } from '@/stores/toastStore';
import { alignToIntervalSec } from '@/utils/intervalAlign';
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
    const manager = UpbitWebSocketManager.getInstance();

    // Reset stores
    resetKlineData();
    resetDepthStore();
    resetTradeStore();

    // Create message router (no ticker handler — candles built from trades)
    const router = createUpbitMessageRouter({
      onTrade: handleTrade,
      onOrderBook: handleOrderBook,
    });

    const unsubscribeMessages = manager.subscribe(router);

    // Track connection state
    const unsubscribeState = manager.onStateChange((state: ConnectionState): void => {
      if (!isActive) return;
      setConnectionState(state);

      if (state.status === 'failed') {
        useToastStore
          .getState()
          .addToast('Upbit WebSocket connection lost. Click Reconnect to retry.', 'error');
      }
    });

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

    // Cleanup
    return () => {
      isActive = false;
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
    setKlineLoading,
    setDepthSnapshot,
    resetKlineData,
    resetDepthStore,
    resetTradeStore,
  ]);
}
