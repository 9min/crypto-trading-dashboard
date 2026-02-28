// =============================================================================
// useWatchlistStream Tests
// =============================================================================
// Tests that the hook correctly orchestrates watchlist data flow:
//   - Fetches initial 24hr ticker data via REST API
//   - Connects to miniTicker WebSocket stream for real-time updates
//   - Routes miniTicker events to the watchlist store
//   - Cleans up on unmount
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchlistStore } from '@/stores/watchlistStore';
import type { BinanceMiniTickerEvent } from '@/types/binance';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSubscribe = vi.fn<[], () => void>(() => vi.fn());

vi.mock('@/lib/websocket/WatchlistStreamManager', () => ({
  WatchlistStreamManager: {
    getInstance: vi.fn(() => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      subscribe: mockSubscribe,
    })),
  },
}));

const mockFetch24hrTickers = vi.fn();

vi.mock('@/lib/binance/restApi', () => ({
  fetch24hrTickers: (...args: unknown[]) => mockFetch24hrTickers(...args),
}));

import { useWatchlistStream } from './useWatchlistStream';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createTickerResponse(symbol: string, price: string, change: string, volume: string) {
  return { symbol, lastPrice: price, priceChangePercent: change, quoteVolume: volume };
}

function createMiniTickerEvent(
  symbol: string,
  close: string,
  open: string,
  volume: string,
): BinanceMiniTickerEvent {
  return {
    e: '24hrMiniTicker',
    E: Date.now(),
    s: symbol,
    c: close,
    o: open,
    h: close,
    l: open,
    v: '100',
    q: volume,
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useWatchlistStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatchlistStore.getState().reset();
    useWatchlistStore.getState().addSymbol('BTCUSDT');
    useWatchlistStore.getState().addSymbol('ETHUSDT');

    mockFetch24hrTickers.mockResolvedValue([
      createTickerResponse('BTCUSDT', '50000', '2.5', '1000000'),
      createTickerResponse('ETHUSDT', '3000', '-1.0', '500000'),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initial setup
  // ---------------------------------------------------------------------------

  describe('initial setup', () => {
    it('fetches 24hr tickers on mount when enabled', async () => {
      renderHook(() => useWatchlistStream(true));

      expect(mockFetch24hrTickers).toHaveBeenCalledWith(
        expect.arrayContaining(['BTCUSDT', 'ETHUSDT']),
      );
    });

    it('maps REST responses to setTickers', async () => {
      const setTickersSpy = vi.spyOn(useWatchlistStore.getState(), 'setTickers');

      renderHook(() => useWatchlistStream(true));

      await vi.waitFor(() => {
        expect(setTickersSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ symbol: 'BTCUSDT', price: 50000 }),
            expect.objectContaining({ symbol: 'ETHUSDT', price: 3000 }),
          ]),
        );
      });
    });

    it('also calls setBinanceTickers with REST responses', async () => {
      const setBinanceTickersSpy = vi.spyOn(useWatchlistStore.getState(), 'setBinanceTickers');

      renderHook(() => useWatchlistStream(true));

      await vi.waitFor(() => {
        expect(setBinanceTickersSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ symbol: 'BTCUSDT', price: 50000 }),
            expect.objectContaining({ symbol: 'ETHUSDT', price: 3000 }),
          ]),
        );
      });
    });

    it('connects WatchlistStreamManager with symbols', () => {
      renderHook(() => useWatchlistStream(true));

      expect(mockConnect).toHaveBeenCalledWith(expect.arrayContaining(['BTCUSDT', 'ETHUSDT']));
    });
  });

  // ---------------------------------------------------------------------------
  // WebSocket stream
  // ---------------------------------------------------------------------------

  describe('WebSocket stream', () => {
    it('subscribes to miniTicker events', () => {
      renderHook(() => useWatchlistStream(true));

      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('routes miniTicker events to updateTicker', async () => {
      let tickerHandler: ((event: BinanceMiniTickerEvent) => void) | null = null;
      mockSubscribe.mockImplementation((handler: (event: BinanceMiniTickerEvent) => void) => {
        tickerHandler = handler;
        return vi.fn();
      });

      const updateTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateTicker');
      renderHook(() => useWatchlistStream(true));

      act(() => {
        tickerHandler?.(createMiniTickerEvent('BTCUSDT', '51000', '50000', '1100000'));
      });

      expect(updateTickerSpy).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.objectContaining({
          price: 51000,
          volume: 1100000,
        }),
      );
    });

    it('also routes miniTicker events to updateBinanceTicker', async () => {
      let tickerHandler: ((event: BinanceMiniTickerEvent) => void) | null = null;
      mockSubscribe.mockImplementation((handler: (event: BinanceMiniTickerEvent) => void) => {
        tickerHandler = handler;
        return vi.fn();
      });

      const updateBinanceTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateBinanceTicker');
      renderHook(() => useWatchlistStream(true));

      act(() => {
        tickerHandler?.(createMiniTickerEvent('BTCUSDT', '51000', '50000', '1100000'));
      });

      expect(updateBinanceTickerSpy).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.objectContaining({
          price: 51000,
          volume: 1100000,
        }),
      );
    });

    it('calculates priceChangePercent as ((close - open) / open) * 100', () => {
      let tickerHandler: ((event: BinanceMiniTickerEvent) => void) | null = null;
      mockSubscribe.mockImplementation((handler: (event: BinanceMiniTickerEvent) => void) => {
        tickerHandler = handler;
        return vi.fn();
      });

      const updateTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateTicker');
      renderHook(() => useWatchlistStream(true));

      act(() => {
        // close=110, open=100 → (110-100)/100 * 100 = 10%
        tickerHandler?.(createMiniTickerEvent('BTCUSDT', '110', '100', '500'));
      });

      expect(updateTickerSpy).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.objectContaining({ priceChangePercent: 10 }),
      );
    });

    it('handles open=0 without division by zero', () => {
      let tickerHandler: ((event: BinanceMiniTickerEvent) => void) | null = null;
      mockSubscribe.mockImplementation((handler: (event: BinanceMiniTickerEvent) => void) => {
        tickerHandler = handler;
        return vi.fn();
      });

      const updateTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateTicker');
      renderHook(() => useWatchlistStream(true));

      act(() => {
        tickerHandler?.(createMiniTickerEvent('BTCUSDT', '100', '0', '500'));
      });

      expect(updateTickerSpy).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.objectContaining({ priceChangePercent: 0 }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('calls unsubscribe on unmount', () => {
      const mockUnsubscribe = vi.fn();
      mockSubscribe.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useWatchlistStream(true));
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('calls disconnect on unmount', () => {
      const { unmount } = renderHook(() => useWatchlistStream(true));
      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled
  // ---------------------------------------------------------------------------

  describe('disabled', () => {
    it('does not fetch or connect when enabled is false', () => {
      renderHook(() => useWatchlistStream(false));

      expect(mockFetch24hrTickers).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('sets loading to false when disabled', () => {
      const setLoadingSpy = vi.spyOn(useWatchlistStore.getState(), 'setLoading');
      renderHook(() => useWatchlistStream(false));

      expect(setLoadingSpy).toHaveBeenCalledWith(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('logs error and sets loading false on REST fetch failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const setLoadingSpy = vi.spyOn(useWatchlistStore.getState(), 'setLoading');
      mockFetch24hrTickers.mockRejectedValue(new Error('Network error'));

      renderHook(() => useWatchlistStream(true));

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[useWatchlistStream] Failed to fetch 24hr tickers',
          expect.any(Object),
        );
      });

      expect(setLoadingSpy).toHaveBeenCalledWith(false);
      consoleErrorSpy.mockRestore();
    });

    it('ignores events after unmount (isActive guard)', async () => {
      let tickerHandler: ((event: BinanceMiniTickerEvent) => void) | null = null;
      mockSubscribe.mockImplementation((handler: (event: BinanceMiniTickerEvent) => void) => {
        tickerHandler = handler;
        return vi.fn();
      });

      const updateTickerSpy = vi.spyOn(useWatchlistStore.getState(), 'updateTicker');
      const { unmount } = renderHook(() => useWatchlistStream(true));

      unmount();
      updateTickerSpy.mockClear();

      act(() => {
        tickerHandler?.(createMiniTickerEvent('BTCUSDT', '99999', '50000', '999'));
      });

      expect(updateTickerSpy).not.toHaveBeenCalled();
    });
  });
});
