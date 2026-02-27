// =============================================================================
// useWebSocket Tests
// =============================================================================
// Tests the Binance WebSocket lifecycle hook including:
//   - Setup/cleanup of WS connection and subscriptions
//   - Initial kline and depth snapshot REST fetches
//   - Kline message handling (open/closed candles)
//   - Trade message handling
//   - Depth buffering, snapshot replay, and sequence validation
//   - Connection state sync with uiStore
//   - enabled=false disabling behavior
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSubscribe = vi.fn<[(...args: unknown[]) => void], () => void>(() => vi.fn());
const mockOnStateChange = vi.fn<[(...args: unknown[]) => void], () => void>(() => vi.fn());

vi.mock('@/lib/websocket/WebSocketManager', () => ({
  WebSocketManager: {
    getInstance: () => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      subscribe: mockSubscribe,
      onStateChange: mockOnStateChange,
    }),
  },
}));

const mockCreateMessageRouter = vi.fn(
  (handlers: Record<string, (...args: unknown[]) => void>) => handlers,
);

vi.mock('@/lib/websocket/messageRouter', () => ({
  createMessageRouter: (...args: unknown[]) => mockCreateMessageRouter(...args),
}));

const mockBuildCombinedStreamUrl = vi.fn(() => 'wss://mock-url');

vi.mock('@/lib/binance/streamUrls', () => ({
  buildCombinedStreamUrl: (...args: unknown[]) => mockBuildCombinedStreamUrl(...args),
}));

const mockFetchKlines = vi.fn().mockResolvedValue([]);
const mockFetchDepthSnapshot = vi.fn().mockResolvedValue({
  lastUpdateId: 100,
  bids: [],
  asks: [],
});

vi.mock('@/lib/binance/restApi', () => ({
  fetchKlines: (...args: unknown[]) => mockFetchKlines(...args),
  fetchDepthSnapshot: (...args: unknown[]) => mockFetchDepthSnapshot(...args),
}));

import { useUiStore } from '@/stores/uiStore';
import { useKlineStore } from '@/stores/klineStore';
import { useDepthStore } from '@/stores/depthStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useToastStore } from '@/stores/toastStore';
import { useWebSocket } from './useWebSocket';
import type { ConnectionState } from '@/types/chart';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Flush pending microtasks and a 50ms timer to allow REST calls to settle */
async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

function getLatestStateChangeCallback(): (state: ConnectionState) => void {
  const calls = mockOnStateChange.mock.calls;
  return calls[calls.length - 1][0] as (state: ConnectionState) => void;
}

function getLatestSubscribeCallback(): Record<string, (...args: unknown[]) => void> {
  const calls = mockSubscribe.mock.calls;
  return calls[calls.length - 1][0] as Record<string, (...args: unknown[]) => void>;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useWebSocket', () => {
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

    // Reset mock implementations
    mockFetchKlines.mockResolvedValue([]);
    mockFetchDepthSnapshot.mockResolvedValue({
      lastUpdateId: 100,
      bids: [],
      asks: [],
    });
    mockSubscribe.mockReturnValue(vi.fn());
    mockOnStateChange.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Setup / Cleanup
  // ---------------------------------------------------------------------------

  describe('setup and cleanup', () => {
    it('connects to WebSocket on mount', () => {
      renderHook(() => useWebSocket());

      expect(mockConnect).toHaveBeenCalledWith('wss://mock-url');
    });

    it('builds combined stream URL with symbol and interval', () => {
      renderHook(() => useWebSocket());

      expect(mockBuildCombinedStreamUrl).toHaveBeenCalledWith('BTCUSDT', '1m');
    });

    it('subscribes to messages via manager.subscribe', () => {
      renderHook(() => useWebSocket());

      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Object));
    });

    it('subscribes to state changes via manager.onStateChange', () => {
      renderHook(() => useWebSocket());

      expect(mockOnStateChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('disconnects on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('unsubscribes messages on unmount', () => {
      const unsubMessages = vi.fn();
      mockSubscribe.mockReturnValue(unsubMessages);

      const { unmount } = renderHook(() => useWebSocket());
      unmount();

      expect(unsubMessages).toHaveBeenCalled();
    });

    it('unsubscribes state changes on unmount', () => {
      const unsubState = vi.fn();
      mockOnStateChange.mockReturnValue(unsubState);

      const { unmount } = renderHook(() => useWebSocket());
      unmount();

      expect(unsubState).toHaveBeenCalled();
    });

    it('resets kline, depth, and trade stores on mount', () => {
      const resetKline = vi.spyOn(useKlineStore.getState(), 'resetData');
      const resetDepth = vi.spyOn(useDepthStore.getState(), 'reset');
      const resetTrade = vi.spyOn(useTradeStore.getState(), 'reset');

      renderHook(() => useWebSocket());

      expect(resetKline).toHaveBeenCalled();
      expect(resetDepth).toHaveBeenCalled();
      expect(resetTrade).toHaveBeenCalled();
    });

    it('uses params.symbol over store symbol', () => {
      renderHook(() => useWebSocket({ symbol: 'ETHUSDT' }));

      expect(mockBuildCombinedStreamUrl).toHaveBeenCalledWith('ETHUSDT', '1m');
    });

    it('uses params.interval over store interval', () => {
      renderHook(() => useWebSocket({ interval: '5m' }));

      expect(mockBuildCombinedStreamUrl).toHaveBeenCalledWith('BTCUSDT', '5m');
    });
  });

  // ---------------------------------------------------------------------------
  // enabled=false
  // ---------------------------------------------------------------------------

  describe('enabled=false', () => {
    it('does not connect when enabled is false', () => {
      renderHook(() => useWebSocket({ enabled: false }));

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('does not subscribe when enabled is false', () => {
      renderHook(() => useWebSocket({ enabled: false }));

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('does not fetch klines when enabled is false', () => {
      renderHook(() => useWebSocket({ enabled: false }));

      expect(mockFetchKlines).not.toHaveBeenCalled();
    });

    it('does not fetch depth snapshot when enabled is false', () => {
      renderHook(() => useWebSocket({ enabled: false }));

      expect(mockFetchDepthSnapshot).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Initial data fetch
  // ---------------------------------------------------------------------------

  describe('initial data fetch', () => {
    it('fetches klines with symbol and interval', () => {
      renderHook(() => useWebSocket());

      expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1m');
    });

    it('sets kline loading state during fetch', () => {
      renderHook(() => useWebSocket());

      // setKlineLoading(true) is called synchronously
      expect(useKlineStore.getState().isLoading).toBe(true);
    });

    it('sets candles on successful kline fetch', async () => {
      const candles = [{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }];
      mockFetchKlines.mockResolvedValue(candles);

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      expect(useKlineStore.getState().candles).toEqual(candles);
    });

    it('clears loading state after kline fetch succeeds', async () => {
      mockFetchKlines.mockResolvedValue([]);

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      expect(useKlineStore.getState().isLoading).toBe(false);
    });

    it('clears loading state after kline fetch fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchKlines.mockRejectedValue(new Error('fetch failed'));

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      expect(useKlineStore.getState().isLoading).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('shows toast on kline fetch failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchKlines.mockRejectedValue(new Error('fetch failed'));

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
      consoleErrorSpy.mockRestore();
    });

    it('fetches depth snapshot on mount', () => {
      renderHook(() => useWebSocket());

      expect(mockFetchDepthSnapshot).toHaveBeenCalledWith('BTCUSDT');
    });

    it('sets depth snapshot on successful fetch', async () => {
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 200,
        bids: [['50000', '1.5']],
        asks: [['50001', '2.0']],
      });

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      const state = useDepthStore.getState();
      expect(state.bids.length).toBe(1);
      expect(state.asks.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Kline handling
  // ---------------------------------------------------------------------------

  describe('kline handling', () => {
    it('creates message router with onKline handler', () => {
      renderHook(() => useWebSocket());

      const routerArg = mockCreateMessageRouter.mock.calls[0][0];
      expect(routerArg).toHaveProperty('onKline');
      expect(typeof routerArg.onKline).toBe('function');
    });

    it('updates last candle for open kline (x=false)', () => {
      renderHook(() => useWebSocket());

      // Set candle AFTER hook mount (hook resets candles on mount)
      useKlineStore.setState({
        candles: [{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }],
      });

      const routerArg = mockCreateMessageRouter.mock.calls[0][0];
      const klineEvent = {
        e: 'kline' as const,
        E: 1000000,
        s: 'BTCUSDT',
        k: {
          t: 1000000,
          T: 1059999,
          s: 'BTCUSDT',
          i: '1m',
          o: '100',
          c: '108',
          h: '112',
          l: '95',
          v: '60',
          x: false,
          f: 0,
          L: 0,
          n: 0,
          q: '0',
          V: '0',
          Q: '0',
        },
      };

      act(() => {
        routerArg.onKline(klineEvent);
      });

      const candles = useKlineStore.getState().candles;
      expect(candles[candles.length - 1].close).toBe(108);
    });

    it('adds new candle for closed kline (x=true)', () => {
      renderHook(() => useWebSocket());

      // The router arg passed to createMessageRouter has the real hook handlers
      const routerArg = mockCreateMessageRouter.mock.calls[0][0];
      const klineEvent = {
        e: 'kline' as const,
        E: 1000000,
        s: 'BTCUSDT',
        k: {
          t: 1000000,
          T: 1059999,
          s: 'BTCUSDT',
          i: '1m',
          o: '100',
          c: '108',
          h: '112',
          l: '95',
          v: '60',
          x: true,
          f: 0,
          L: 0,
          n: 0,
          q: '0',
          V: '0',
          Q: '0',
        },
      };

      act(() => {
        routerArg.onKline(klineEvent);
      });

      expect(useKlineStore.getState().candles.length).toBe(1);
      expect(useKlineStore.getState().candles[0].close).toBe(108);
    });
  });

  // ---------------------------------------------------------------------------
  // Trade handling
  // ---------------------------------------------------------------------------

  describe('trade handling', () => {
    it('creates message router with onTrade handler', () => {
      renderHook(() => useWebSocket());

      const routerArg = mockCreateMessageRouter.mock.calls[0][0];
      expect(routerArg).toHaveProperty('onTrade');
      expect(typeof routerArg.onTrade).toBe('function');
    });

    it('calls addTrade with parsed trade data', async () => {
      renderHook(() => useWebSocket());

      const router = getLatestSubscribeCallback();
      const tradeEvent = {
        e: 'trade' as const,
        E: 1000000,
        s: 'BTCUSDT',
        t: 12345,
        p: '50000.50',
        q: '0.5',
        T: 1000001,
        m: true,
        b: 1,
        a: 2,
      };

      await act(async () => {
        if (router.onTrade) router.onTrade(tradeEvent);
      });

      const trades = useTradeStore.getState().toTradeEntries();
      expect(trades.length).toBe(1);
      expect(trades[0].price).toBe(50000.5);
      expect(trades[0].quantity).toBe(0.5);
      expect(trades[0].isBuyerMaker).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Depth buffering and snapshot replay
  // ---------------------------------------------------------------------------

  describe('depth buffering', () => {
    it('creates message router with onDepth handler', () => {
      renderHook(() => useWebSocket());

      const routerArg = mockCreateMessageRouter.mock.calls[0][0];
      expect(routerArg).toHaveProperty('onDepth');
      expect(typeof routerArg.onDepth).toBe('function');
    });

    it('buffers depth events before snapshot arrives', async () => {
      // Delay snapshot so depth events arrive first
      mockFetchDepthSnapshot.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderHook(() => useWebSocket());

      const router = getLatestSubscribeCallback();
      const depthEvent = {
        e: 'depthUpdate' as const,
        E: 1000000,
        s: 'BTCUSDT',
        U: 101,
        u: 102,
        b: [['50000', '1.0']],
        a: [['50001', '0.5']],
      };

      await act(async () => {
        if (router.onDepth) router.onDepth(depthEvent);
      });

      // Depth should not be applied yet (snapshot not arrived)
      // Verify via the store not having been updated
      const state = useDepthStore.getState();
      expect(state.lastUpdateId).toBe(0);
    });

    it('replays buffered events after snapshot', async () => {
      // Control snapshot timing
      let resolveSnapshot: ((value: unknown) => void) | null = null;
      mockFetchDepthSnapshot.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSnapshot = resolve;
          }),
      );

      renderHook(() => useWebSocket());

      const router = getLatestSubscribeCallback();

      // Buffer a depth event
      const depthEvent = {
        e: 'depthUpdate' as const,
        E: 1000000,
        s: 'BTCUSDT',
        U: 100,
        u: 101,
        b: [['49000', '2.0']],
        a: [['51000', '1.0']],
      };

      await act(async () => {
        if (router.onDepth) router.onDepth(depthEvent);
      });

      // Now resolve snapshot
      await act(async () => {
        resolveSnapshot?.({
          lastUpdateId: 100,
          bids: [['50000', '1.5']],
          asks: [['50001', '2.0']],
        });
        await flushAsync();
      });

      // After snapshot + replay, depth should be updated
      const state = useDepthStore.getState();
      expect(state.bids.length).toBeGreaterThan(0);
    });

    it('applies depth update after snapshot is ready', async () => {
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 100,
        bids: [['50000', '1.5']],
        asks: [['50001', '2.0']],
      });

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      const router = getLatestSubscribeCallback();

      // Send a depth event with sequence after snapshot
      const depthEvent = {
        e: 'depthUpdate' as const,
        E: 1000000,
        s: 'BTCUSDT',
        U: 101,
        u: 102,
        b: [['49000', '2.0']],
        a: [['51000', '1.0']],
      };

      await act(async () => {
        if (router.onDepth) router.onDepth(depthEvent);
      });

      const state = useDepthStore.getState();
      expect(state.lastUpdateId).toBe(102);
    });

    it('ignores stale depth events (u < expectedNextUpdateId)', async () => {
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 100,
        bids: [],
        asks: [],
      });

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      const router = getLatestSubscribeCallback();

      // Send a stale depth event
      const staleEvent = {
        e: 'depthUpdate' as const,
        E: 999999,
        s: 'BTCUSDT',
        U: 90,
        u: 95,
        b: [['49000', '2.0']],
        a: [],
      };

      await act(async () => {
        if (router.onDepth) router.onDepth(staleEvent);
      });

      // Should remain at snapshot state
      expect(useDepthStore.getState().lastUpdateId).toBe(100);
    });

    it('re-syncs on depth sequence gap', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 100,
        bids: [],
        asks: [],
      });

      renderHook(() => useWebSocket());

      await act(async () => {
        await flushAsync();
      });

      // Clear mock to detect re-fetch
      mockFetchDepthSnapshot.mockClear();
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 200,
        bids: [],
        asks: [],
      });

      const router = getLatestSubscribeCallback();

      // Send event with gap (U > expected)
      const gapEvent = {
        e: 'depthUpdate' as const,
        E: 1000000,
        s: 'BTCUSDT',
        U: 150,
        u: 160,
        b: [],
        a: [],
      };

      await act(async () => {
        if (router.onDepth) router.onDepth(gapEvent);
        await flushAsync();
      });

      // Should have re-fetched snapshot
      expect(mockFetchDepthSnapshot).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Depth snapshot retry
  // ---------------------------------------------------------------------------

  describe('depth snapshot retry', () => {
    it('retries snapshot on failure with exponential backoff', async () => {
      vi.useFakeTimers();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetchDepthSnapshot
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ lastUpdateId: 100, bids: [], asks: [] });

      renderHook(() => useWebSocket());

      // First call fails immediately
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockFetchDepthSnapshot).toHaveBeenCalledTimes(1);

      // Advance past first retry delay (1000ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });

      expect(mockFetchDepthSnapshot).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
    });

    it('shows toast and schedules recovery after max retries', async () => {
      vi.useFakeTimers();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetchDepthSnapshot.mockRejectedValue(new Error('persistent failure'));

      renderHook(() => useWebSocket());

      // Exhaust all retries (initial + 3 retries)
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10000);
        });
      }

      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Connection state sync
  // ---------------------------------------------------------------------------

  describe('connection state', () => {
    it('syncs connection state to uiStore', () => {
      renderHook(() => useWebSocket());

      const stateCallback = getLatestStateChangeCallback();
      const connectedState: ConnectionState = { status: 'connected', connectedAt: Date.now() };

      act(() => {
        stateCallback(connectedState);
      });

      expect(useUiStore.getState().connectionState.status).toBe('connected');
    });

    it('shows toast on failed state', () => {
      renderHook(() => useWebSocket());

      const stateCallback = getLatestStateChangeCallback();

      act(() => {
        stateCallback({ status: 'failed', error: 'Connection lost' });
      });

      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });

    it('re-fetches depth snapshot on reconnection', async () => {
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 100,
        bids: [],
        asks: [],
      });

      renderHook(() => useWebSocket());

      const stateCallback = getLatestStateChangeCallback();

      // Simulate initial connect
      act(() => {
        stateCallback({ status: 'connected', connectedAt: Date.now() });
      });

      await act(async () => {
        await flushAsync();
      });

      mockFetchDepthSnapshot.mockClear();
      mockFetchDepthSnapshot.mockResolvedValue({
        lastUpdateId: 200,
        bids: [],
        asks: [],
      });

      // Simulate reconnection
      act(() => {
        stateCallback({ status: 'reconnecting', attempt: 1 });
      });
      act(() => {
        stateCallback({ status: 'connected', connectedAt: Date.now() });
      });

      await act(async () => {
        await flushAsync();
      });

      expect(mockFetchDepthSnapshot).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Stale response guard
  // ---------------------------------------------------------------------------

  describe('stale response guard', () => {
    it('discards kline response after unmount', async () => {
      let resolveKlines: ((value: unknown) => void) | null = null;
      mockFetchKlines.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveKlines = resolve;
          }),
      );

      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      // Resolve after unmount
      await act(async () => {
        resolveKlines?.([{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }]);
        await flushAsync();
      });

      // Candles should remain empty (stale response discarded)
      expect(useKlineStore.getState().candles).toEqual([]);
    });
  });
});
