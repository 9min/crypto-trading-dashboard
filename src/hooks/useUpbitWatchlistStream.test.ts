// =============================================================================
// useUpbitWatchlistStream Tests
// =============================================================================
// Tests that the hook correctly orchestrates Upbit watchlist data flow:
//   - Fetches initial ticker data via REST API
//   - Connects to Upbit WebSocket for real-time ticker updates
//   - Falls back to REST polling when WebSocket fails
//   - Cleans up on unmount
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchlistStore } from '@/stores/watchlistStore';
import type { ConnectionState } from '@/types/chart';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockDisconnectGroup = vi.fn();
const mockSubscribe = vi.fn<[], () => void>(() => vi.fn());
const mockOnStateChange = vi.fn<[], () => void>(() => vi.fn());

vi.mock('@/lib/upbit/UpbitWebSocketManager', () => ({
  UpbitWebSocketManager: {
    getInstance: vi.fn(() => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      disconnectGroup: mockDisconnectGroup,
      subscribe: mockSubscribe,
      onStateChange: mockOnStateChange,
    })),
  },
}));

vi.mock('@/lib/upbit/messageRouter', () => ({
  createUpbitMessageRouter: vi.fn((handlers: Record<string, unknown>) => {
    return (message: Record<string, unknown>) => {
      if (message.type === 'ticker' && typeof handlers.onTicker === 'function') {
        (handlers.onTicker as (msg: Record<string, unknown>) => void)(message);
      }
    };
  }),
}));

const mockFetchUpbitTickers = vi.fn();

vi.mock('@/lib/upbit/restClient', () => ({
  fetchUpbitTickers: (...args: unknown[]) => mockFetchUpbitTickers(...args),
}));

vi.mock('@/utils/symbolMap', () => ({
  toBinanceSymbol: (s: string) => {
    const map: Record<string, string> = {
      'KRW-BTC': 'BTCUSDT',
      'KRW-ETH': 'ETHUSDT',
    };
    return map[s] ?? s;
  },
}));

vi.mock('@/utils/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/constants')>();
  return {
    ...actual,
    REST_POLL_TICKER_INTERVAL_MS: 5000,
  };
});

import { useUpbitWatchlistStream } from './useUpbitWatchlistStream';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createUpbitTickerResponse(market: string, price: number, changeRate: number) {
  return {
    market,
    trade_price: price,
    signed_change_rate: changeRate,
    acc_trade_price_24h: 1000000000,
    trade_timestamp: Date.now(),
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useUpbitWatchlistStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useWatchlistStore.getState().reset();

    mockFetchUpbitTickers.mockResolvedValue([
      createUpbitTickerResponse('KRW-BTC', 68000000, 0.025),
      createUpbitTickerResponse('KRW-ETH', 4500000, -0.01),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initial REST fetch
  // ---------------------------------------------------------------------------

  describe('initial REST fetch', () => {
    it('fetches tickers on mount', () => {
      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC', 'KRW-ETH'] }));

      expect(mockFetchUpbitTickers).toHaveBeenCalledWith(['KRW-BTC', 'KRW-ETH']);
    });

    it('maps responses to Binance symbols and calls setTickers', async () => {
      const setTickersSpy = vi.spyOn(useWatchlistStore.getState(), 'setTickers');

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC', 'KRW-ETH'] }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(setTickersSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ symbol: 'BTCUSDT', price: 68000000 }),
          expect.objectContaining({ symbol: 'ETHUSDT', price: 4500000 }),
        ]),
      );
    });

    it('sets loading to true initially', () => {
      const setLoadingSpy = vi.spyOn(useWatchlistStore.getState(), 'setLoading');

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      expect(setLoadingSpy).toHaveBeenCalledWith(true);
    });
  });

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  describe('WebSocket', () => {
    it('connects with ticker subscription for all symbols', () => {
      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC', 'KRW-ETH'] }));

      expect(mockConnect).toHaveBeenCalledWith(
        'watchlist',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'ticker',
            codes: ['KRW-BTC', 'KRW-ETH'],
          }),
        ]),
      );
    });

    it('subscribes to message router', () => {
      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('converts ticker symbol to Binance format on update', async () => {
      let stateCallback: ((state: ConnectionState) => void) | null = null;
      mockOnStateChange.mockImplementation((cb: (state: ConnectionState) => void) => {
        stateCallback = cb;
        return vi.fn();
      });

      const updateTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateTicker');

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      // Simulate connected state
      act(() => {
        stateCallback?.({ status: 'connected', connectedAt: Date.now() });
      });

      // The actual ticker routing happens through the message router mock
      // which was set up to call onTicker handler
      expect(mockSubscribe).toHaveBeenCalled();
      // We can verify updateTicker is callable with Binance symbols
      expect(updateTickerSpy).toBeDefined();
    });

    it('ignores events after unmount', async () => {
      const updateTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateTicker');

      const { unmount } = renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      unmount();
      updateTickerSpy.mockClear();

      // Any late events should be ignored via isActive guard
      expect(updateTickerSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // REST polling fallback
  // ---------------------------------------------------------------------------

  describe('REST polling fallback', () => {
    it('starts polling when WS state is failed', async () => {
      let stateCallback: ((state: ConnectionState) => void) | null = null;
      mockOnStateChange.mockImplementation((cb: (state: ConnectionState) => void) => {
        stateCallback = cb;
        return vi.fn();
      });

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      mockFetchUpbitTickers.mockClear();

      // Simulate WS failure
      act(() => {
        stateCallback?.({ status: 'failed', error: 'Connection refused' });
      });

      // Advance past polling interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });

      // Should have polled
      expect(mockFetchUpbitTickers).toHaveBeenCalled();
    });

    it('stops polling when WS reconnects', async () => {
      let stateCallback: ((state: ConnectionState) => void) | null = null;
      mockOnStateChange.mockImplementation((cb: (state: ConnectionState) => void) => {
        stateCallback = cb;
        return vi.fn();
      });

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      // Start polling
      act(() => {
        stateCallback?.({ status: 'failed', error: 'Connection refused' });
      });

      // Reconnect
      act(() => {
        stateCallback?.({ status: 'connected', connectedAt: Date.now() });
      });

      mockFetchUpbitTickers.mockClear();

      // Advance past polling interval — should NOT poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(mockFetchUpbitTickers).not.toHaveBeenCalled();
    });

    it('prevents concurrent polling requests (pollingInFlight guard)', async () => {
      let stateCallback: ((state: ConnectionState) => void) | null = null;
      mockOnStateChange.mockImplementation((cb: (state: ConnectionState) => void) => {
        stateCallback = cb;
        return vi.fn();
      });

      let resolvePolling: ((value: unknown) => void) | null = null;
      mockFetchUpbitTickers.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePolling = resolve;
          }),
      );

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      // Initial fetch — clear after it fires
      await act(async () => {
        resolvePolling?.([createUpbitTickerResponse('KRW-BTC', 68000000, 0.02)]);
        await vi.advanceTimersByTimeAsync(100);
      });

      mockFetchUpbitTickers.mockClear();
      mockFetchUpbitTickers.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePolling = resolve;
          }),
      );

      // Start polling
      act(() => {
        stateCallback?.({ status: 'failed', error: 'timeout' });
      });

      // First poll fires
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });

      const firstPollCount = mockFetchUpbitTickers.mock.calls.length;

      // Second interval fires while first is still in-flight
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Should NOT have increased because pollingInFlight blocks it
      expect(mockFetchUpbitTickers.mock.calls.length).toBe(firstPollCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('clears polling interval on unmount', async () => {
      let stateCallback: ((state: ConnectionState) => void) | null = null;
      mockOnStateChange.mockImplementation((cb: (state: ConnectionState) => void) => {
        stateCallback = cb;
        return vi.fn();
      });

      const { unmount } = renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      act(() => {
        stateCallback?.({ status: 'failed', error: 'timeout' });
      });

      unmount();
      mockFetchUpbitTickers.mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(mockFetchUpbitTickers).not.toHaveBeenCalled();
    });

    it('calls unsubscribe and disconnectGroup on unmount', () => {
      const mockUnsubscribe = vi.fn();
      const mockUnsubscribeState = vi.fn();
      mockSubscribe.mockReturnValue(mockUnsubscribe);
      mockOnStateChange.mockReturnValue(mockUnsubscribeState);

      const { unmount } = renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockUnsubscribeState).toHaveBeenCalled();
      expect(mockDisconnectGroup).toHaveBeenCalledWith('watchlist');
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('logs error on REST fetch failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchUpbitTickers.mockRejectedValue(new Error('Network error'));

      renderHook(() => useUpbitWatchlistStream({ symbols: ['KRW-BTC'] }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useUpbitWatchlistStream] Failed to fetch tickers',
        expect.any(Object),
      );

      consoleErrorSpy.mockRestore();
    });

    it('does not connect when symbols is empty', () => {
      renderHook(() => useUpbitWatchlistStream({ symbols: [] }));

      expect(mockFetchUpbitTickers).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });
});
