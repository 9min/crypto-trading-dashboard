// =============================================================================
// useFuturesBinanceStream Tests
// =============================================================================
// Tests that the hook maintains a Binance WebSocket connection for futures
// symbol prices when the active exchange is not Binance.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useUiStore } from '@/stores/uiStore';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockFetch24hrTickers = vi.fn();

vi.mock('@/lib/binance/restApi', () => ({
  fetch24hrTickers: (...args: unknown[]) => mockFetch24hrTickers(...args),
}));

vi.mock('@/lib/binance/streamUrls', () => ({
  buildStreamUrl: vi.fn((streams: string[]) => `wss://mock?streams=${streams.join('/')}`),
  getMiniTickerStream: vi.fn((s: string) => `${s.toLowerCase()}@miniTicker`),
}));

vi.mock('@/lib/websocket/messageRouter', () => ({
  parseCombinedStreamMessage: vi.fn((raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      return parsed.data ?? null;
    } catch {
      return null;
    }
  }),
}));

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.OPEN;
  url: string;
  listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string) {
    mockWebSocketInstances.push(this);
    this.url = url;
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  close(): void {
    this.readyState = 3; // CLOSED
  }

  // Test helper to simulate messages
  simulateMessage(data: string): void {
    const handlers = this.listeners.get('message');
    if (handlers) {
      for (const handler of handlers) {
        handler({ data });
      }
    }
  }
}

let mockWebSocketInstances: MockWebSocket[] = [];

// Visibility state mock
let mockVisibilityState: DocumentVisibilityState = 'visible';
const visibilityListeners: Set<() => void> = new Set();

// Install mock WebSocket + visibility
const originalWebSocket = globalThis.WebSocket;
beforeEach(() => {
  mockWebSocketInstances = [];
  mockVisibilityState = 'visible';
  visibilityListeners.clear();
  // @ts-expect-error — replacing WebSocket for testing
  globalThis.WebSocket = MockWebSocket;

  Object.defineProperty(document, 'visibilityState', {
    get: () => mockVisibilityState,
    configurable: true,
  });
  vi.spyOn(document, 'addEventListener').mockImplementation((type: string, handler: unknown) => {
    if (type === 'visibilitychange') {
      visibilityListeners.add(handler as () => void);
    }
  });
  vi.spyOn(document, 'removeEventListener').mockImplementation((type: string, handler: unknown) => {
    if (type === 'visibilitychange') {
      visibilityListeners.delete(handler as () => void);
    }
  });
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
});

import { useFuturesBinanceStream } from './useFuturesBinanceStream';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createTickerResponse(symbol: string, price: string, change: string, volume: string) {
  return { symbol, lastPrice: price, priceChangePercent: change, quoteVolume: volume };
}

function simulateVisibilityChange(state: DocumentVisibilityState): void {
  mockVisibilityState = state;
  for (const listener of visibilityListeners) {
    listener();
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useFuturesBinanceStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatchlistStore.getState().reset();
    usePortfolioStore.getState().resetPortfolio();
    useUiStore.getState().setSymbol('BTCUSDT');
    mockFetch24hrTickers.mockResolvedValue([
      createTickerResponse('BTCUSDT', '64832', '2.5', '1000000'),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Disabled (exchange is Binance)
  // ---------------------------------------------------------------------------

  describe('when disabled', () => {
    it('does not fetch or create WebSocket when enabled is false', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: false }));

      expect(mockFetch24hrTickers).not.toHaveBeenCalled();
      expect(mockWebSocketInstances).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Enabled (exchange is Upbit)
  // ---------------------------------------------------------------------------

  describe('when enabled', () => {
    it('fetches Binance tickers on mount', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      expect(mockFetch24hrTickers).toHaveBeenCalledWith(expect.arrayContaining(['BTCUSDT']));
    });

    it('calls setBinanceTickers with REST response', async () => {
      const setBinanceTickersSpy = vi.spyOn(useWatchlistStore.getState(), 'setBinanceTickers');

      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      await vi.waitFor(() => {
        expect(setBinanceTickersSpy).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ symbol: 'BTCUSDT', price: 64832 })]),
        );
      });
    });

    it('creates a WebSocket connection', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      expect(mockWebSocketInstances.length).toBeGreaterThanOrEqual(1);
    });

    it('updates binancePrices on WebSocket miniTicker message', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      const ws = mockWebSocketInstances[0];
      const message = JSON.stringify({
        stream: 'btcusdt@miniTicker',
        data: {
          e: '24hrMiniTicker',
          E: Date.now(),
          s: 'BTCUSDT',
          c: '65000',
          o: '64000',
          h: '66000',
          l: '63000',
          v: '100',
          q: '6500000',
        },
      });

      ws.simulateMessage(message);

      // Verify store was updated directly
      const binancePrices = useWatchlistStore.getState().binancePrices;
      expect(binancePrices.get('BTCUSDT')).toEqual(
        expect.objectContaining({
          price: 65000,
          volume: 6500000,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Stable deps: does not reconnect when symbols are the same
  // ---------------------------------------------------------------------------

  describe('stable symbol tracking', () => {
    it('does not create a new WebSocket when symbol set is unchanged', () => {
      const { rerender } = renderHook(() => useFuturesBinanceStream({ enabled: true }));

      const initialWsCount = mockWebSocketInstances.length;

      // Trigger a rerender with the same symbol state
      act(() => {
        useUiStore.getState().setSymbol('BTCUSDT'); // same symbol
      });
      rerender();

      expect(mockWebSocketInstances.length).toBe(initialWsCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Page Visibility
  // ---------------------------------------------------------------------------

  describe('page visibility', () => {
    it('registers visibilitychange listener', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      expect(visibilityListeners.size).toBe(1);
    });

    it('closes WebSocket when tab becomes hidden', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      const ws = mockWebSocketInstances[0];
      expect(ws).toBeDefined();

      act(() => simulateVisibilityChange('hidden'));

      expect(ws.readyState).toBe(3); // CLOSED
    });

    it('creates a new WebSocket when tab becomes visible again', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      const initialCount = mockWebSocketInstances.length;

      act(() => simulateVisibilityChange('hidden'));
      act(() => simulateVisibilityChange('visible'));

      expect(mockWebSocketInstances.length).toBeGreaterThan(initialCount);
    });

    it('re-fetches REST tickers when tab becomes visible', () => {
      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      mockFetch24hrTickers.mockClear();

      act(() => simulateVisibilityChange('hidden'));
      act(() => simulateVisibilityChange('visible'));

      expect(mockFetch24hrTickers).toHaveBeenCalledWith(expect.arrayContaining(['BTCUSDT']));
    });

    it('removes visibilitychange listener on unmount', () => {
      const { unmount } = renderHook(() => useFuturesBinanceStream({ enabled: true }));

      expect(visibilityListeners.size).toBe(1);

      unmount();

      expect(visibilityListeners.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('closes WebSocket on unmount', () => {
      const { unmount } = renderHook(() => useFuturesBinanceStream({ enabled: true }));

      const ws = mockWebSocketInstances[0];
      expect(ws).toBeDefined();

      unmount();

      expect(ws.readyState).toBe(3); // CLOSED
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('logs error when REST fetch fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch24hrTickers.mockRejectedValue(new Error('Network error'));

      renderHook(() => useFuturesBinanceStream({ enabled: true }));

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[useFuturesBinanceStream] Failed to fetch Binance tickers',
          expect.any(Object),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
