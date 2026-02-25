// =============================================================================
// useUpbitStream Hook
// =============================================================================
// Orchestrates the Upbit WebSocket lifecycle for a given symbol and interval.
// Connects to Upbit WS, fetches initial candle data via REST, and routes
// incoming messages to the existing Zustand stores (klineStore, depthStore,
// tradeStore). Translates Upbit-specific event formats into domain types.
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
import type { ConnectionState, PriceLevel, KlineInterval } from '@/types/chart';
import type { UpbitTickerEvent, UpbitTradeEvent, UpbitOrderBookEvent } from '@/types/upbit';

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
  const updateLastCandle = useKlineStore((state) => state.updateLastCandle);
  const setKlineLoading = useKlineStore((state) => state.setLoading);
  const resetKlineData = useKlineStore((state) => state.resetData);

  const setDepthSnapshot = useDepthStore((state) => state.setSnapshot);
  const resetDepthStore = useDepthStore((state) => state.reset);

  const addTrade = useTradeStore((state) => state.addTrade);
  const resetTradeStore = useTradeStore((state) => state.reset);

  const interval = paramInterval ?? storeInterval;

  // -- Ticker handler: updates the live candle --
  const handleTicker = useCallback(
    (event: UpbitTickerEvent): void => {
      // Upbit ticker gives us current OHLCV; update the live candle
      updateLastCandle({
        time: Math.floor(event.trade_timestamp / 1000),
        open: event.opening_price,
        high: event.high_price,
        low: event.low_price,
        close: event.trade_price,
        volume: event.acc_trade_volume_24h,
      });
    },
    [updateLastCandle],
  );

  // -- Trade handler --
  const handleTrade = useCallback(
    (event: UpbitTradeEvent): void => {
      addTrade({
        id: event.sequential_id,
        price: event.trade_price,
        quantity: event.trade_volume,
        time: event.trade_timestamp,
        isBuyerMaker: event.ask_bid === 'ASK',
      });
    },
    [addTrade],
  );

  // -- OrderBook handler: full snapshot each time (Upbit sends complete book) --
  const handleOrderBook = useCallback(
    (event: UpbitOrderBookEvent): void => {
      const bids: PriceLevel[] = event.orderbook_units.map((unit) => ({
        price: unit.bid_price,
        quantity: unit.bid_size,
      }));
      const asks: PriceLevel[] = event.orderbook_units.map((unit) => ({
        price: unit.ask_price,
        quantity: unit.ask_size,
      }));

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

    // Create message router
    const router = createUpbitMessageRouter({
      onTicker: handleTicker,
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

    // Connect with subscriptions
    manager.connect([
      { type: 'ticker', codes: [symbol], isOnlyRealtime: true },
      { type: 'trade', codes: [symbol], isOnlyRealtime: true },
      { type: 'orderbook', codes: [symbol], isOnlyRealtime: true },
    ]);

    // Fetch initial candle data via REST
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
        if (isActive) {
          setKlineLoading(false);
        }
      });

    // Fetch initial orderbook via REST
    fetchUpbitOrderBook(symbol)
      .then((snapshot) => {
        if (!isActive) return;
        const bids: PriceLevel[] = snapshot.orderbook_units.map((unit) => ({
          price: unit.bid_price,
          quantity: unit.bid_size,
        }));
        const asks: PriceLevel[] = snapshot.orderbook_units.map((unit) => ({
          price: unit.ask_price,
          quantity: unit.ask_size,
        }));
        setDepthSnapshot(bids, asks, snapshot.timestamp);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        console.error('[useUpbitStream] Failed to fetch orderbook', {
          symbol,
          timestamp: Date.now(),
          error,
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
    handleTicker,
    handleTrade,
    handleOrderBook,
    setConnectionState,
    setCandles,
    setKlineLoading,
    setDepthSnapshot,
    resetKlineData,
    resetDepthStore,
    resetTradeStore,
  ]);
}
