// =============================================================================
// useUpbitStream Tests
// =============================================================================
// Tests the Upbit WebSocket lifecycle hook including:
//   - Setup/cleanup of WS connection and subscriptions
//   - Initial candle, orderbook, and trades REST fetches
//   - Trade handling: live candle construction, OHLCV merging
//   - OrderBook handling: full snapshot application
//   - Polling fallback on WS failure
//   - Trade deduplication via sequential_id
//   - Disabled state when symbol is null
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockUpbitConnect = vi.fn();
const mockUpbitDisconnect = vi.fn();
const mockUpbitDisconnectGroup = vi.fn();
const mockUpbitSubscribe = vi.fn<[(...args: unknown[]) => void], () => void>(() => vi.fn());
const mockUpbitOnStateChange = vi.fn<[(...args: unknown[]) => void], () => void>(() => vi.fn());

vi.mock('@/lib/upbit/UpbitWebSocketManager', () => ({
  UpbitWebSocketManager: {
    getInstance: () => ({
      connect: mockUpbitConnect,
      disconnect: mockUpbitDisconnect,
      disconnectGroup: mockUpbitDisconnectGroup,
      subscribe: mockUpbitSubscribe,
      onStateChange: mockUpbitOnStateChange,
    }),
  },
}));

const mockCreateUpbitMessageRouter = vi.fn(
  (handlers: Record<string, (...args: unknown[]) => void>) => handlers,
);

vi.mock('@/lib/upbit/messageRouter', () => ({
  createUpbitMessageRouter: (...args: unknown[]) => mockCreateUpbitMessageRouter(...args),
}));

const mockFetchUpbitCandles = vi.fn().mockResolvedValue([]);
const mockFetchUpbitOrderBook = vi.fn().mockResolvedValue({
  market: 'KRW-BTC',
  orderbook_units: [],
  total_ask_size: 0,
  total_bid_size: 0,
  timestamp: 1000000,
});
const mockFetchUpbitTrades = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/upbit/restClient', () => ({
  fetchUpbitCandles: (...args: unknown[]) => mockFetchUpbitCandles(...args),
  fetchUpbitOrderBook: (...args: unknown[]) => mockFetchUpbitOrderBook(...args),
  fetchUpbitTrades: (...args: unknown[]) => mockFetchUpbitTrades(...args),
}));

vi.mock('@/utils/constants', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/constants')>();
  return {
    ...original,
    REST_POLL_INTERVAL_MS: 100, // Short interval for tests
  };
});

import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useDepthStore } from '@/stores/depthStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useToastStore } from '@/stores/toastStore';
import { useUpbitStream } from './useUpbitStream';
import type { ConnectionState } from '@/types/chart';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

function getLatestStateChangeCallback(): (state: ConnectionState) => void {
  const calls = mockUpbitOnStateChange.mock.calls;
  return calls[calls.length - 1][0] as (state: ConnectionState) => void;
}

function getRouterHandlers(): Record<string, (...args: unknown[]) => void> {
  const calls = mockCreateUpbitMessageRouter.mock.calls;
  return calls[calls.length - 1][0] as Record<string, (...args: unknown[]) => void>;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useUpbitStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      symbol: 'BTCUSDT',
      connectionState: { status: 'idle' },
    });
    useKlineStore.setState({
      candles: [],
      interval: '1m',
      isLoading: false,
    });
    useDepthStore.getState().reset();
    useTradeStore.getState().reset();
    useToastStore.setState({ toasts: [] });

    mockFetchUpbitCandles.mockResolvedValue([]);
    mockFetchUpbitOrderBook.mockResolvedValue({
      market: 'KRW-BTC',
      orderbook_units: [],
      total_ask_size: 0,
      total_bid_size: 0,
      timestamp: 1000000,
    });
    mockFetchUpbitTrades.mockResolvedValue([]);
    mockUpbitSubscribe.mockReturnValue(vi.fn());
    mockUpbitOnStateChange.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Null symbol (disabled)
  // ---------------------------------------------------------------------------

  describe('disabled state', () => {
    it('does not connect when symbol is null', () => {
      renderHook(() => useUpbitStream({ symbol: null }));

      expect(mockUpbitConnect).not.toHaveBeenCalled();
    });

    it('does not subscribe when symbol is null', () => {
      renderHook(() => useUpbitStream({ symbol: null }));

      expect(mockUpbitSubscribe).not.toHaveBeenCalled();
    });

    it('does not fetch REST data when symbol is null', () => {
      renderHook(() => useUpbitStream({ symbol: null }));

      expect(mockFetchUpbitCandles).not.toHaveBeenCalled();
      expect(mockFetchUpbitOrderBook).not.toHaveBeenCalled();
      expect(mockFetchUpbitTrades).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Setup / Cleanup
  // ---------------------------------------------------------------------------

  describe('setup and cleanup', () => {
    it('subscribes to messages on mount', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(mockUpbitSubscribe).toHaveBeenCalledWith(expect.any(Object));
    });

    it('subscribes to state changes on mount', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(mockUpbitOnStateChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('disconnects on unmount', () => {
      const { unmount } = renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      unmount();

      expect(mockUpbitDisconnectGroup).toHaveBeenCalledWith('stream');
      expect(mockUpbitDisconnect).toHaveBeenCalled();
    });

    it('unsubscribes messages on unmount', () => {
      const unsubMessages = vi.fn();
      mockUpbitSubscribe.mockReturnValue(unsubMessages);

      const { unmount } = renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));
      unmount();

      expect(unsubMessages).toHaveBeenCalled();
    });

    it('unsubscribes state changes on unmount', () => {
      const unsubState = vi.fn();
      mockUpbitOnStateChange.mockReturnValue(unsubState);

      const { unmount } = renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));
      unmount();

      expect(unsubState).toHaveBeenCalled();
    });

    it('resets stores on mount', () => {
      const resetKline = vi.spyOn(useKlineStore.getState(), 'resetData');
      const resetDepth = vi.spyOn(useDepthStore.getState(), 'reset');
      const resetTrade = vi.spyOn(useTradeStore.getState(), 'reset');

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(resetKline).toHaveBeenCalled();
      expect(resetDepth).toHaveBeenCalled();
      expect(resetTrade).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Initial data fetch
  // ---------------------------------------------------------------------------

  describe('initial data fetch', () => {
    it('fetches candles with symbol and interval', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(mockFetchUpbitCandles).toHaveBeenCalledWith('KRW-BTC', '1m');
    });

    it('uses custom interval parameter', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC', interval: '5m' }));

      expect(mockFetchUpbitCandles).toHaveBeenCalledWith('KRW-BTC', '5m');
    });

    it('sets kline loading state during fetch', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(useKlineStore.getState().isLoading).toBe(true);
    });

    it('sets candles on successful fetch', async () => {
      const candles = [{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }];
      mockFetchUpbitCandles.mockResolvedValue(candles);

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      await act(async () => {
        await flushAsync();
      });

      expect(useKlineStore.getState().candles).toEqual(candles);
    });

    it('connects WS after candle fetch completes', async () => {
      mockFetchUpbitCandles.mockResolvedValue([]);

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      // WS connect is called in .finally() of candle fetch
      await act(async () => {
        await flushAsync();
      });

      expect(mockUpbitConnect).toHaveBeenCalledWith(
        'stream',
        expect.arrayContaining([
          expect.objectContaining({ type: 'trade', codes: ['KRW-BTC'] }),
          expect.objectContaining({ type: 'orderbook', codes: ['KRW-BTC'] }),
        ]),
      );
    });

    it('shows toast on candle fetch failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchUpbitCandles.mockRejectedValue(new Error('fail'));

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      await act(async () => {
        await flushAsync();
      });

      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
      consoleErrorSpy.mockRestore();
    });

    it('fetches initial orderbook', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(mockFetchUpbitOrderBook).toHaveBeenCalledWith('KRW-BTC');
    });

    it('sets depth snapshot from orderbook response', async () => {
      mockFetchUpbitOrderBook.mockResolvedValue({
        market: 'KRW-BTC',
        orderbook_units: [{ bid_price: 50000, bid_size: 1.5, ask_price: 50001, ask_size: 2.0 }],
        total_ask_size: 2.0,
        total_bid_size: 1.5,
        timestamp: 1000000,
      });

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      await act(async () => {
        await flushAsync();
      });

      const state = useDepthStore.getState();
      expect(state.bids.length).toBe(1);
      expect(state.asks.length).toBe(1);
    });

    it('fetches initial trades', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      expect(mockFetchUpbitTrades).toHaveBeenCalledWith('KRW-BTC', 50);
    });

    it('adds initial trades to trade store', async () => {
      mockFetchUpbitTrades.mockResolvedValue([
        {
          market: 'KRW-BTC',
          sequential_id: 1,
          trade_price: 50000,
          trade_volume: 0.5,
          timestamp: 1000000,
          ask_bid: 'BID',
          trade_date_utc: '2024-01-01',
          trade_time_utc: '12:00:00',
          prev_closing_price: 49000,
          change_price: 1000,
        },
      ]);

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      await act(async () => {
        await flushAsync();
      });

      expect(useTradeStore.getState().toTradeEntries().length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Trade handling (live candle construction)
  // ---------------------------------------------------------------------------

  describe('trade handling', () => {
    it('creates message router with onTrade handler', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const routerArg = mockCreateUpbitMessageRouter.mock.calls[0][0];
      expect(routerArg).toHaveProperty('onTrade');
    });

    it('adds trade to trade store', async () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const router = getRouterHandlers();
      const tradeEvent = {
        type: 'trade' as const,
        code: 'KRW-BTC',
        trade_price: 50000,
        trade_volume: 0.5,
        ask_bid: 'BID' as const,
        trade_timestamp: 1000000,
        sequential_id: 100,
      };

      await act(async () => {
        if (router.onTrade) router.onTrade(tradeEvent);
      });

      const trades = useTradeStore.getState().toTradeEntries();
      expect(trades.length).toBe(1);
      expect(trades[0].price).toBe(50000);
    });

    it('creates new candle for new period', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const handlers = mockCreateUpbitMessageRouter.mock.calls[0][0];

      act(() => {
        handlers.onTrade({
          type: 'trade' as const,
          code: 'KRW-BTC',
          trade_price: 50000,
          trade_volume: 1.0,
          ask_bid: 'BID' as const,
          trade_timestamp: 60000, // 1 minute epoch
          sequential_id: 1,
        });
      });

      const candles = useKlineStore.getState().candles;
      expect(candles.length).toBe(1);
      expect(candles[0].open).toBe(50000);
      expect(candles[0].close).toBe(50000);
    });

    it('merges OHLCV for same candle period', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      // Set candle AFTER hook mount (hook resets candles on mount)
      useKlineStore.setState({
        candles: [{ time: 0, open: 49000, high: 49500, low: 48500, close: 49000, volume: 1.0 }],
      });

      // The handleTrade reads klineStore.getState() internally
      const handlers = mockCreateUpbitMessageRouter.mock.calls[0][0];

      act(() => {
        handlers.onTrade({
          type: 'trade' as const,
          code: 'KRW-BTC',
          trade_price: 50000,
          trade_volume: 0.5,
          ask_bid: 'BID' as const,
          trade_timestamp: 30000, // Within first minute (aligns to time=0)
          sequential_id: 2,
        });
      });

      const candles = useKlineStore.getState().candles;
      expect(candles.length).toBe(1);
      expect(candles[0].high).toBe(50000); // Updated high
      expect(candles[0].close).toBe(50000); // Updated close
      expect(candles[0].volume).toBe(1.5); // Accumulated volume
    });

    it('marks ASK trades as buyer-maker', async () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const router = getRouterHandlers();

      await act(async () => {
        if (router.onTrade) {
          router.onTrade({
            type: 'trade' as const,
            code: 'KRW-BTC',
            trade_price: 50000,
            trade_volume: 0.5,
            ask_bid: 'ASK' as const,
            trade_timestamp: 1000,
            sequential_id: 10,
          });
        }
      });

      const trades = useTradeStore.getState().toTradeEntries();
      expect(trades[0].isBuyerMaker).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // OrderBook handling
  // ---------------------------------------------------------------------------

  describe('orderbook handling', () => {
    it('creates message router with onOrderBook handler', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const routerArg = mockCreateUpbitMessageRouter.mock.calls[0][0];
      expect(routerArg).toHaveProperty('onOrderBook');
    });

    it('sets depth snapshot from orderbook event', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const handlers = mockCreateUpbitMessageRouter.mock.calls[0][0];

      act(() => {
        handlers.onOrderBook({
          type: 'orderbook' as const,
          code: 'KRW-BTC',
          total_ask_size: 5.0,
          total_bid_size: 4.0,
          orderbook_units: [
            { bid_price: 50000, bid_size: 2.0, ask_price: 50001, ask_size: 1.5 },
            { bid_price: 49999, bid_size: 1.0, ask_price: 50002, ask_size: 0.5 },
          ],
          timestamp: 2000000,
        });
      });

      const state = useDepthStore.getState();
      expect(state.bids.length).toBe(2);
      expect(state.asks.length).toBe(2);
      expect(state.bids[0].price).toBe(50000);
    });
  });

  // ---------------------------------------------------------------------------
  // Connection state + polling fallback
  // ---------------------------------------------------------------------------

  describe('connection state', () => {
    it('syncs connection state to uiStore', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const stateCallback = getLatestStateChangeCallback();

      act(() => {
        stateCallback({ status: 'connected', connectedAt: Date.now() });
      });

      expect(useUiStore.getState().connectionState.status).toBe('connected');
    });

    it('shows toast and starts polling on WS failure', () => {
      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const stateCallback = getLatestStateChangeCallback();

      act(() => {
        stateCallback({ status: 'failed', error: 'WS failed' });
      });

      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
      // The polling state is set inside startPolling
      expect(useUiStore.getState().connectionState.status).toBe('polling');
    });

    it('stops polling when WS recovers', async () => {
      vi.useFakeTimers();

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const stateCallback = getLatestStateChangeCallback();

      // Start polling
      act(() => {
        stateCallback({ status: 'failed', error: 'WS failed' });
      });

      // Recover
      act(() => {
        stateCallback({ status: 'connected', connectedAt: Date.now() });
      });

      // Clear call counts to check no new polling calls
      mockFetchUpbitCandles.mockClear();

      // Advance timer past poll interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      // Should not have polled (polling stopped)
      expect(mockFetchUpbitCandles).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Polling fallback
  // ---------------------------------------------------------------------------

  describe('polling fallback', () => {
    it('polls candles, orderbook, and trades at interval', async () => {
      vi.useFakeTimers();

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const stateCallback = getLatestStateChangeCallback();

      // Trigger polling mode
      act(() => {
        stateCallback({ status: 'failed', error: 'WS failed' });
      });

      mockFetchUpbitCandles.mockClear();
      mockFetchUpbitOrderBook.mockClear();
      mockFetchUpbitTrades.mockClear();

      // Advance past one poll interval (100ms in test config)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      expect(mockFetchUpbitCandles).toHaveBeenCalled();
      expect(mockFetchUpbitOrderBook).toHaveBeenCalled();
      expect(mockFetchUpbitTrades).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('stops polling on unmount', async () => {
      vi.useFakeTimers();

      const { unmount } = renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const stateCallback = getLatestStateChangeCallback();

      act(() => {
        stateCallback({ status: 'failed', error: 'WS failed' });
      });

      mockFetchUpbitCandles.mockClear();

      unmount();

      // Advance past poll interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Should not have polled after unmount
      expect(mockFetchUpbitCandles).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('deduplicates trades by sequential_id during polling', async () => {
      vi.useFakeTimers();

      renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      const stateCallback = getLatestStateChangeCallback();
      const router = getRouterHandlers();

      // Process a trade via WS handler first
      await act(async () => {
        if (router.onTrade) {
          router.onTrade({
            type: 'trade' as const,
            code: 'KRW-BTC',
            trade_price: 50000,
            trade_volume: 0.5,
            ask_bid: 'BID' as const,
            trade_timestamp: 1000,
            sequential_id: 100,
          });
        }
      });

      // Switch to polling
      act(() => {
        stateCallback({ status: 'failed', error: 'WS failed' });
      });

      // Polling returns trades including the already-seen one
      mockFetchUpbitTrades.mockResolvedValue([
        {
          market: 'KRW-BTC',
          sequential_id: 100,
          trade_price: 50000,
          trade_volume: 0.5,
          timestamp: 1000,
          ask_bid: 'BID' as const,
          trade_date_utc: '2024-01-01',
          trade_time_utc: '12:00:00',
          prev_closing_price: 49000,
          change_price: 1000,
        },
        {
          market: 'KRW-BTC',
          sequential_id: 101,
          trade_price: 50100,
          trade_volume: 0.3,
          timestamp: 1001,
          ask_bid: 'ASK' as const,
          trade_date_utc: '2024-01-01',
          trade_time_utc: '12:00:01',
          prev_closing_price: 49000,
          change_price: 1100,
        },
      ]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      // Should have 2 trades total (1 from WS + 1 new from poll, deduped)
      const trades = useTradeStore.getState().toTradeEntries();
      expect(trades.length).toBe(2);

      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Stale response guard
  // ---------------------------------------------------------------------------

  describe('stale response guard', () => {
    it('discards candle response after unmount', async () => {
      let resolveCandles: ((value: unknown) => void) | null = null;
      mockFetchUpbitCandles.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCandles = resolve;
          }),
      );

      const { unmount } = renderHook(() => useUpbitStream({ symbol: 'KRW-BTC' }));

      unmount();

      await act(async () => {
        resolveCandles?.([{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }]);
        await flushAsync();
      });

      expect(useKlineStore.getState().candles).toEqual([]);
    });
  });
});
