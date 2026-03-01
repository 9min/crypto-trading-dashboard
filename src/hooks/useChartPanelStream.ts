// =============================================================================
// useChartPanelStream Hook
// =============================================================================
// Per-panel WebSocket + REST kline data hook for multi-chart panels.
// Each panel manages its own WebSocket connection (kline stream only)
// and local candle state, independent of the global klineStore.
//
// Supports both Binance and Upbit exchanges:
//   - Binance: REST kline fetch + WebSocket kline stream
//   - Upbit: REST candle fetch + WebSocket trade stream (candles built locally)
//
// On mount: fetches historical klines via REST, connects WebSocket.
// On symbol/interval change: cleans up and reconnects.
// On unmount: closes WebSocket and cancels pending operations.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchKlines } from '@/lib/binance/restApi';
import { buildStreamUrl, getKlineStream } from '@/lib/binance/streamUrls';
import { UpbitWebSocketManager } from '@/lib/upbit/UpbitWebSocketManager';
import { fetchUpbitCandles } from '@/lib/upbit/restClient';
import { toUpbitSymbol, BINANCE_TO_UPBIT_MAP } from '@/utils/symbolMap';
import { alignToIntervalSec } from '@/utils/intervalAlign';
import { useUiStore } from '@/stores/uiStore';
import type { CandleData, KlineInterval } from '@/types/chart';
import type { BinanceKlineEvent, BinanceCombinedStreamMessage } from '@/types/binance';
import type { UpbitWebSocketMessage } from '@/types/upbit';
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS, MAX_CANDLES } from '@/utils/constants';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseChartPanelStreamParams {
  panelId: string;
  symbol: string;
  interval: KlineInterval;
}

interface UseChartPanelStreamReturn {
  candles: CandleData[];
  isLoading: boolean;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS);
}

function parseKlineToCandle(k: BinanceKlineEvent['k']): CandleData {
  return {
    time: k.t / 1000,
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
  };
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useChartPanelStream({
  panelId,
  symbol,
  interval,
}: UseChartPanelStreamParams): UseChartPanelStreamReturn {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const exchange = useUiStore((state) => state.exchange);

  // Refs for WebSocket reconnection logic (Binance only)
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable candle update handler using ref to avoid stale closures
  const candlesRef = useRef<CandleData[]>([]);

  const updateCandle = useCallback((klineData: BinanceKlineEvent['k']) => {
    const candle = parseKlineToCandle(klineData);
    const current = candlesRef.current;

    let next: CandleData[];
    if (current.length > 0 && current[current.length - 1].time === candle.time) {
      // Update last candle in place
      next = [...current.slice(0, -1), candle];
    } else {
      // New candle — append and trim to MAX_CANDLES
      next = [...current, candle].slice(-MAX_CANDLES);
    }

    candlesRef.current = next;
    setCandles(next);
  }, []);

  // Upbit trade → candle builder
  const handleUpbitTrade = useCallback(
    (message: UpbitWebSocketMessage) => {
      if (message.type !== 'trade') return;

      const upbitSymbol = toUpbitSymbol(symbol);
      if (message.code !== upbitSymbol) return;

      const candleOpenTimeSec = alignToIntervalSec(message.trade_timestamp, interval);
      const current = candlesRef.current;
      const lastCandle = current.length > 0 ? current[current.length - 1] : undefined;

      let next: CandleData[];
      if (!lastCandle || candleOpenTimeSec > lastCandle.time) {
        // New candle period started
        const newCandle: CandleData = {
          time: candleOpenTimeSec,
          open: message.trade_price,
          high: message.trade_price,
          low: message.trade_price,
          close: message.trade_price,
          volume: message.trade_volume,
        };
        next = [...current, newCandle].slice(-MAX_CANDLES);
      } else if (candleOpenTimeSec === lastCandle.time) {
        // Same candle period — merge OHLCV
        const merged: CandleData = {
          time: lastCandle.time,
          open: lastCandle.open,
          high: Math.max(lastCandle.high, message.trade_price),
          low: Math.min(lastCandle.low, message.trade_price),
          close: message.trade_price,
          volume: lastCandle.volume + message.trade_volume,
        };
        next = [...current.slice(0, -1), merged];
      } else {
        // Stale/out-of-order trade — ignore
        return;
      }

      candlesRef.current = next;
      setCandles(next);
    },
    [symbol, interval],
  );

  useEffect(() => {
    let isActive = true;

    // Reset state for new symbol/interval/exchange connection
    candlesRef.current = [];

    if (exchange === 'upbit') {
      // -----------------------------------------------------------------------
      // Upbit Path
      // -----------------------------------------------------------------------
      const upbitSymbol = toUpbitSymbol(symbol);

      // If no upbit mapping exists, leave empty state
      if (!BINANCE_TO_UPBIT_MAP.has(symbol)) {
        // Use microtask to avoid synchronous setState in effect body
        void Promise.resolve().then(() => {
          if (isActive) setIsLoading(false);
        });
        return () => {
          isActive = false;
          setCandles([]);
          setIsLoading(true);
        };
      }

      const groupId = `multichart-${panelId}`;
      const manager = UpbitWebSocketManager.getInstance();

      // Fetch initial candles via REST
      fetchUpbitCandles(upbitSymbol, interval)
        .then((data) => {
          if (!isActive) return;
          candlesRef.current = data;
          setCandles(data);
        })
        .catch((error: unknown) => {
          if (!isActive) return;
          console.error('[useChartPanelStream] Failed to fetch upbit candles', {
            symbol,
            upbitSymbol,
            interval,
            timestamp: Date.now(),
            error,
          });
        })
        .finally(() => {
          if (!isActive) return;
          setIsLoading(false);

          // Connect WS after REST to maintain data consistency
          manager.connect(groupId, [{ type: 'trade', codes: [upbitSymbol], isOnlyRealtime: true }]);
        });

      const unsubscribe = manager.subscribe(handleUpbitTrade);

      // Cleanup
      return () => {
        isActive = false;
        unsubscribe();
        manager.disconnectGroup(groupId);
        manager.disconnect();

        setCandles([]);
        setIsLoading(true);
      };
    }

    // -----------------------------------------------------------------------
    // Binance Path (default)
    // -----------------------------------------------------------------------

    // Fetch initial klines via REST
    fetchKlines(symbol, interval)
      .then((data) => {
        if (!isActive) return;
        candlesRef.current = data;
        setCandles(data);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        console.error('[useChartPanelStream] Failed to fetch klines', {
          symbol,
          interval,
          timestamp: Date.now(),
          error,
        });
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    // Connect WebSocket for live kline updates
    function connect(): void {
      if (!isActive) return;

      const streamName = getKlineStream(symbol, interval);
      const url = buildStreamUrl([streamName]);
      const ws = new WebSocket(url);

      ws.onopen = (): void => {
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent): void => {
        if (!isActive) return;
        try {
          const parsed = JSON.parse(
            event.data as string,
          ) as BinanceCombinedStreamMessage<BinanceKlineEvent>;
          if (parsed.data && parsed.data.e === 'kline') {
            updateCandle(parsed.data.k);
          }
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onclose = (): void => {
        if (!isActive) return;
        // Reconnect with exponential backoff
        const delay = getReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (): void => {
        // Error will trigger onclose — no action needed here
      };

      wsRef.current = ws;
    }

    connect();

    // Cleanup
    return () => {
      isActive = false;

      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }

      reconnectAttemptRef.current = 0;

      // Reset visible state for next symbol/interval
      setCandles([]);
      setIsLoading(true);
    };
  }, [symbol, interval, exchange, panelId, updateCandle, handleUpbitTrade]);

  return { candles, isLoading };
}
